<script lang="ts">
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import * as Table from '@cio/ui/base/table';
  import * as DropdownMenu from '@cio/ui/base/dropdown-menu';
  import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';

  import { isMobileStore } from '@cio/ui/hooks/is-mobile.svelte';
  import { t } from '$lib/utils/functions/translations';
  import CourseContextMenuContent from './course-context-menu-content.svelte';
  import CoursePublishBadge from './course-publish-badge.svelte';
  import CourseTagsOverflow from './course-tags-overflow.svelte';

  interface Props {
    id?: string;
    slug?: string;
    title?: string;
    type?: string;
    description?: string;
    isPublished?: boolean;
    totalLessons?: number;
    totalStudents?: number;
    isExplore?: boolean;
    isLMS?: boolean;
    href?: string;
    showActions?: boolean;
    tags?: Array<{
      id: string;
      name: string;
      slug: string;
      color?: string | null;
    }>;
  }

  let {
    id = '',
    slug = '',
    title = '',
    type = '',
    description = '',
    isPublished = false,
    totalLessons = 0,
    totalStudents = 0,
    isExplore = false,
    isLMS = false,
    href,
    showActions = true,
    tags = []
  }: Props = $props();

  function handleRowClick() {
    if (href) {
      goto(resolve(href, {}));
      return;
    }

    if (isExplore) {
      goto(resolve(`/courses/${id}`, {}));
      return;
    }

    if (isLMS) {
      goto(resolve(`/courses/${id}/lessons?next=true`, {}));
      return;
    }

    goto(resolve(`/courses/[id]`, { id }));
  }
</script>

<Table.Row class="cursor-pointer" onclick={handleRowClick}>
  <Table.Cell class="truncate"><p class="font-semibold">{title}</p></Table.Cell>
  <Table.Cell class="truncate">
    <p>{description}</p>
  </Table.Cell>
  {#if !isMobileStore.current}
    <Table.Cell class="truncate"
      >{type === 'PUBLIC'
        ? $t('enterprise.course.legacy_public')
        : $t(`course.navItem.settings.${type.toLowerCase()}`)}</Table.Cell
    >
    <Table.Cell class="w-3/12 min-w-0">
      {#if tags.length === 0}
        <span class="ui:text-muted-foreground text-2xs">-</span>
      {:else}
        <CourseTagsOverflow {tags} variant="table" />
      {/if}
    </Table.Cell>
    <Table.Cell>{totalLessons}</Table.Cell>
    {#if !isLMS}
      <Table.Cell>{totalStudents}</Table.Cell>
      <Table.Cell>
        <CoursePublishBadge {isPublished} />
      </Table.Cell>
    {/if}
  {/if}
  {#if !isLMS && showActions}
    <Table.Cell class="text-center">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          class="flex items-center justify-center rounded-md p-1 hover:bg-gray-100"
          onclick={(e) => e.stopPropagation()}
        >
          <EllipsisVerticalIcon size={16} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" onclick={(event) => event.stopPropagation()}>
          <CourseContextMenuContent {id} {title} {description} {isPublished} />
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </Table.Cell>
  {/if}
</Table.Row>
