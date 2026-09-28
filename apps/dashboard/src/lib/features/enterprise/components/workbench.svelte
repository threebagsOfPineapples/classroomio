<script lang="ts">
  import { untrack } from 'svelte';
  import { Button } from '@cio/ui/base/button';
  import { Progress } from '@cio/ui/base/progress';
  import { Badge } from '@cio/ui/base/badge';
  import { t, locale } from '$lib/utils/functions/translations';
  import { currentOrg } from '$lib/utils/store/org';
  import { AssessmentApi } from '../api/assessment.svelte';
  import { trainingPlansApi } from '../api/training-plans.svelte';
  import { getGradingWorkbenchQueue, getPlanCompletion, getTrainingWorkbenchPlans } from '../utils/training-workbench';
  import type { EnterpriseOverview } from '../utils/types';

  let { overview }: { overview: EnterpriseOverview } = $props();
  const statisticsApi = new AssessmentApi();
  const archiveApi = new AssessmentApi();
  const queueApi = new AssessmentApi();
  let loadedFor = '';
  let planFilter = $state('all');
  let queueFilter = $state<'all' | 'assignments' | 'written'>('all');
  const statistics = $derived(statisticsApi.error || statisticsApi.loading ? null : statisticsApi.statistics);
  const groupedPlans = $derived(getTrainingWorkbenchPlans(trainingPlansApi.plans, Date.now()));
  const visiblePlans = $derived(
    planFilter === 'all' ? trainingPlansApi.plans : groupedPlans[planFilter as keyof typeof groupedPlans]
  );
  const queue = $derived(getGradingWorkbenchQueue(queueApi.gradingQueue));
  const scoredCount = $derived(
    archiveApi.error || archiveApi.loading
      ? null
      : archiveApi.archive.filter((record) => record.finalScore !== null).length
  );
  const planFilters = ['active', 'upcoming', 'dueSoon', 'all'];
  const queueFilters = ['all', 'assignments', 'written'] as const;

  $effect(() => {
    const organizationId = $currentOrg.id;
    const canManage = overview.canManage;
    const key = organizationId + ':' + canManage;
    if (!organizationId || loadedFor === key) return;

    loadedFor = key;
    untrack(() => {
      void statisticsApi.loadStatistics(organizationId);
      void archiveApi.loadArchive(organizationId);
      if (canManage) {
        void trainingPlansApi.load(organizationId);
        void queueApi.loadGradingQueue(organizationId);
      }
    });
  });

  function dateLabel(value: string) {
    return new Date(value).toLocaleDateString($locale === 'zh' ? 'zh-CN' : $locale);
  }

  function timeLabel(value: string | null) {
    if (!value || !Number.isFinite(Date.parse(value))) return '—';

    return new Date(value).toLocaleString($locale === 'zh' ? 'zh-CN' : $locale, {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

{#snippet retry(action: () => void)}
  <div class="training-empty" role="alert">
    <p>{$t('enterprise.load_failed')}</p>
    <Button variant="outline" size="sm" onclick={action}>{$t('enterprise.ui_v2.retry')}</Button>
  </div>
{/snippet}
{#snippet metric(label: string, value: string | number | null | undefined, unit: string, note: string)}
  <section class="training-panel workbench-metric">
    <p>{$t(label)}</p>
    <strong>{value ?? '—'}<small>{unit}</small></strong><span>{note}</span>
  </section>
{/snippet}

<div class="workbench-v2 space-y-5">
  <div class="workbench-kpis">
    {@render metric(
      'enterprise.assessment.learners',
      statistics?.learners,
      $t('enterprise.ui_v2.person_unit'),
      $t('enterprise.ui_v2.learners_basis')
    )}
    {@render metric(
      'enterprise.assessment.completion_rate',
      statistics?.completionRate,
      '%',
      $t('enterprise.ui_v2.completion_basis', {
        completed: statistics?.completed ?? '—',
        assigned: statistics?.assigned ?? '—'
      })
    )}
    {@render metric(
      'enterprise.assessment.pass_rate',
      statistics?.passRate,
      '%',
      $t('enterprise.ui_v2.pass_basis', { passed: statistics?.passed ?? '—', scored: scoredCount ?? '—' })
    )}
    {@render metric(
      'enterprise.assessment.average_score',
      statistics?.averageScore,
      $t('enterprise.ui_v2.score_unit'),
      $t('enterprise.ui_v2.score_basis', { scored: scoredCount ?? '—' })
    )}
  </div>
  {#if statisticsApi.error}{@render retry(() => void statisticsApi.loadStatistics($currentOrg.id))}{/if}
  <div class="workbench-todo-strip">
    <strong>{$t('enterprise.ui_v2.grading_total')}</strong><span
      >{!overview.canManage || queueApi.gradingQueueLoading || queueApi.gradingQueueError
        ? '—'
        : queue.all.length}</span
    >
    <p>{$t('enterprise.ui_v2.grading_dedup_note')}</p>
  </div>
  <div class="workbench-columns">
    <div class="min-w-0 space-y-5">
      <section class="training-panel workbench-table-panel">
        <div class="workbench-panel-heading">
          <h2>{$t('enterprise.plans.title')}</h2>
          {#if overview.canManage}<Button href="/admin/plans" variant="link" size="sm"
              >{$t('dashboard.view_more')}</Button
            >{/if}
        </div>
        {#if overview.canManage}
          <div class="training-filters px-5 pb-3" aria-label={$t('enterprise.ui_v2.plan_filter')}>
            {#each planFilters as filter}<Button
                variant="ghost"
                size="sm"
                aria-pressed={planFilter === filter}
                onclick={() => (planFilter = filter)}>{$t('enterprise.ui_v2.plans_' + filter)}</Button
              >{/each}
          </div>
        {/if}
        {#if !overview.canManage}<div class="training-empty"><p>{$t('enterprise.ui_v2.plan_permission')}</p></div>
        {:else if trainingPlansApi.loading}<div class="training-empty" aria-busy="true">{$t('enterprise.loading')}</div>
        {:else if trainingPlansApi.error}{@render retry(() => void trainingPlansApi.load($currentOrg.id))}
        {:else if visiblePlans.length}
          <div class="workbench-table-scroll">
            <table>
              <thead
                ><tr
                  ><th>{$t('enterprise.plans.title')}</th><th>{$t('enterprise.ui_v2.period')}</th><th
                    >{$t('enterprise.status')}</th
                  ><th>{$t('enterprise.ui_v2.plan_completion')}</th><th>{$t('enterprise.ui_v2.action')}</th></tr
                ></thead
              ><tbody>
                {#each visiblePlans as plan (plan.id)}
                  {@const completion = getPlanCompletion(archiveApi.archive, plan.id)}
                  <tr
                    ><td
                      ><strong class="workbench-plan-name">{plan.name}</strong>
                      <p class="ui:text-muted-foreground text-xs">{plan.code}</p></td
                    ><td class="text-xs whitespace-nowrap">{dateLabel(plan.startAt)}<br />{dateLabel(plan.endAt)}</td
                    ><td
                      ><Badge variant="outline">{$t('enterprise.plans.status_' + plan.status.toLowerCase())}</Badge></td
                    ><td>
                      {#if archiveApi.loading || archiveApi.error}<span>—</span>{:else if completion.assigned}<div
                          class="workbench-plan-progress"
                        >
                          <p>{completion.completed} / {completion.assigned}</p>
                          <Progress value={completion.percent ?? 0} />
                        </div>{:else}<span class="ui:text-muted-foreground text-xs"
                          >{$t('enterprise.ui_v2.no_assignments')}</span
                        >{/if}
                    </td><td
                      ><Button href={'/admin/plans?planId=' + plan.id} variant="link" size="sm"
                        >{$t('enterprise.ui_v2.details')}</Button
                      ></td
                    ></tr
                  >
                {/each}
              </tbody>
            </table>
          </div>
        {:else}<div class="training-empty">
            <h3>{$t('enterprise.ui_v2.no_plans')}</h3>
            <p>{$t('enterprise.ui_v2.no_plans_hint')}</p>
            <Button size="sm" variant="outline" href="/admin/plans">{$t('enterprise.ui_v2.new_plan')}</Button>
          </div>{/if}
      </section>
      <section class="training-panel workbench-table-panel">
        <div class="workbench-panel-heading">
          <h2>{$t('enterprise.ui_v2.grading_total')}</h2>
          {#if overview.canManage}<Button href="/admin/assessment" variant="link" size="sm"
              >{$t('enterprise.assessment.title')}</Button
            >{/if}
        </div>
        {#if overview.canManage}
          <div class="training-filters px-5 pb-3" aria-label={$t('enterprise.ui_v2.grading_filter')}>
            {#each queueFilters as filter}<Button
                variant="ghost"
                size="sm"
                aria-pressed={queueFilter === filter}
                onclick={() => (queueFilter = filter)}
                >{$t('enterprise.ui_v2.queue_' + filter)}
                <span>{queueApi.gradingQueueLoading || queueApi.gradingQueueError ? '—' : queue[filter].length}</span
                ></Button
              >{/each}
          </div>
          {#if queueApi.gradingQueueLoading}<div class="training-empty" aria-busy="true">
              {$t('enterprise.loading')}
            </div>
          {:else if queueApi.gradingQueueError}{@render retry(() => void queueApi.loadGradingQueue($currentOrg.id))}
          {:else if queue[queueFilter].length}
            <div class="workbench-table-scroll">
              <table>
                <thead
                  ><tr
                    ><th>{$t('enterprise.ui_v2.learner')}</th><th>{$t('enterprise.ui_v2.submitted_content')}</th><th
                      >{$t('enterprise.ui_v2.submitted_at')}</th
                    ><th>{$t('enterprise.ui_v2.action')}</th></tr
                  ></thead
                ><tbody>
                  {#each queue[queueFilter] as item (item.id)}<tr
                      ><td>{item.learnerName ?? '—'}</td><td
                        ><strong class="workbench-plan-name">{item.exerciseTitle}</strong>
                        <p class="ui:text-muted-foreground text-xs">{item.courseTitle}</p></td
                      ><td class="text-xs whitespace-nowrap">{timeLabel(item.submittedAt)}</td><td
                        >{#if item.canGrade}<Button
                            variant="outline"
                            size="sm"
                            href={'/courses/' + item.courseId + '/submissions?submissionId=' + item.id}
                            >{$t('enterprise.ui_v2.grade')}</Button
                          >{:else}<span class="ui:text-muted-foreground text-xs"
                            >{$t('enterprise.workbench.instructor_only')}</span
                          >{/if}</td
                      ></tr
                    >{/each}
                </tbody>
              </table>
            </div>
          {:else}<div class="training-empty">
              <h3>{$t('enterprise.ui_v2.no_grading')}</h3>
              <p>{$t('enterprise.ui_v2.no_grading_hint')}</p>
            </div>{/if}
        {:else}<div class="training-empty"><p>{$t('enterprise.ui_v2.grading_permission')}</p></div>{/if}
      </section>
    </div>
    <div class="space-y-5">
      <section class="training-panel space-y-5">
        <h2 class="font-semibold">{$t('enterprise.ui_v2.department_progress')}</h2>
        {#if statisticsApi.loading}<p class="ui:text-muted-foreground text-sm">
            {$t('enterprise.loading')}
          </p>{:else if statisticsApi.error}{@render retry(
            () => void statisticsApi.loadStatistics($currentOrg.id)
          )}{:else}
          {#each statistics?.byDepartment ?? [] as department (department.departmentId)}<div
              class="department-progress-row"
            >
              <div class="mb-2 flex justify-between gap-3 text-sm">
                <span
                  >{overview.departments.find((item) => item.id === department.departmentId)?.name ??
                    $t('enterprise.assessment.not_assigned')}</span
                ><strong>{department.completionRate ?? '—'}%</strong>
              </div>
              <Progress value={department.completionRate ?? 0} />
              <p class="ui:text-muted-foreground mt-2 text-xs">
                {$t('enterprise.ui_v2.completion_basis', {
                  completed: department.completed,
                  assigned: department.assigned
                })}
              </p>
            </div>{:else}<p class="ui:text-muted-foreground text-sm">
              {$t('enterprise.ui_v2.no_department_data')}
            </p>{/each}
          <p class="ui:text-muted-foreground text-xs leading-6">{$t('enterprise.ui_v2.department_note')}</p>
        {/if}
      </section>
      <section class="training-panel space-y-4">
        <h2 class="font-semibold">{$t('enterprise.assessment.unfinished_plans')}</h2>
        {#if statisticsApi.loading}<p class="ui:text-muted-foreground text-sm">
            {$t('enterprise.loading')}
          </p>{:else if statisticsApi.error}{@render retry(
            () => void statisticsApi.loadStatistics($currentOrg.id)
          )}{:else}
          {#each statistics?.unfinishedPlans ?? [] as plan (plan.planId)}<div
              class="flex items-start justify-between gap-3 text-sm"
            >
              <span>{plan.name}</span><strong>{plan.count}</strong>
            </div>{:else}<p class="ui:text-muted-foreground text-sm">{$t('enterprise.ui_v2.no_unfinished')}</p>{/each}
        {/if}
      </section>
      {#if archiveApi.error}<section class="training-panel">
          {@render retry(() => void archiveApi.loadArchive($currentOrg.id))}
        </section>{/if}
    </div>
  </div>
</div>
