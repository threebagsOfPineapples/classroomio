<script lang="ts">
  import { Button } from '@cio/ui/base/button';
  import { Search } from '@cio/ui/custom/search';
  import { CourseCardList, CourseCardLoader } from '$features/course/components';
  import type { UserEnrolledCourses } from '$features/course/types';
  import { filterLearningCourses } from '$features/course/utils/course-learning';
  import { t } from '$lib/utils/functions/translations';

  let {
    courses,
    loading = false,
    error = null,
    onRetry
  }: { courses: UserEnrolledCourses; loading?: boolean; error?: string | null; onRetry: () => void } = $props();
  let filter = $state('pending');
  let search = $state('');
  const filters = ['all', 'required', 'optional', 'pending', 'completed'];
  const visibleCourses = $derived(filterLearningCourses(courses, filter, search));

  function showAllCourses() {
    search = '';
    filter = 'all';
  }
</script>

<div class="learning-courses space-y-4">
  <div class="course-tools">
    <div class="training-filters" aria-label={$t('enterprise.ui_v2.course_filter')}>
      {#each filters as value}
        <Button size="sm" variant="ghost" aria-pressed={filter === value} onclick={() => (filter = value)}>
          {$t(
            value === 'required' || value === 'optional'
              ? `enterprise.learner_home.${value}`
              : `enterprise.ui_v2.${value}`
          )}
          <span class="text-xs">{loading || error ? '—' : filterLearningCourses(courses, value).length}</span>
        </Button>
      {/each}
    </div>
    <Search
      placeholder={$t('courses.search_placeholder')}
      clearLabel={$t('public_courses.filters.clear_search')}
      bind:value={search}
    />
  </div>
  {#if search.trim() && !loading && !error}<p class="ui:text-muted-foreground text-sm" aria-live="polite">
      {$t('enterprise.ui_v2.search_count', { count: visibleCourses.length })}
    </p>{/if}
  {#if loading}
    <div class="learning-card-grid" aria-busy="true"><CourseCardLoader /><CourseCardLoader /></div>
  {:else if error}
    <div class="training-panel space-y-3" role="alert">
      <p>{$t('enterprise.load_failed')}</p>
      <Button size="sm" variant="outline" onclick={onRetry}>{$t('enterprise.ui_v2.retry')}</Button>
    </div>
  {:else if visibleCourses.length}
    <CourseCardList courses={visibleCourses} isLMS />
  {:else}
    <div class="training-panel training-empty" role="status">
      <h3>{$t(search.trim() ? 'enterprise.ui_v2.search_empty' : 'enterprise.ui_v2.filter_empty')}</h3>
      <p>{$t(search.trim() ? 'enterprise.ui_v2.search_hint' : 'enterprise.ui_v2.filter_hint')}</p>
      {#if search.trim()}<Button size="sm" variant="outline" onclick={() => (search = '')}
          >{$t('enterprise.ui_v2.clear_search')}</Button
        >{/if}<Button size="sm" variant="outline" onclick={showAllCourses}
        >{$t('enterprise.ui_v2.view_all_courses')}</Button
      >
    </div>
  {/if}
</div>
