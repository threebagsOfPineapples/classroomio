<script lang="ts">
  import * as DropdownMenu from '@cio/ui/base/dropdown-menu';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { copyCourseModal, deleteCourseModal } from '$features/course/utils/store';
  import { copyInternalCourseUrl, openCoursePreview } from '$features/course/utils/course-preview';
  import { isOrgTeamMember } from '$lib/utils/store/org';
  import { t } from '$lib/utils/functions/translations';
  import { goAndHighlight } from '$lib/routing/go-and-highlight';
  import { ROUTE_NAME, ROUTE_SECTIONS } from '$lib/routing/routes';

  interface Props {
    id: string;
    title: string;
    description: string;
    isPublished?: boolean;
    courseType?: string | null;
    slug?: string;
    /** Compact menu for LMS course cards */
    lmsPublicQuickOnly?: boolean;
    /** List view includes an explicit Open action */
    includeOpen?: boolean;
    /** Hide org management actions (clone, share, invite, delete) */
    hideOrgActions?: boolean;
  }

  let {
    id,
    title,
    description,
    isPublished = false,
    slug = '',
    lmsPublicQuickOnly = false,
    includeOpen = false,
    hideOrgActions = false
  }: Props = $props();

  const courseSettingsPath = $derived(resolve(`/courses/${id}/settings`, {}));

  function redirect(url: string) {
    goto(resolve(url, {}));
  }

  function scrollToSettingsSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleShareCourse() {
    if (page.url.pathname === courseSettingsPath) {
      scrollToSettingsSection('share');
      return;
    }

    redirect(`/courses/${id}/settings#share`);
  }

  function handleInvite() {
    redirect(`/courses/${id}/people?add=true`);
  }

  function handlePublishCourse() {
    goAndHighlight(ROUTE_NAME.COURSE_SETTINGS, ROUTE_SECTIONS[ROUTE_NAME.COURSE_SETTINGS].PUBLISH, { id });
  }

  function handleDeleteCourse() {
    if (page.url.pathname === courseSettingsPath) {
      scrollToSettingsSection('delete');
      return;
    }

    const isOnOrgCoursesList = /\/org\/[^/]+\/courses\/?$/.test(page.url.pathname);
    if (isOnOrgCoursesList) {
      $deleteCourseModal.open = true;
      $deleteCourseModal.id = id;
      $deleteCourseModal.title = title;
      return;
    }

    redirect(`/courses/${id}/settings#delete`);
  }

  function handleCloneCourse() {
    $copyCourseModal.open = true;
    $copyCourseModal.id = id;
    $copyCourseModal.title = title;
    $copyCourseModal.description = description;
  }

  function handleOpenCourse() {
    redirect(`/courses/${id}`);
  }

  function handleViewCourseSite() {
    openCoursePreview({
      courseId: id,
      courseSlug: slug
    });
  }

  async function handleCopyCourseUrl() {
    await copyInternalCourseUrl(id);
  }
</script>

{#if lmsPublicQuickOnly}
  <DropdownMenu.Item onclick={handleOpenCourse}>
    {$t('courses.course_card.context_menu.open')}
  </DropdownMenu.Item>
  <DropdownMenu.Item onclick={() => void handleCopyCourseUrl()}>
    {$t('courses.course_card.context_menu.copy_course_url')}
  </DropdownMenu.Item>
{:else}
  {#if $isOrgTeamMember}
    <DropdownMenu.Item onclick={handleViewCourseSite}>
      {$t('enterprise.course.preview_title')}
    </DropdownMenu.Item>
  {/if}
  <DropdownMenu.Item onclick={() => void handleCopyCourseUrl()}>
    {$t('courses.course_card.context_menu.copy_course_url')}
  </DropdownMenu.Item>
  {#if !isPublished && !hideOrgActions}
    <DropdownMenu.Item onclick={handlePublishCourse}>
      {$t('courses.course_card.context_menu.publish_course')}
    </DropdownMenu.Item>
  {/if}
  <DropdownMenu.Separator />

  {#if includeOpen}
    <DropdownMenu.Item onclick={handleOpenCourse}>
      {$t('courses.course_card.context_menu.open')}
    </DropdownMenu.Item>
  {/if}

  {#if !hideOrgActions}
    <DropdownMenu.Item onclick={handleCloneCourse}>
      {$t('courses.course_card.context_menu.clone')}
    </DropdownMenu.Item>
    <DropdownMenu.Item onclick={handleShareCourse}>
      {$t('courses.course_card.context_menu.share')}
    </DropdownMenu.Item>
    <DropdownMenu.Item onclick={handleInvite}>
      {$t('courses.course_card.context_menu.invite')}
    </DropdownMenu.Item>
    <DropdownMenu.Separator />
    <DropdownMenu.Item class="text-red-600" onclick={handleDeleteCourse}>
      {$t('courses.course_card.context_menu.delete')}
    </DropdownMenu.Item>
  {/if}
{/if}
