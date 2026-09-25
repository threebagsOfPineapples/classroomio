<script module lang="ts">
  function loadChart() {
    if (typeof window === 'undefined') return Promise.reject(new Error('browser-only'));

    return import('@cio/ui/base/chart');
  }
</script>

<script lang="ts">
  import { browser } from '$app/environment';
  import { currentOrg } from '$lib/utils/store/org';
  import { t } from '$lib/utils/functions/translations';
  import { AssessmentApi } from '$lib/features/enterprise/api/assessment.svelte';
  import { enterpriseApi } from '$lib/features/enterprise/api/enterprise.svelte';
  import { Button } from '@cio/ui/base/button';
  import { InputField } from '@cio/ui/custom/input-field';
  import { Progress } from '@cio/ui/base/progress';
  import { ScrollToTop } from '@cio/ui/custom/scroll-to-top';
  import * as Page from '@cio/ui/base/page';
  import type { ChartConfig } from '@cio/ui/base/chart/types';

  const assessmentApi = new AssessmentApi();

  let lastOrganizationId = '';
  let fromDate = $state('');
  let toDate = $state('');

  const departmentChartConfig = $derived({
    completionRate: { label: $t('enterprise.assessment.completion_rate'), color: 'var(--chart-1)' },
    averageScore: { label: $t('enterprise.assessment.average_score'), color: 'var(--chart-2)' }
  } satisfies ChartConfig);
  const departmentSeries = $derived([
    {
      key: 'completionRate',
      value: 'completionRate',
      label: departmentChartConfig.completionRate.label,
      color: 'var(--color-completionRate)'
    }
  ]);
  const departmentScoreSeries = $derived([
    {
      key: 'averageScore',
      value: 'averageScore',
      label: departmentChartConfig.averageScore.label,
      color: 'var(--color-averageScore)'
    }
  ]);
  const departmentChartData = $derived(
    [...(assessmentApi.statistics?.byDepartment ?? [])]
      .sort((left, right) => right.assigned - left.assigned)
      .slice(0, 8)
      .map((department) => ({
        name:
          enterpriseApi.overview?.departments.find((item) => item.id === department.departmentId)?.name ??
          (department.departmentId === 'unassigned'
            ? $t('enterprise.assessment.not_assigned')
            : department.departmentId),
        completionRate: department.completionRate,
        averageScore: department.averageScore
      }))
  );
  const departmentScoreChartData = $derived(
    departmentChartData.filter((department) => department.averageScore !== null)
  );
  const monthlyChartConfig = $derived({
    assigned: { label: $t('enterprise.assessment.training_count'), color: 'var(--chart-2)' },
    completed: { label: $t('enterprise.assessment.completed'), color: 'var(--chart-1)' }
  } satisfies ChartConfig);
  const monthlySeries = $derived([
    { key: 'assigned', value: 'assigned', label: monthlyChartConfig.assigned.label, color: 'var(--color-assigned)' },
    {
      key: 'completed',
      value: 'completed',
      label: monthlyChartConfig.completed.label,
      color: 'var(--color-completed)'
    }
  ]);
  const monthlyChartData = $derived(assessmentApi.statistics?.monthlyTrend.slice(-12) ?? []);
  const planTypeChartData = $derived(
    (assessmentApi.statistics?.byPlanType ?? []).map((type, index) => ({
      key: type.type,
      label: $t(`enterprise.plans.type_${type.type.toLowerCase()}`),
      responses: type.count,
      color: `var(--chart-${(index % 5) + 1})`
    }))
  );

  $effect(() => {
    const organizationId = $currentOrg.id;
    if (!organizationId || organizationId === lastOrganizationId) return;

    lastOrganizationId = organizationId;
    assessmentApi.statistics = null;
    void enterpriseApi.load(organizationId);
    void assessmentApi.loadStatistics(organizationId);
  });

  function refresh() {
    const organizationId = $currentOrg.id;
    if (!organizationId) return;

    void assessmentApi.loadStatistics(organizationId, fromDate || undefined, toDate || undefined);
  }
</script>

<svelte:head>
  <title>{$t('enterprise.assessment.subtitle')}</title>
</svelte:head>

