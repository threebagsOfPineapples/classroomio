<script lang="ts">
  import * as ResourceListRow from '@cio/ui/custom/resource-list-row';
  import * as DropdownMenu from '@cio/ui/base/dropdown-menu';
  import { Badge } from '@cio/ui/base/badge';
  import { Button } from '@cio/ui/base/button';
  import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
  import BookOpenIcon from '@lucide/svelte/icons/book-open';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { Image } from '$features/ui';
  import { isOrgTeamMember } from '$lib/utils/store/org';
  import { isStudentExperience } from '$lib/utils/store/app';
  import { locale, t } from '$lib/utils/functions/translations';
  import CoursePublicBadge from './course-public-badge.svelte';
  import CourseContextMenuContent from './course-context-menu-content.svelte';

  interface Tag {
    id: string;
    name: string;
    slug: string;
    color?: string | null;
  }

  type ColumnKey = 'published' | 'tags' | 'students' | 'actions';

  const COLUMN_TRACKS: [string, string][] = [
    ['banner', '3rem'],
    ['title', 'minmax(0, 3fr)'],
    ['published', '5.5rem'],
    ['tags', 'minmax(0, 1fr)'],
    ['content', '5.5rem'],
    ['students', '5rem'],
    ['actions', '10rem']
  ];

  interface Props {
    id: string;
    slug?: string;
    title: string;
    logo?: string | null;
    type?: string | null;
    description?: string;
    isPublished?: boolean;
    status?: string | null;
    lessonCount?: number;
    exerciseCount?: number;
    totalStudents?: number;
    updatedAt?: string | null;
    tags?: Tag[];
    isExplore?: boolean;
    isLMS?: boolean;
    hiddenColumns?: ColumnKey[];
    onExploreClick?: () => void;
  }

  let {
    id,
    slug = '',
    title,
    logo = null,
    type,
    description = '',
    isPublished = false,
    status = null,
    lessonCount = 0,
    exerciseCount = 0,
    totalStudents = 0,
    updatedAt,
    tags = [],
    isExplore = false,
    isLMS = false,
    hiddenColumns = [],
    onExploreClick
  }: Props = $props();

  const bannerImage = $derived(logo?.trim() || null);

  const showPublicCourseLinks = $derived(isPublished && type === 'PUBLIC' && slug.trim().length > 0);

  const hidden = $derived(new Set<string>(hiddenColumns));

  const MAX_VISIBLE_TAGS = 3;
  const MAX_MOBILE_VISIBLE_TAGS = 2;
  const visibleTags = $derived(tags.slice(0, MAX_VISIBLE_TAGS));
  const visibleMobileTags = $derived(tags.slice(0, MAX_MOBILE_VISIBLE_TAGS));
  const remainingTagCount = $derived(Math.max(0, tags.length - MAX_VISIBLE_TAGS));
  const remainingMobileTagCount = $derived(Math.max(0, tags.length - MAX_MOBILE_VISIBLE_TAGS));

  const showActionsColumn = $derived(
    !hidden.has('actions') && (!isLMS || (isLMS && showPublicCourseLinks) || (isLMS && isExplore))
  );

  const gridTemplateColumns = $derived(
    COLUMN_TRACKS.filter(([key]) => {
      if (hidden.has(key)) return false;
      if (key === 'actions') return showActionsColumn;
      return true;
    })
      .map(([, track]) => track)
      .join(' ')
  );

  const typeLabel = $derived(
    type === 'PUBLIC'
      ? $t('enterprise.course.legacy_public')
      : type
        ? $t(`course.navItem.settings.${type.toLowerCase()}`)
        : null
  );

  const updatedDateString = $derived.by(() => {
    if (!updatedAt) return null;
    const parsedDate = new Date(updatedAt);
    if (isNaN(parsedDate.getTime())) return null;
    return parsedDate.toLocaleDateString($locale || 'en', { month: 'short', day: 'numeric', year: 'numeric' });
  });

  const updatedLabel = $derived(
    updatedDateString ? $t('courses.course_card.updated_at', { date: updatedDateString }) : null
  );

  const courseUrl = $derived.by(() => {
    if (isExplore && onExploreClick) {
      return undefined;
    }

    if (isLMS) {
      return resolve(`/courses/${id}/lessons?next=true`, {});
    }

    return resolve(`/courses/${id}`, {});
  });

  function handleRowClick() {
    if (isExplore && onExploreClick) {
      onExploreClick();
      return;
    }

    if (!courseUrl) {
      return;
    }

    goto(courseUrl);
  }

  function stopRowNavigation(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  function openCourseProgress(event: MouseEvent) {
    stopRowNavigation(event);
    goto(resolve(`/courses/${id}/analytics`, {}));
  }
</script>

{#snippet tagBadge(tag: Tag)}
  <Badge variant="outline" class="max-w-35 truncate rounded-full px-2! text-xs! font-medium">
    <span
      class="ui:bg-primary/60 inline-block size-1.5 shrink-0 rounded-full"
      style={tag.color ? `background-color: ${tag.color}` : undefined}
      aria-hidden="true"
    ></span>
    {tag.name}
  </Badge>
{/snippet}

{#snippet overflowBadge(count: number)}
  <Badge variant="secondary" class="shrink-0 px-2! text-xs! font-medium tabular-nums">
    +{count}
  </Badge>
{/snippet}

{#snippet publishedBadge()}
  <Badge
    variant={status !== 'ARCHIVED' && isPublished ? 'success' : 'secondary'}
    class="px-2! text-xs! whitespace-nowrap"
  >
    {status === 'ARCHIVED'
      ? $t('course.navItem.settings.enterprise.archived')
      : isPublished
        ? $t('courses.course_card.published')
        : $t('courses.course_card.unpublished')}
  </Badge>
{/snippet}

{#snippet courseCover()}
  <div class="ui:bg-accent ui:text-primary flex h-full w-full items-center justify-center">
    <BookOpenIcon class="size-5" aria-hidden="true" />
  </div>
{/snippet}

{#snippet rowContent()}
  <div
    class="grid w-full grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-3 @3xl:grid-cols-(--row-cols) @3xl:gap-y-0"
    style="--row-cols: {gridTemplateColumns}"
  >
    <!-- Column 1: Banner -->
    <div
      class="ui:border-border ui:bg-muted relative size-11 shrink-0 overflow-hidden rounded-md border @3xl:size-12"
      aria-hidden="true"
    >
      {#if bannerImage}
        <Image src={bannerImage} alt="" className="h-full w-full object-cover" fallback={courseCover} />
      {:else}
        {@render courseCover()}
      {/if}
    </div>

    <!-- Mobile Middle Content (flex-1) / Desktop Columns 2-6 (@3xl:contents) -->
    <div class="flex min-w-0 flex-1 flex-col @3xl:contents">
      <!-- Column 2: Title & Subtitle -->
      <div class="flex min-w-0 flex-col gap-0.5">
        <div class="flex min-w-0 items-start gap-1.5">
          {#if courseUrl}
            <a
              href={courseUrl}
              class="ui:text-foreground ui:hover:text-primary line-clamp-2 min-w-0 flex-1 text-sm leading-6 font-medium wrap-break-word @3xl:text-base"
            >
              {title}
            </a>
          {:else}
            <Button
              variant="link"
              class="ui:text-foreground h-auto min-w-0 flex-1 justify-start p-0 text-left text-sm leading-6 whitespace-normal @3xl:text-base"
              onclick={handleRowClick}
            >
              <span class="line-clamp-2">{title}</span>
            </Button>
          {/if}
          {#if type === 'PUBLIC'}
            <CoursePublicBadge class="shrink-0 px-2! text-xs!" />
          {/if}
        </div>

        {#if !hidden.has('published')}
          <div class="mt-1 @3xl:hidden">
            {@render publishedBadge()}
          </div>
        {/if}

        <!-- Mobile Tags (below Title on mobile) -->
        {#if !hidden.has('tags') && tags.length > 0}
          <div class="mt-1 mb-1 flex flex-wrap items-center gap-1 @3xl:hidden">
            {#each visibleMobileTags as tag (tag.id)}
              {@render tagBadge(tag)}
            {/each}
            {#if remainingMobileTagCount > 0}
              {@render overflowBadge(remainingMobileTagCount)}
            {/if}
          </div>
        {/if}

        <!-- Mobile Subtitle (type & updated) -->
        {#if typeLabel || updatedLabel}
          <div class="ui:text-muted-foreground mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs @3xl:hidden">
            {#if typeLabel}<span class="whitespace-nowrap">{typeLabel}</span>{/if}
            {#if updatedLabel}<span class="whitespace-nowrap">{updatedLabel}</span>{/if}
          </div>
        {/if}

        <!-- Desktop Subtitle (type & updated) -->
        <div class="hidden @3xl:block">
          {#if typeLabel}
            <p class="ui:text-muted-foreground mt-0.5 text-sm">{typeLabel}</p>
          {/if}
          {#if updatedLabel}
            <p class="ui:text-muted-foreground mt-0.5 text-xs">{updatedLabel}</p>
          {/if}
        </div>
      </div>

      <!-- Column 3: Published Badge -->
      {#if !hidden.has('published')}
        <div class="hidden @3xl:block">
          {@render publishedBadge()}
        </div>
      {/if}

      <!-- Column 4: Tags -->
      {#if !hidden.has('tags')}
        <div class="hidden min-w-0 flex-wrap items-center gap-1 @3xl:flex">
          {#if tags.length === 0}
            <span class="ui:text-muted-foreground text-xs">—</span>
          {:else}
            {#each visibleTags as tag (tag.id)}
              {@render tagBadge(tag)}
            {/each}
            {#if remainingTagCount > 0}
              {@render overflowBadge(remainingTagCount)}
            {/if}
          {/if}
        </div>
      {/if}

      <!-- Mobile Metrics Row / Desktop Columns 5-6 (@3xl:contents) -->
      <div class="mt-2 flex flex-wrap items-center gap-3 text-xs @3xl:mt-0 @3xl:contents">
        <div class="flex items-center gap-3 tabular-nums @3xl:flex-col @3xl:items-start @3xl:gap-1">
          <p class="ui:text-muted-foreground text-xs @3xl:text-sm">
            <span class="font-medium">{lessonCount}</span>
            {$t('courses.course_card.lessons_number')}
          </p>
          <p class="ui:text-muted-foreground text-xs @3xl:text-sm">
            <span class="font-medium">{exerciseCount}</span>
            {$t('courses.course_card.exercise')}
          </p>
        </div>

        {#if !hidden.has('students')}
          <p class="ui:text-muted-foreground text-xs tabular-nums @3xl:text-sm">
            <span class="font-medium">{totalStudents}</span>
            {$t('enterprise.role_employee')}
          </p>
        {/if}
      </div>
    </div>

    <!-- Column 7: Actions -->
    {#if showActionsColumn}
      <div class="col-start-2 flex shrink-0 items-center justify-end gap-2 @3xl:col-start-auto">
        {#if isLMS && isExplore}
          <Button
            variant="outline"
            size="sm"
            onclick={(event) => {
              stopRowNavigation(event);
              onExploreClick?.();
            }}
          >
            {$t('courses.course_card.learn_more')}
          </Button>
        {:else}
          {#if !isLMS && !isExplore && $isOrgTeamMember && !$isStudentExperience}
            <Button variant="outline" size="sm" onclick={openCourseProgress}>
              {$t('enterprise.course.student_progress')}
            </Button>
          {/if}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  variant="secondary"
                  size="icon"
                  class="ui:text-muted-foreground ui:hover:text-foreground size-8 p-1"
                  aria-label={$t('courses.course_card.actions_menu_aria')}
                >
                  <EllipsisVerticalIcon class="size-4" aria-hidden="true" />
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              {#if isLMS}
                <CourseContextMenuContent
                  {id}
                  {title}
                  {description}
                  {isPublished}
                  courseType={type}
                  {slug}
                  lmsPublicQuickOnly={true}
                />
              {:else}
                <CourseContextMenuContent
                  {id}
                  {title}
                  {description}
                  {isPublished}
                  courseType={type}
                  {slug}
                  includeOpen={true}
                  hideOrgActions={false}
                />
              {/if}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        {/if}
      </div>
    {/if}
  </div>
{/snippet}

<ResourceListRow.Root variant="default" size="sm" align="start" class="px-4! py-4!">
  {@render rowContent()}
</ResourceListRow.Root>
