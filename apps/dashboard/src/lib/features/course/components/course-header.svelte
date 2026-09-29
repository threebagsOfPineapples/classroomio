<script lang="ts">
  import InterfaceLanguage from '$features/ui/navigation/interface-language.svelte';
  import { Separator } from '@cio/ui/base/separator';
  import * as Sidebar from '@cio/ui/base/sidebar';
  import * as ButtonGroup from '@cio/ui/base/button-group';
  import * as DropdownMenu from '@cio/ui/base/dropdown-menu';
  import EyeIcon from '@lucide/svelte/icons/eye';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
  import { Button } from '@cio/ui/base/button';
  import { Waves } from '@cio/ui/custom/animation';
  import { page } from '$app/state';
  import { currentOrgDomain, isOrgTeamMember } from '$lib/utils/store/org';
  import { isStudentExperience, isCourseLearnerView, isCoursePreview, setCoursePreview } from '$lib/utils/store/app';
  import { isMobileStore } from '@cio/ui/hooks/is-mobile.svelte';
  import { getCourseProgress } from '$features/course/utils/content';
  import { isCourseMobileBottomNavVisible } from '$features/course/utils/mobile-bottom-nav';
  import SparklesIcon from '@lucide/svelte/icons/sparkles';
  import { courseApi } from '$features/course/api';
  import { getActiveCourseNavKey } from '$features/course/utils/functions';
  import { toggleAiAssistant } from '$features/ai-assistant/utils/store';
  import { IS_AI_ENABLED } from '$lib/utils/constants/ai';
  import { openCoursePreview } from '$features/course/utils/course-preview';
  import { t } from '$lib/utils/functions/translations';
  import CourseProgressPopover from './course-progress-popover.svelte';
  import CoursePublishBadge from './course-publish-badge.svelte';
  import CourseContextMenuContent from './course-context-menu-content.svelte';

  const showCoursePublishBadge = $derived(!$isStudentExperience);
  const activeNavKey = $derived(getActiveCourseNavKey(page.url.pathname, courseApi.course?.id ?? ''));
  const isPublished = $derived(courseApi.course?.isPublished ?? false);
  const lessonId = $derived(page.params.lessonId as string | undefined);
  const exerciseId = $derived(page.params.exerciseId as string | undefined);
  const showMobileBottomNav = $derived(
    isCourseMobileBottomNavVisible({
      isCourseLearnerView: $isCourseLearnerView,
      isMobile: isMobileStore.current,
      isLessonOrExercisePage: Boolean(lessonId || exerciseId),
      courseProgress: getCourseProgress(courseApi.course)
    })
  );

  function handleViewCourseSite() {
    const course = courseApi.course;
    if (!course?.id) {
      return;
    }

    openCoursePreview({
      courseId: course.id,
      courseSlug: course.slug,
      currentOrgDomain: $currentOrgDomain
    });
  }
</script>

<header
  class="ui:border-border ui:bg-background ui:z-app-bar sticky top-0 flex h-12 w-full shrink-0 items-center gap-2 border-b backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-8"
>
  <div class="flex w-full items-center gap-2 px-4">
    <Sidebar.Trigger aria-label={$t('common.toggle_sidebar')} title={$t('common.toggle_sidebar')} variant="secondary" />

    <div class="h-4 w-2">
      <Separator orientation="vertical" />
    </div>

    <div class="flex w-[60%] min-w-0 flex-1 flex-col justify-center gap-0.5">
      <div class="flex min-w-0 items-center gap-2">
        <p class="max-w-xs truncate text-sm font-medium">
          {activeNavKey ? $t(activeNavKey) : ''}
        </p>

        {#if showCoursePublishBadge}
          <CoursePublishBadge {isPublished} />
        {/if}
      </div>
    </div>

    <span class="grow"></span>
    <InterfaceLanguage />

    {#if $isOrgTeamMember}
      <Button href={$isCourseLearnerView ? '/admin' : '/lms'} variant="outline" size="sm">
        {$t($isCourseLearnerView ? 'enterprise.interface.admin_portal' : 'enterprise.interface.learner_portal')}
      </Button>
    {/if}

    {#if $isCourseLearnerView && !$isCoursePreview && !showMobileBottomNav}
      <CourseProgressPopover class="md:hidden" />
    {/if}

    {#if IS_AI_ENABLED}
      <Button
        size="sm"
        onclick={toggleAiAssistant}
        class="ui:bg-primary ui:text-primary-foreground relative overflow-hidden border-0"
      >
        <Waves
          lineColor="rgba(255,255,255,0.55)"
          xGap={8}
          yGap={12}
          waveAmpX={18}
          waveAmpY={9}
          waveSpeedX={0.04}
          waveSpeedY={0.02}
        />
        <SparklesIcon size={14} class="relative z-10" />
        <span class="relative z-10">{$t('course.navItems.nav_ai_assistant')}</span>
      </Button>
    {/if}

    {#if !$isStudentExperience}
      <ButtonGroup.Root>
        <Button
          variant="outline"
          size="sm"
          onclick={handleViewCourseSite}
          disabled={!courseApi.course?.id}
          aria-label={$t('enterprise.course.preview_title')}
        >
          <EyeIcon size={14} />
          <span class="hidden sm:inline">{$t('enterprise.course.preview_title')}</span>
        </Button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                variant="outline"
                size="sm"
                aria-label={$t('courses.course_card.actions_menu_aria')}
                disabled={!courseApi.course?.id}
              >
                <EllipsisVerticalIcon size={14} />
              </Button>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            {#if courseApi.course}
              <CourseContextMenuContent
                id={courseApi.course.id}
                title={courseApi.course.title}
                description={courseApi.course.description}
                isPublished={courseApi.course.isPublished ?? false}
                courseType={courseApi.course.type}
                slug={courseApi.course.slug ?? ''}
              />
            {/if}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </ButtonGroup.Root>
    {/if}
  </div>
</header>

{#if $isCoursePreview}
  <div
    class="ui:border-border ui:bg-muted flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
    role="status"
  >
    <div>
      <p class="text-sm font-semibold">{$t('enterprise.course.preview_title')}</p>
      <p class="ui:text-muted-foreground text-xs">{$t('enterprise.course.preview_description')}</p>
    </div>
    <Button
      size="sm"
      variant="outline"
      onclick={() => {
        const courseId = courseApi.course?.id;
        if (!courseId) return;

        setCoursePreview(null);
        goto(resolve(`/courses/${courseId}/lessons`, {}));
      }}>{$t('enterprise.course.exit_preview')}</Button
    >
  </div>
{/if}
