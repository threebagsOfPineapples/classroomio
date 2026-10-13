<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';
  import { currentOrg } from '$lib/utils/store/org';
  import { t } from '$lib/utils/functions/translations';
  import { Button } from '@cio/ui/base/button';
  import { InputField } from '@cio/ui/custom/input-field';
  import { ScrollToTop } from '@cio/ui/custom/scroll-to-top';
  import * as Page from '@cio/ui/base/page';
  import { MentorshipApi } from '../api/mentorship.svelte';
  import MentorshipSelect from './mentorship-select.svelte';
  import MentorshipManagement from './mentorship-management.svelte';
  import MentorshipDetail from './mentorship-detail.svelte';
  import { formatMentorshipDate } from '../utils/mentorship-utils';
  import type { MentorshipState } from '../utils/types';

  let { management = false }: { management?: boolean } = $props();
  const api = new MentorshipApi();
  const states: MentorshipState[] = [
    'LEARNER_PENDING',
    'MENTOR_PENDING',
    'RETURNED',
    'SUPERVISOR_PENDING',
    'READY_TO_CERTIFY',
    'CERTIFIED'
  ];
  const stateOptions = $derived(states.map((state) => ({ value: state, label: $t(`mentorship.state.${state}`) })));

  $effect(() => {
    const organizationId = $currentOrg.id;
    const taskId = page.params.taskId ?? page.url.searchParams.get('taskId') ?? '';
    untrack(() => void api.openContext(organizationId ?? '', taskId));
  });
</script>

<Page.Root class="mx-auto w-full max-w-7xl px-4 sm:px-6" data-testid="mentorship-workbench">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>{$t(management ? 'mentorship.admin_title' : 'mentorship.my_title')}</Page.Title>
      <Page.Subtitle>{$t('mentorship.subtitle')}</Page.Subtitle>
    </Page.HeaderContent>
    <div class="flex flex-wrap gap-2">
      <Button variant="secondary" onclick={() => api.load()} disabled={api.loading || api.busy}
        >{$t('mentorship.refresh')}</Button
      >
      <Button variant="outline" onclick={() => api.exportCsv()} disabled={api.loading || api.busy}
        >{$t('mentorship.export')}</Button
      >
    </div>
  </Page.Header>
  <Page.Body>
    {#snippet child()}
      <div class="space-y-6 pb-8">
        {#if api.error || api.errors.general}<p
            role="alert"
            class="ui:border-destructive ui:text-destructive rounded-lg border p-4 text-sm"
          >
            {api.errors.general || $t('mentorship.failed')}
          </p>{/if}
        {#if api.notice}<p role="status" class="ui:bg-muted rounded-lg p-4 text-sm">{api.notice}</p>{/if}
        {#if api.loading || api.detailLoading}<p role="status" class="ui:text-muted-foreground py-4">
            {$t('mentorship.loading')}
          </p>{/if}
        {#if management && api.options?.canManage}<MentorshipManagement {api} />{/if}
        {#if management && api.options && !api.options.canManage}<p class="ui:bg-muted rounded-lg p-4 text-sm">
            {$t('mentorship.read_only')}
          </p>{/if}

        <section class="space-y-4" aria-labelledby="mentorship-queue-title">
          <h2 id="mentorship-queue-title" class="text-lg font-semibold">
            {$t('mentorship.queue')} ({api.tasks.length})
          </h2>
          <div class="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <MentorshipSelect
              label={$t('mentorship.state_filter')}
              bind:value={api.filterState}
              options={stateOptions}
              placeholder={$t('mentorship.all_states')}
              disabled={api.busy}
            />
            <InputField
              name="mentorship-filter-due-before"
              label={$t('mentorship.due_before')}
              type="datetime-local"
              bind:value={api.dueBefore}
              isDisabled={api.busy}
            />
            <Button onclick={() => api.load()} disabled={api.busy || api.loading}>{$t('mentorship.filter')}</Button>
          </div>
          {#if !api.loading && api.tasks.length === 0}<div
              class="ui:border-border ui:text-muted-foreground rounded-lg border p-8 text-center"
            >
              {$t('mentorship.empty')}
            </div>{/if}
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {#each api.tasks as row (row.task.id)}
              <article class="ui:border-border flex flex-col rounded-lg border p-4">
                <div class="flex flex-wrap items-center gap-2 text-xs">
                  <span class="ui:bg-muted rounded-md px-2 py-1">{$t(`mentorship.state.${row.task.state}`)}</span>
                  {#if row.overdue}<span class="ui:text-destructive">{$t('mentorship.overdue')}</span>{/if}
                  {#if !row.relationshipEffective}<span class="ui:text-destructive"
                      >{$t('mentorship.relationship_exception')}</span
                    >{/if}
                </div>
                <h3 class="mt-3 font-semibold break-words">{row.task.title}</h3>
                <p class="mt-2 text-sm">
                  {row.learnerName ?? row.relation.learnerMemberId} · {$t('mentorship.mentor')}: {row.mentorName ??
                    row.relation.mentorMemberId}
                </p>
                <p class="ui:text-muted-foreground mt-2 mb-4 text-sm">
                  {$t('mentorship.due_at')}: {formatMentorshipDate(row.task.dueAt)}
                </p>
                <Button
                  variant={api.detail?.task.id === row.task.id ? 'default' : 'secondary'}
                  class="mt-auto w-full"
                  onclick={() => api.selectTask(row.task.id)}
                  disabled={api.busy}>{$t('mentorship.open_task')}</Button
                >
              </article>
            {/each}
          </div>
        </section>
        <MentorshipDetail {api} />
      </div>
    {/snippet}
  </Page.Body>
</Page.Root>
<ScrollToTop label={$t('common.scroll_to_top')} />