<Page.Root role="main" class="mx-auto max-w-6xl px-6">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>{$t('enterprise.assessment.subtitle')}</Page.Title>
      <Page.Subtitle>{$t('enterprise.assessment.archive')}</Page.Subtitle>
    </Page.HeaderContent>
    <Page.Action>
      <Button href="/admin/matrix" variant="secondary">{$t('enterprise.assessment.matrix')}</Button>
    </Page.Action>
  </Page.Header>
  <Page.Body>
    {#snippet child()}
      {#if assessmentApi.error}<p role="alert" class="rounded-md bg-red-50 p-3 text-red-700">
          {assessmentApi.error}
        </p>{/if}
      {#if assessmentApi.loading}<p>{$t('enterprise.loading')}</p>{/if}
      <div class="flex flex-wrap items-end gap-3">
        <InputField label={$t('enterprise.assessment.from')} type="date" bind:value={fromDate} />
        <InputField label={$t('enterprise.assessment.to')} type="date" bind:value={toDate} />
        <Button variant="secondary" onclick={refresh}>{$t('enterprise.plans.preview')}</Button>
      </div>
      {#if assessmentApi.statistics}
        <div class="space-y-6 pb-8">
          <section class="grid gap-3 rounded-lg border p-5 sm:grid-cols-3">
            <p>{$t('enterprise.assessment.learners')}: {assessmentApi.statistics.learners}</p>
            <p>{$t('enterprise.assessment.plans')}: {assessmentApi.statistics.plans}</p>
            <p>{$t('enterprise.assessment.completed')}: {assessmentApi.statistics.completed}</p>
            <p>
              {$t('enterprise.assessment.completion_rate')}: {assessmentApi.statistics.completionRate === null
                ? '—'
                : `${assessmentApi.statistics.completionRate}%`}
            </p>
            <p>
              {$t('enterprise.assessment.pass_rate')}: {assessmentApi.statistics.passRate === null
                ? '—'
                : `${assessmentApi.statistics.passRate}%`}
            </p>
            <p>{$t('enterprise.assessment.average_score')}: {assessmentApi.statistics.averageScore ?? '—'}</p>
            <p>
              {$t('enterprise.assessment.average_satisfaction')}: {assessmentApi.statistics.averageSatisfaction ?? '—'}
            </p>
            <p>{$t('enterprise.assessment.learning_hours')}: {assessmentApi.statistics.actualLearningHours ?? '—'}</p>
          </section>
          <section class="grid gap-6 rounded-lg border p-5 lg:grid-cols-2">
            <div class="space-y-3">
              <h2 class="font-semibold">{$t('enterprise.assessment.by_department')}</h2>
              {#if browser && departmentChartData.length > 0}
                {#await loadChart() then Chart}
                  <Chart.ChartContainer class="h-[260px] w-full" config={departmentChartConfig}>
                    <Chart.BarChart
                      data={departmentChartData}
                      x="name"
                      axis="x"
                      yDomain={[0, 100]}
                      series={departmentSeries}
                    />
                  </Chart.ChartContainer>
                {/await}
              {/if}
              {#if browser && departmentScoreChartData.length > 0}
                <h3 class="text-sm font-medium">{$t('enterprise.assessment.average_score')}</h3>
                {#await loadChart() then Chart}
                  <Chart.ChartContainer class="h-[260px] w-full" config={departmentChartConfig}>
                    <Chart.BarChart
                      data={departmentScoreChartData}
                      x="name"
                      axis="x"
                      yDomain={[0, 100]}
                      series={departmentScoreSeries}
                    />
                  </Chart.ChartContainer>
                {/await}
              {/if}
              {#each assessmentApi.statistics.byDepartment as department (department.departmentId)}
                <div>
                  <p class="text-sm">
                    {enterpriseApi.overview?.departments.find((item) => item.id === department.departmentId)?.name ??
                      department.departmentId} · {department.completed}/{department.assigned} · {$t(
                      'enterprise.assessment.average_score'
                    )}: {department.averageScore ?? '—'}
                  </p>
                  <Progress value={department.completionRate} max={100} />
                </div>
              {/each}
            </div>
            <div class="space-y-3">
              <h2 class="font-semibold">{$t('enterprise.assessment.monthly_trend')}</h2>
              {#if browser && monthlyChartData.length > 0}
                {#await loadChart() then Chart}
                  <Chart.ChartContainer class="h-[260px] w-full" config={monthlyChartConfig}>
                    <Chart.BarChart
                      data={monthlyChartData}
                      x="month"
                      axis="x"
                      legend
                      seriesLayout="group"
                      series={monthlySeries}
                    />
                  </Chart.ChartContainer>
                {/await}
              {/if}
              {#each assessmentApi.statistics.monthlyTrend as month (month.month)}
                <p class="text-sm">
                  {month.month} · {$t('enterprise.assessment.training_count')}: {month.assigned} · {$t(
                    'enterprise.assessment.completed'
                  )}: {month.completed}
                </p>
              {/each}
            </div>
            <div class="space-y-2">
              <h2 class="font-semibold">{$t('enterprise.assessment.plan_types')}</h2>
              {#if browser && planTypeChartData.length > 0}
                {#await loadChart() then Chart}
                  <Chart.ChartContainer class="flex h-[280px] w-full flex-col items-center" config={{}}>
                    <Chart.PieChart data={planTypeChartData} key="key" label="label" value="responses" c="color" />
                    <Chart.ChartLegend
                      items={planTypeChartData.map((type) => ({
                        label: type.label,
                        color: type.color,
                        value: type.responses
                      }))}
                    />
                  </Chart.ChartContainer>
                {/await}
              {/if}
              {#each assessmentApi.statistics.byPlanType as type (type.type)}
                <p class="text-sm">{$t(`enterprise.plans.type_${type.type.toLowerCase()}`)} · {type.count}</p>
              {/each}
            </div>
            <div class="space-y-2">
              <h2 class="font-semibold">{$t('enterprise.assessment.popular_courses')}</h2>
              <ol class="space-y-2">
                {#each assessmentApi.statistics.popularCourses as course (course.courseId)}
                  <li>
                    <p class="flex justify-between gap-2 text-sm">
                      <span>{course.title}</span><span>{course.assigned}</span>
                    </p>
                    <Progress value={course.assigned} max={assessmentApi.statistics.popularCourses[0]?.assigned ?? 1} />
                  </li>
                {/each}
              </ol>
            </div>
            <div class="space-y-2">
              <h2 class="font-semibold">{$t('enterprise.assessment.unfinished_plans')}</h2>
              <ol class="space-y-2">
                {#each assessmentApi.statistics.unfinishedPlans as plan (plan.planId)}
                  <li>
                    <p class="flex justify-between gap-2 text-sm"><span>{plan.name}</span><span>{plan.count}</span></p>
                    <Progress value={plan.count} max={assessmentApi.statistics.unfinishedPlans[0]?.count ?? 1} />
                  </li>
                {/each}
              </ol>
            </div>
          </section>
        </div>
      {/if}
    {/snippet}
  </Page.Body>
</Page.Root>

<ScrollToTop label={$t('common.scroll_to_top')} />
