<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { Empty } from '@cio/ui/custom/empty';
  import BookOpenIcon from '@lucide/svelte/icons/book-open';
  import ContentList from '$features/course/components/lesson/content-list.svelte';
  import ContentSectionList from '$features/course/components/lesson/content-section-list.svelte';
  import CourseContentIcon from '$features/course/components/course-content-icon.svelte';
  import { courseApi } from '$features/course/api';
  import { t } from '$lib/utils/functions/translations';
  import { isCourseLearnerView, isCoursePreview } from '$lib/utils/store/app';
  import { getCourseContent } from '$features/course/utils/content';
  import { getContinueLearningContent } from '$features/course/utils/content-navigation';
  import { ContentType } from '@cio/utils/constants/content';

  interface Props {
    courseId: string;
    reorder?: boolean;
  }

  let { courseId, reorder = $bindable(false) }: Props = $props();

  const query = new URLSearchParams(page.url.search);

  const contentData = $derived(getCourseContent(courseApi.course));
  const contentLength = $derived(contentData.grouped ? contentData.sections.length : contentData.items.length);
  const contentItems = $derived(
    contentData.grouped ? contentData.sections.flatMap((section) => section.items) : contentData.items
  );
  const navigableContentItems = $derived(
    contentItems.filter((item) => item.type === ContentType.Lesson || item.type === ContentType.Exercise)
  );

  const sectionsTotal = $derived(
    contentData.grouped ? contentData.sections.filter((section) => section.id !== 'ungrouped').length : 0
  );
  const lessonsTotal = $derived(contentItems.filter((item) => item.type === ContentType.Lesson).length);
  const exercisesTotal = $derived(contentItems.filter((item) => item.type === ContentType.Exercise).length);

  let isFetching: boolean = $state(false);
  let hasHandledNext = $state(false);

  const isCourseLoadedForThisPage = $derived(courseApi.course?.id === courseId);
  const canResolveNext = $derived(isCourseLoadedForThisPage && navigableContentItems.length > 0 && !hasHandledNext);

  $effect(() => {
    if (!canResolveNext || isFetching || query.get('next') !== 'true') return;

    hasHandledNext = true;
    const incompleteContent = getContinueLearningContent(courseApi.course);
    if (incompleteContent) {
      if (incompleteContent.type === ContentType.Lesson) {
        goto(`/courses/${courseId}/lessons/${incompleteContent.id}`);
      } else {
        goto(`/courses/${courseId}/exercises/${incompleteContent.id}`);
      }
    } else {
      goto(`/courses/${courseId}/lessons`);
    }
  });

  const shouldShowNextPlaceholder = $derived(query.get('next') === 'true');
</script>

{#if shouldShowNextPlaceholder}
  <Empty
    title={$t('course.navItem.lessons.no_lesson')}
    description={$isCourseLearnerView
      ? $t('course.navItem.lessons.student_share_your_knowledge')
      : $t('course.navItem.lessons.share_your_knowledge')}
    icon={BookOpenIcon}
    variant="page"
  />
{:else if contentLength > 0}
  <div
    class="mb-4 grid grid-cols-3 gap-2 sm:mb-5 sm:gap-3"
    role="region"
    aria-label={t.get('course.navItem.lessons.heading_v2')}
  >
    <div class="ui:border-border flex min-w-0 flex-col gap-1 rounded-lg border px-2 py-2 sm:px-4 sm:py-3">
      <div class="ui:text-muted-foreground flex items-center gap-2 text-xs font-medium">
        <span class="hidden shrink-0 sm:inline-flex" aria-hidden="true">
          <CourseContentIcon type={ContentType.Section} size={14} />
        </span>
        <span>{$t('course.navItem.lessons.stats.sections')}</span>
      </div>
      <p class="text-xl leading-6 font-semibold tabular-nums sm:text-2xl sm:leading-8">{sectionsTotal}</p>
    </div>
    <div class="ui:border-border flex min-w-0 flex-col gap-1 rounded-lg border px-2 py-2 sm:px-4 sm:py-3">
      <div class="ui:text-muted-foreground flex items-center gap-2 text-xs font-medium">
        <span class="hidden shrink-0 sm:inline-flex" aria-hidden="true">
          <CourseContentIcon type={ContentType.Lesson} size={14} />
        </span>
        <span>{$t('course.navItem.lessons.stats.lessons')}</span>
      </div>
      <p class="text-xl leading-6 font-semibold tabular-nums sm:text-2xl sm:leading-8">{lessonsTotal}</p>
    </div>
    <div class="ui:border-border flex min-w-0 flex-col gap-1 rounded-lg border px-2 py-2 sm:px-4 sm:py-3">
      <div class="ui:text-muted-foreground flex items-center gap-2 text-xs font-medium">
        <span class="hidden shrink-0 sm:inline-flex" aria-hidden="true">
          <CourseContentIcon type={ContentType.Exercise} size={14} />
        </span>
        <span>{$t('course.navItem.lessons.stats.exercises')}</span>
      </div>
      <p class="text-xl leading-6 font-semibold tabular-nums sm:text-2xl sm:leading-8">{exercisesTotal}</p>
    </div>
  </div>

  {#if reorder}
    <p class="text-center text-xs text-gray-400 italic dark:text-white">
      {$t('course.navItem.lessons.drag')}
    </p>
  {/if}

  {#if contentData.grouped}
    <ContentSectionList {reorder} />
  {:else}
    <ContentList {reorder} />
  {/if}
{:else}
  <Empty
    title={$t('course.navItem.lessons.body_header')}
    description={$isCourseLearnerView
      ? $t('course.navItem.lessons.student_body_content')
      : $t('course.navItem.lessons.body_content')}
    icon={BookOpenIcon}
    variant="page"
  />
{/if}
