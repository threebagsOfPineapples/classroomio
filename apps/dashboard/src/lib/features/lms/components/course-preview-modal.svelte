<script lang="ts">
  import { goto } from '$app/navigation';
  import * as Dialog from '@cio/ui/base/dialog';
  import { Button } from '@cio/ui/base/button';
  import { SafeHtmlContent } from '@cio/ui/custom/safe-html-content';
  import HTMLRender from '$features/ui/html-render.svelte';
  import BookOpenIcon from '@lucide/svelte/icons/book-open';
  import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
  import UsersIcon from '@lucide/svelte/icons/users';
  import XIcon from '@lucide/svelte/icons/x';
  import { t } from '$lib/utils/functions/translations';
  import { isSelfEnrollmentAllowed } from '@cio/utils/functions';
  import { CourseApi } from '$features/course/api/course.svelte';
  import type { RecommendedCourses } from '$features/course/types';

  interface Props {
    course: RecommendedCourses[number];
    open: boolean;
  }

  let { course, open = $bindable(false) }: Props = $props();

  type CourseMetadata = {
    allowSelfEnrollment?: boolean;
    allowNewStudent?: boolean;
    requirements?: string;
  };

  const metadata = $derived(course.metadata as CourseMetadata | null);
  const selfEnrollmentAllowed = $derived(isSelfEnrollmentAllowed(metadata));
  const requirements = $derived(metadata?.requirements?.trim() || null);
  const enrollmentApi = new CourseApi();
  let joining = $state(false);
  let enrollmentFailed = $state(false);
  const CoverIcon = $derived(
    course.type === 'COMPLIANCE' ? ShieldCheckIcon : course.type === 'LIVE_CLASS' ? UsersIcon : BookOpenIcon
  );

  async function handleJoinCourse() {
    if (joining || !selfEnrollmentAllowed) return;

    joining = true;
    enrollmentFailed = false;

    try {
      const result = await enrollmentApi.enroll(course.id);
      if (!result?.success) {
        enrollmentFailed = true;
        return;
      }

      await goto(`/courses/${course.id}/lessons?next=true`);
    } catch {
      enrollmentFailed = true;
    } finally {
      joining = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0" showCloseButton={false}>
    <div class="relative shrink-0 overflow-hidden">
      {#if course.logo}
        <img src={course.logo} alt={course.title} class="aspect-video w-full object-cover" />
      {:else}
        <div class="course-cover aspect-video" data-course-type={course.type}>
          <CoverIcon class="course-cover-icon" aria-hidden="true" />
        </div>
      {/if}
      <Dialog.Close
        class="ui:bg-secondary ui:text-secondary-foreground ui:hover:bg-secondary/80 absolute top-3 right-3 inline-flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors"
      >
        <XIcon class="size-4" />
        <span class="sr-only">{$t('app.cancel')}</span>
      </Dialog.Close>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
      <Dialog.Title class="text-xl font-semibold tracking-tight">{course.title}</Dialog.Title>
      <Dialog.Description class="sr-only">{$t('lms_navigation.explore')}</Dialog.Description>

      {#if course.description}
        <p class="ui:text-muted-foreground mt-2 text-sm leading-relaxed">{course.description}</p>
      {/if}

      <div class="ui:text-muted-foreground mt-4 flex flex-wrap items-center gap-4 text-sm">
        <span class="flex items-center gap-1.5">
          <BookOpenIcon class="size-4" />
          {course.lessonCount ?? 0}
          {$t('courses.course_card.lessons_number')}
        </span>
        <span>
          {course.exerciseCount ?? 0}
          {$t('courses.course_card.exercise')}
        </span>
      </div>

      {#if requirements}
        <div class="mt-4">
          <h3 class="text-sm font-semibold">{$t('course.navItem.landing_page.requirement')}</h3>
          <HTMLRender className="text-sm mt-1" disableMaxWidth={true}>
            <SafeHtmlContent content={requirements} />
          </HTMLRender>
        </div>
      {/if}
    </div>

    {#if enrollmentFailed}
      <p class="ui:text-destructive px-6 pb-3 text-sm" role="alert">{$t('snackbar.invite.failed_join')}</p>
    {/if}
    {#if !selfEnrollmentAllowed}
      <p class="ui:text-muted-foreground px-6 pb-3 text-sm">
        {$t('course.navItem.landing_page.pricing_section.not_accepting')}
      </p>
    {/if}
    <Dialog.Footer class="shrink-0 border-t px-6 py-4">
      <Button variant="outline" size="sm" onclick={() => (open = false)}>
        {$t('app.cancel')}
      </Button>
      <Button onclick={handleJoinCourse} size="sm" loading={joining} disabled={joining || !selfEnrollmentAllowed}>
        {$t('course.navItem.landing_page.pricing_section.enroll')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
