<script lang="ts">
  import { currentOrg } from '$lib/utils/store/org';
  import { t } from '$lib/utils/functions/translations';
  import { AssessmentApi } from '$lib/features/enterprise/api/assessment.svelte';
  import { enterpriseApi } from '$lib/features/enterprise/api/enterprise.svelte';
  import { trainingPlansApi } from '$lib/features/enterprise/api/training-plans.svelte';
  import type { AssessmentDraft } from '$lib/features/enterprise/utils/types';
  import { trainingResultKey, trainingStatusKey } from '$lib/features/enterprise/utils/training-labels';
  import { Button } from '@cio/ui/base/button';
  import { InputField } from '@cio/ui/custom/input-field';
  import { TextareaField } from '@cio/ui/custom/textarea-field';
  import { CheckboxField } from '@cio/ui/custom/checkbox-field';
  import { ScrollToTop } from '@cio/ui/custom/scroll-to-top';
  import { Progress } from '@cio/ui/base/progress';
  import * as Select from '@cio/ui/base/select';
  import * as Field from '@cio/ui/base/field';
  import * as Page from '@cio/ui/base/page';

  const assessmentApi = new AssessmentApi();

  let organizationId = '';
  let selectedPlanId = $state('');
  let selectedEnrollmentId = $state('');
  let message = $state('');
  let draft = $state<AssessmentDraft>({ name: '', description: '', passScore: 80, items: [] });
  let inputScores = $state<Record<string, number>>({});
  let adjustment = $state(0);
  let adjustmentReason = $state('');
  let fromDate = $state('');
  let toDate = $state('');
  const itemTypes: AssessmentDraft['items'][number]['type'][] = [
    'EXAM',
    'ASSIGNMENT',
    'INSTRUCTOR',
    'ATTENDANCE',
    'PROGRESS',
    'CUSTOM'
  ];

  $effect(() => {
    const nextOrganizationId = $currentOrg.id;
    if (!nextOrganizationId || organizationId === nextOrganizationId) return;

    organizationId = nextOrganizationId;
    selectedPlanId = '';
    selectedEnrollmentId = '';
    void trainingPlansApi.load(nextOrganizationId);
    void enterpriseApi.load(nextOrganizationId);
  });

  function populateDraft() {
    const scheme = assessmentApi.scheme;
    draft = scheme
      ? {
          name: scheme.name,
          description: scheme.description ?? '',
          passScore: scheme.passScore,
          items: scheme.items.map((item) => ({
            type: item.type as AssessmentDraft['items'][number]['type'],
            name: item.name,
            weight: item.weight,
            maxScore: item.maxScore,
            required: item.required,
            exerciseId: item.exerciseId
          }))
        }
      : { name: '', description: '', passScore: 80, items: [] };
  }

  async function selectPlan(planId: string) {
    if (!organizationId) return;

    selectedPlanId = planId;
    selectedEnrollmentId = '';
    draft = { name: '', description: '', passScore: 80, items: [] };
    inputScores = {};
    message = '';
    await assessmentApi.loadManager(organizationId, planId, fromDate || undefined, toDate || undefined);
    populateDraft();
  }

  function addItem() {
    draft.items.push({ type: 'INSTRUCTOR', name: '', weight: 0, maxScore: 100, required: true, exerciseId: null });
  }

  async function saveScheme() {
    if (!organizationId || !selectedPlanId) return;

    const saved = await assessmentApi.saveScheme(organizationId, selectedPlanId, draft);
    if (saved) {
      message = $t('enterprise.saved');
      populateDraft();
    }
  }

  async function publishScheme() {
    if (!organizationId || !selectedPlanId) return;

    const published = await assessmentApi.publishScheme(organizationId, selectedPlanId);
    if (published) message = $t('enterprise.assessment.publish');
  }

  async function selectEnrollment(enrollmentId: string) {
    if (!organizationId) return;

    selectedEnrollmentId = enrollmentId;
    await assessmentApi.loadDetail(organizationId, enrollmentId);
  }

  async function recalculate() {
    if (!organizationId || !selectedEnrollmentId) return;

    const updated = await assessmentApi.recalculate(organizationId, selectedEnrollmentId);
    if (updated && selectedPlanId)
      await assessmentApi.loadManager(organizationId, selectedPlanId, fromDate || undefined, toDate || undefined);
  }

  async function enterScore(itemId: string) {
    if (!organizationId || !selectedEnrollmentId || inputScores[itemId] === undefined) return;

    const updated = await assessmentApi.enterScore(organizationId, selectedEnrollmentId, itemId, inputScores[itemId]);
    if (updated && selectedPlanId)
      await assessmentApi.loadManager(organizationId, selectedPlanId, fromDate || undefined, toDate || undefined);
  }

  async function adjustScore() {
    if (!organizationId || !selectedEnrollmentId) return;

    const updated = await assessmentApi.adjust(organizationId, selectedEnrollmentId, adjustment, adjustmentReason);
    if (updated) {
      adjustment = 0;
      adjustmentReason = '';
      if (selectedPlanId)
        await assessmentApi.loadManager(organizationId, selectedPlanId, fromDate || undefined, toDate || undefined);
    }
  }

  async function filterStatistics() {
    if (!organizationId || !selectedPlanId) return;

    await assessmentApi.loadManager(organizationId, selectedPlanId, fromDate || undefined, toDate || undefined);
  }
