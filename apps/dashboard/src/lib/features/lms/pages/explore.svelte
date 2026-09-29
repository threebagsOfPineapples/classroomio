<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { profile } from '$lib/utils/store/user';
  import { currentOrg } from '$lib/utils/store/org';
  import { t } from '$lib/utils/functions/translations';
  import { CoursesPage } from '$features/course/pages';
  import { courseMetaDeta } from '$features/course/utils/store';
  import { coursesApi } from '$features/course/api';
  import { tagApi } from '$features/tag/api';
  import type { RecommendedCourses } from '$features/course/types';
  import { CourseSortBy, DEFAULT_COURSE_SORT, parseCourseSortValue } from '$features/course/utils/constants';
  import CoursePreviewModal from '$features/lms/components/course-preview-modal.svelte';
  import * as Pagination from '@cio/ui/base/pagination';
  import { Button } from '@cio/ui/base/button';

  const EXPLORE_LIMIT = 12;

  let searchValue = $state('');
  let sortKey = $state<CourseSortBy>(DEFAULT_COURSE_SORT);
  let selectedCourse = $state<RecommendedCourses[number] | null>(null);
  let previewOpen = $state(false);
  let currentPage = $state(1);
  let selectedTagSlug = $state('');
  let requiredFilter = $state<'all' | 'required' | 'optional'>('all');
  let lastSearchValue = '';

  $effect(() => {
    if (!browser) return;
    void sortKey;
    localStorage.setItem('classroomio_filter_course_key', sortKey);
  });

  const filteredExploreCourses: RecommendedCourses = $derived.by(() => {
    const coursesFiltered = [...coursesApi.recommendedCourses];

    if (sortKey === CourseSortBy.DateCreated) {
      return coursesFiltered.sort(
        (a, b) => new Date(a.createdAt ?? '').getTime() - new Date(b.createdAt ?? '').getTime()
      );
    } else if (sortKey === CourseSortBy.LastUpdatedAt) {
      return coursesFiltered.sort((a, b) => {
        const aUpdatedAt = new Date(a.updatedAt ?? a.createdAt ?? '').getTime();
        const bUpdatedAt = new Date(b.updatedAt ?? b.createdAt ?? '').getTime();

        return bUpdatedAt - aUpdatedAt;
      });
    } else if (sortKey === CourseSortBy.Published) {
      return coursesFiltered.sort((a, b) => Number(b.isPublished) - Number(a.isPublished));
    } else if (sortKey === CourseSortBy.Lessons) {
      return coursesFiltered.sort((a, b) => (b.lessonCount ?? 0) - (a.lessonCount ?? 0));
    }

    return coursesFiltered;
  });

  const pagination = $derived(coursesApi.recommendedCoursesPagination);

  function fetchPage(page: number) {
    currentPage = page;
  }

  function selectTag(tagSlug: string) {
    selectedTagSlug = tagSlug;
    currentPage = 1;
  }

  function selectRequired(filter: 'all' | 'required' | 'optional') {
    requiredFilter = filter;
    currentPage = 1;
  }

  $effect(() => {
    const nextSearchValue = searchValue.trim();
    if (nextSearchValue === lastSearchValue) return;

    lastSearchValue = nextSearchValue;
    currentPage = 1;
  });

  onMount(() => {
    const courseView = localStorage.getItem('courseView') as 'grid' | 'list' | null;

    if (courseView) {
      $courseMetaDeta.view = courseView;
    }

    sortKey = parseCourseSortValue(localStorage.getItem('classroomio_filter_course_key'));
  });

  $effect(() => {
    if (!$profile.id || !$currentOrg.id) return;

    void tagApi.getTagGroups();
  });

  $effect(() => {
    if (!$profile.id || !$currentOrg.id) return;

    const page = currentPage;
    const search = searchValue.trim();
    const tagSlug = selectedTagSlug;
    const required = requiredFilter === 'all' ? undefined : requiredFilter === 'required';
    const timeout = setTimeout(
      () => void coursesApi.getRecommendedCourses({ limit: EXPLORE_LIMIT, page, search, tagSlug, required }),
      search ? 250 : 0
    );
    return () => clearTimeout(timeout);
  });
</script>

<CoursesPage
  courses={filteredExploreCourses}
  emptyTitle={$t('explore.empty_heading')}
  emptyDescription={$t('explore.empty_description')}
  isExplore={true}
  isLMS={true}
  isLoading={coursesApi.isLoading}
  bind:searchValue
  bind:sortKey
  onCardClick={(course) => {
    selectedCourse = course as RecommendedCourses[number];
    previewOpen = true;
  }}
>
  {#snippet filterControls()}
    <div role="group" aria-label={$t('explore.course_requirement')} class="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant={requiredFilter === 'all' ? 'secondary' : 'outline'}
        onclick={() => selectRequired('all')}
      >
        {$t('widgets.filter.all')}
      </Button>
      <Button
        size="sm"
        variant={requiredFilter === 'required' ? 'secondary' : 'outline'}
        onclick={() => selectRequired('required')}
      >
        {$t('explore.required')}
      </Button>
      <Button
        size="sm"
        variant={requiredFilter === 'optional' ? 'secondary' : 'outline'}
        onclick={() => selectRequired('optional')}
      >
        {$t('explore.optional')}
      </Button>
    </div>
    {#if tagApi.tagGroups.some((group) => group.tags.length > 0)}
      <div role="group" aria-label={$t('courses.tag_filters.tags')} class="flex flex-wrap gap-2">
        <Button size="sm" variant={selectedTagSlug === '' ? 'secondary' : 'outline'} onclick={() => selectTag('')}>
          {$t('widgets.filter.all')}
        </Button>
        {#each tagApi.tagGroups as group (group.id)}
          {#each group.tags as tag (tag.id)}
            <Button
              size="sm"
              variant={selectedTagSlug === tag.slug ? 'secondary' : 'outline'}
              onclick={() => selectTag(tag.slug)}
            >
              {tag.name}
            </Button>
          {/each}
        {/each}
      </div>
    {/if}
  {/snippet}
</CoursesPage>

{#if pagination && pagination.totalPages > 1}
  <Pagination.Root
    count={pagination.total}
    perPage={pagination.limit}
    page={currentPage}
    onPageChange={fetchPage}
    class="mt-6"
  >
    {#snippet children({ pages, currentPage: activePage })}
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.PrevButton />
        </Pagination.Item>
        {#each pages as pageItem (pageItem.key)}
          {#if pageItem.type === 'ellipsis'}
            <Pagination.Item>
              <Pagination.Ellipsis />
            </Pagination.Item>
          {:else}
            <Pagination.Item>
              <Pagination.Link page={pageItem} isActive={activePage === pageItem.value}>
                {pageItem.value}
              </Pagination.Link>
            </Pagination.Item>
          {/if}
        {/each}
        <Pagination.Item>
          <Pagination.NextButton />
        </Pagination.Item>
      </Pagination.Content>
    {/snippet}
  </Pagination.Root>
{/if}

{#if selectedCourse}
  {#key selectedCourse.id}
    <CoursePreviewModal course={selectedCourse} bind:open={previewOpen} />
  {/key}
{/if}