</script>

<svelte:head>
  <title>{$t('enterprise.assessment.title')}</title>
</svelte:head>

<Page.Root role="main" class="mx-auto max-w-6xl px-6">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>{$t('enterprise.assessment.title')}</Page.Title>
      <Page.Subtitle>{$t('enterprise.assessment.subtitle')}</Page.Subtitle>
    </Page.HeaderContent>
  </Page.Header>
  <Page.Body>
    {#snippet child()}
      {#if assessmentApi.error}<p role="alert" class="rounded-md bg-red-50 p-3 text-red-700">
          {assessmentApi.error}
        </p>{/if}
      {#if message}<p role="status" class="rounded-md bg-green-50 p-3 text-green-700">{message}</p>{/if}
      <div class="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label={$t('enterprise.plans.title')} class="space-y-2">
          {#each trainingPlansApi.plans as plan (plan.id)}
            <Button
              variant={selectedPlanId === plan.id ? 'secondary' : 'outline'}
              class="w-full justify-start"
              onclick={() => selectPlan(plan.id)}
            >
              {plan.name}
            </Button>
          {/each}
        </nav>
        <div class="space-y-8">
          {#if assessmentApi.loading}<p>{$t('enterprise.loading')}</p>{/if}
          {#if selectedPlanId}
            <section class="space-y-4 rounded-lg border p-5">
              <h2 class="text-lg font-semibold">{$t('enterprise.assessment.scheme')}</h2>
              {#if assessmentApi.scheme?.status === 'PUBLISHED'}
                <p>{$t('enterprise.plans.status_published')}</p>
                <p>
                  {assessmentApi.scheme.name} · {$t('enterprise.plans.pass_score')}: {assessmentApi.scheme.passScore}
                </p>
              {:else}
                <Field.Group>
                  <Field.Set>
                    <Field.Legend>{$t('enterprise.assessment.scheme')}</Field.Legend>
                    <InputField label={$t('enterprise.name')} bind:value={draft.name} />
                    <TextareaField label={$t('enterprise.plans.description')} bind:value={draft.description} />
                    <InputField label={$t('enterprise.plans.pass_score')} type="number" bind:value={draft.passScore} />
                  </Field.Set>
                  <Field.Separator />
                  <Field.Set>
                    <Field.Legend>{$t('enterprise.assessment.items')}</Field.Legend>
                    {#each draft.items as item, index (index)}
                      <div class="space-y-3 rounded-md border p-3">
                        <Field.Field>
                          <Field.Label>{$t('enterprise.plans.type')}</Field.Label>
                          <Select.Root
                            type="single"
                            value={item.type}
                            onValueChange={(value) => {
                              if (value) item.type = value as AssessmentDraft['items'][number]['type'];
                              item.exerciseId = null;
                            }}
                          >
                            <Select.Trigger class="w-full"
                              >{$t(`enterprise.assessment.type_${item.type.toLowerCase()}`)}</Select.Trigger
                            >
                            <Select.Content>
                              {#each itemTypes as itemType (itemType)}
                                <Select.Item
                                  value={itemType}
                                  label={$t(`enterprise.assessment.type_${itemType.toLowerCase()}`)}
                                >
                                  {$t(`enterprise.assessment.type_${itemType.toLowerCase()}`)}
                                </Select.Item>
                              {/each}
                            </Select.Content>
                          </Select.Root>
                        </Field.Field>
                        <div class="grid gap-3 sm:grid-cols-3">
                          <InputField label={$t('enterprise.name')} bind:value={item.name} />
                          <InputField
                            label={$t('enterprise.assessment.weight')}
                            type="number"
                            bind:value={item.weight}
                          />
                          <InputField
                            label={$t('enterprise.assessment.max_score')}
                            type="number"
                            bind:value={item.maxScore}
                          />
                        </div>
                        {#if item.type === 'EXAM' || item.type === 'ASSIGNMENT'}
                          <Field.Field>
                            <Field.Label>{$t('enterprise.assessment.exercise')}</Field.Label>
                            <Select.Root
                              type="single"
                              value={item.exerciseId ?? ''}
                              onValueChange={(value) => {
                                item.exerciseId = value || null;
                                const exercise = assessmentApi.exercises.find((candidate) => candidate.id === value);
                                if (exercise) item.maxScore = exercise.maxPoints;
                              }}
                            >
                              <Select.Trigger class="w-full">
                                {assessmentApi.exercises.find((candidate) => candidate.id === item.exerciseId)?.title ??
                                  '—'}
                              </Select.Trigger>
                              <Select.Content>
                                {#each assessmentApi.exercises.filter((candidate) => candidate.isExam === (item.type === 'EXAM')) as exercise (exercise.id)}
                                  <Select.Item value={exercise.id} label={exercise.title}>{exercise.title}</Select.Item>
                                {/each}
                              </Select.Content>
                            </Select.Root>
                          </Field.Field>
                        {/if}
                        <CheckboxField label={$t('enterprise.plans.type_mandatory')} bind:checked={item.required} />
                        <Button variant="outline" size="sm" onclick={() => draft.items.splice(index, 1)}>×</Button>
                      </div>
                    {/each}
                    <Button variant="secondary" onclick={addItem}>{$t('enterprise.assessment.add_item')}</Button>
                  </Field.Set>
                </Field.Group>
                <div class="flex flex-wrap gap-3">
                  <Button disabled={assessmentApi.busy} onclick={saveScheme}>{$t('enterprise.save')}</Button>
                  {#if assessmentApi.scheme}
                    <Button variant="secondary" disabled={assessmentApi.busy} onclick={publishScheme}>
                      {$t('enterprise.assessment.publish')}
                    </Button>
                  {/if}
                </div>
              {/if}
            </section>

            {#if assessmentApi.statistics}
              <section class="space-y-5 rounded-lg border p-5">
                <h2 class="text-lg font-semibold">{$t('enterprise.assessment.archive')}</h2>
                <div class="flex flex-wrap items-end gap-3">
                  <InputField label={$t('enterprise.assessment.from')} type="date" bind:value={fromDate} />
                  <InputField label={$t('enterprise.assessment.to')} type="date" bind:value={toDate} />
                  <Button variant="secondary" onclick={filterStatistics}>{$t('enterprise.plans.preview')}</Button>
                </div>
                <div class="grid gap-3 sm:grid-cols-3">
                  <p>{$t('enterprise.plans.assigned')}: {assessmentApi.statistics.assigned}</p>
                  <p>{$t('enterprise.assessment.learners')}: {assessmentApi.statistics.learners}</p>
                  <p>{$t('enterprise.assessment.plans')}: {assessmentApi.statistics.plans}</p>
                  <p>{$t('enterprise.assessment.completed')}: {assessmentApi.statistics.completed}</p>
                  <p>
                    {$t('enterprise.assessment.completion_rate')}: {assessmentApi.statistics.completionRate === null
                      ? '—'
                      : `${assessmentApi.statistics.completionRate}%`}
                  </p>
                  <p>{$t('enterprise.assessment.passed')}: {assessmentApi.statistics.passed}</p>
                  <p>{$t('enterprise.assessment.failed')}: {assessmentApi.statistics.failed}</p>
                  <p>{$t('enterprise.assessment.average_score')}: {assessmentApi.statistics.averageScore ?? '—'}</p>
                  <p>
                    {$t('enterprise.assessment.pass_rate')}: {assessmentApi.statistics.passRate === null
                      ? '—'
                      : `${assessmentApi.statistics.passRate}%`}
                  </p>
                  <p>
                    {$t('enterprise.assessment.average_satisfaction')}: {assessmentApi.statistics.averageSatisfaction ??
                      '—'}
                  </p>
                  <p>
                    {$t('enterprise.assessment.learning_hours')}: {assessmentApi.statistics.actualLearningHours ?? '—'}
                  </p>
                </div>
                <div class="grid gap-6 lg:grid-cols-2">
                  <div class="space-y-3">
                    <h3 class="font-semibold">{$t('enterprise.assessment.by_department')}</h3>
                    {#each assessmentApi.statistics.byDepartment as department (department.departmentId)}
                      <div>
                        <p class="text-sm">
                          {enterpriseApi.overview?.departments.find((item) => item.id === department.departmentId)
                            ?.name ?? department.departmentId} · {department.completed}/{department.assigned} · {$t(
                            'enterprise.assessment.average_score'
                          )}: {department.averageScore ?? '—'}
                        </p>
                        <Progress value={department.completionRate} max={100} />
                      </div>
                    {/each}
                  </div>
                  <div class="space-y-3">
                    <h3 class="font-semibold">{$t('enterprise.assessment.monthly_trend')}</h3>
                    {#each assessmentApi.statistics.monthlyTrend as month (month.month)}
                      <div>
                        <p class="text-sm">{month.month} · {month.completed}/{month.assigned}</p>
                        <Progress value={month.assigned ? (month.completed / month.assigned) * 100 : 0} max={100} />
                      </div>
                    {/each}
                  </div>
                  <div class="space-y-2">
                    <h3 class="font-semibold">{$t('enterprise.assessment.plan_types')}</h3>
                    {#each assessmentApi.statistics.byPlanType as type (type.type)}
                      <p class="text-sm">{$t(`enterprise.plans.type_${type.type.toLowerCase()}`)} · {type.count}</p>
                    {/each}
                  </div>
                  <div class="space-y-2">
                    <h3 class="font-semibold">{$t('enterprise.assessment.popular_courses')}</h3>
                    {#each assessmentApi.statistics.popularCourses as course (course.courseId)}
                      <p class="text-sm">{course.title} · {course.assigned}</p>
                    {/each}
                  </div>
                  <div class="space-y-2">
                    <h3 class="font-semibold">{$t('enterprise.assessment.unfinished_plans')}</h3>
                    {#each assessmentApi.statistics.unfinishedPlans as plan (plan.planId)}
                      <p class="text-sm">{plan.name} · {plan.count}</p>
                    {/each}
                  </div>
                </div>
              </section>
            {/if}

            <section class="space-y-3 rounded-lg border p-5">
              <h2 class="text-lg font-semibold">{$t('enterprise.assessment.archive')}</h2>
              {#each assessmentApi.archive as row (row.enrollmentId)}
                <Button
                  variant={selectedEnrollmentId === row.enrollmentId ? 'secondary' : 'outline'}
                  class="w-full justify-between"
                  onclick={() => selectEnrollment(row.enrollmentId)}
                >
                  <span>{row.memberEmail ?? row.memberId} · {$t(trainingStatusKey(row.status))}</span>
                  <span>{row.finalScore ?? '—'}</span>
                </Button>
              {/each}
            </section>

            {#if assessmentApi.detail && selectedEnrollmentId}
              <section class="space-y-4 rounded-lg border p-5">
                <h2 class="text-lg font-semibold">{$t('enterprise.assessment.details')}</h2>
                <p>
                  {$t('enterprise.assessment.score')}: {assessmentApi.detail.score?.finalScore ?? '—'} · {$t(
                    trainingResultKey(assessmentApi.detail.score?.result ?? null)
                  )}
                </p>
                <Button variant="secondary" disabled={assessmentApi.busy} onclick={recalculate}
                  >{$t('enterprise.assessment.recalculate')}</Button
                >
                {#each assessmentApi.detail.scheme?.items ?? [] as item (item.id)}
                  {@const detail = assessmentApi.detail.score?.details.find(
                    (candidate) => candidate.itemId === item.id
                  )}
                  <div class="rounded-md border p-3">
                    <p>{item.name}: {detail?.rawScore ?? '—'} / {item.maxScore} · {detail?.weightedScore ?? '—'}</p>
                    {#if item.type === 'INSTRUCTOR' || item.type === 'ATTENDANCE' || item.type === 'CUSTOM'}
                      <div class="mt-2 flex items-end gap-2">
                        <InputField
                          label={$t('enterprise.assessment.enter_score')}
                          type="number"
                          bind:value={inputScores[item.id]}
                        />
                        <Button size="sm" disabled={assessmentApi.busy} onclick={() => enterScore(item.id)}
                          >{$t('enterprise.save')}</Button
                        >
                      </div>
                    {/if}
                  </div>
                {/each}
                <div class="grid gap-3 sm:grid-cols-2">
                  <InputField label={$t('enterprise.assessment.adjustment')} type="number" bind:value={adjustment} />
                  <InputField label={$t('enterprise.assessment.reason')} bind:value={adjustmentReason} />
                </div>
                <Button variant="secondary" disabled={assessmentApi.busy} onclick={adjustScore}
                  >{$t('enterprise.assessment.adjustment')}</Button
                >
                {#each assessmentApi.detail.score?.adjustments ?? [] as entry (entry.id)}
                  <p class="text-sm">{entry.amount} · {entry.reason} · {new Date(entry.adjustedAt).toLocaleString()}</p>
                {/each}
              </section>
            {/if}
          {/if}
        </div>
      </div>
    {/snippet}
  </Page.Body>
</Page.Root>

<ScrollToTop label={$t('common.scroll_to_top')} />
