<script lang="ts">
  import BatchMakeup from '$lib/features/enterprise/components/batch-makeup.svelte';
  import { page } from '$app/state';
  import { currentOrg } from '$lib/utils/store/org';
  import { t, locale } from '$lib/utils/functions/translations';
  import { AssessmentApi } from '$lib/features/enterprise/api/assessment.svelte';
  import { enterpriseApi } from '$lib/features/enterprise/api/enterprise.svelte';
  import { trainingPlansApi } from '$lib/features/enterprise/api/training-plans.svelte';
  import type { AssessmentDraft } from '$lib/features/enterprise/utils/types';
  import { trainingResultKey, trainingStatusKey } from '$lib/features/enterprise/utils/training-labels';
  import {
    assessmentDraftFingerprint,
    clearAssessmentInputs,
    employeeLabel,
    isAssessmentDraftSaved
  } from '$lib/features/enterprise/utils/admin-workflow';
  import { UnsavedChanges } from '$features/ui';
  import { Button } from '@cio/ui/base/button';
  import { InputField } from '@cio/ui/custom/input-field';
  import { TextareaField } from '@cio/ui/custom/textarea-field';
  import { CheckboxField } from '@cio/ui/custom/checkbox-field';
  import { Progress } from '@cio/ui/base/progress';
  import * as Select from '@cio/ui/base/select';
  import * as Field from '@cio/ui/base/field';
  import * as Page from '@cio/ui/base/page';

  const assessmentApi = new AssessmentApi();

  let organizationId = $state('');
  let selectedPlanId = $state('');
  let selectedEnrollmentId = $state('');
  let message = $state('');
  let draft = $state<AssessmentDraft>({ name: '', description: '', passScore: 80, items: [] });
  let inputScores = $state<Record<string, number>>({});
  let adjustment = $state(0);
  let adjustmentReason = $state('');
  let fromDate = $state('');
  let toDate = $state('');
  let planSearch = $state('');
  let employeeSearch = $state('');
  let assessmentTab = $state<'setup' | 'grading' | 'results'>('setup');
  let savedDraftFingerprint = $state(assessmentDraftFingerprint(draft));
  const hasSchemeChanges = $derived(
    assessmentApi.scheme?.status !== 'PUBLISHED' && assessmentDraftFingerprint(draft) !== savedDraftFingerprint
  );
  const hasScoreChanges = $derived(
    Object.values(inputScores).some((score) => score !== undefined) ||
      adjustment !== 0 ||
      adjustmentReason.trim() !== ''
  );
  const hasUnsavedChanges = $derived(hasSchemeChanges || hasScoreChanges);
  const canPublishScheme = $derived(isAssessmentDraftSaved(assessmentApi.scheme, draft));
  const selectedPlan = $derived(trainingPlansApi.plans.find((plan) => plan.id === selectedPlanId));
  const selectedEmployee = $derived(
    enterpriseApi.employees.find((employee) => employee.member.id === assessmentApi.detail?.enrollment.memberId)
  );
  const filteredPlans = $derived(
    trainingPlansApi.plans.filter((plan) =>
      `${plan.name} ${plan.code}`.toLocaleLowerCase().includes(planSearch.trim().toLocaleLowerCase())
    )
  );
  const filteredEnrollments = $derived(
    assessmentApi.archive.filter((row) => {
      const employee = enterpriseApi.employees.find((item) => item.member.id === row.memberId);
      const label = employee
        ? employeeLabel(employee, enterpriseApi.overview?.departments)
        : (row.memberEmail ?? String(row.memberId));
      return label.toLocaleLowerCase().includes(employeeSearch.trim().toLocaleLowerCase());
    })
  );
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
    void trainingPlansApi.load(nextOrganizationId).then(() => {
      const planId = page.url.searchParams.get('planId');
      if (
        organizationId === nextOrganizationId &&
        planId &&
        trainingPlansApi.plans.some((plan) => plan.id === planId)
      ) {
        void selectPlan(planId);
      }
    });
    void enterpriseApi.load(nextOrganizationId);
  });

  function populateDraft() {
    const scheme = assessmentApi.scheme;
    const nextDraft = scheme
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
    Object.assign(draft, nextDraft);
    savedDraftFingerprint = assessmentDraftFingerprint(draft);
  }

  function clearScoreInputs() {
    clearAssessmentInputs(inputScores);
    adjustment = 0;
    adjustmentReason = '';
  }

  function discardScoreInputs() {
    if (hasScoreChanges && !window.confirm($t('common.unsaved_changes.message'))) return;

    clearScoreInputs();
  }

  async function selectPlan(planId: string) {
    if (!organizationId || assessmentApi.busy) return;
    if (hasUnsavedChanges && !window.confirm($t('common.unsaved_changes.message'))) return;

    selectedPlanId = planId;
    selectedEnrollmentId = '';
    Object.assign(draft, { name: '', description: '', passScore: 80, items: [] });
    savedDraftFingerprint = assessmentDraftFingerprint(draft);
    clearScoreInputs();
    assessmentTab = 'setup';
    employeeSearch = '';
    message = '';
    const loaded = await assessmentApi.loadManager(organizationId, planId, fromDate || undefined, toDate || undefined);
    if (loaded && selectedPlanId === planId) populateDraft();
  }

  function addItem() {
    draft.items.push({ type: 'INSTRUCTOR', name: '', weight: 0, maxScore: 100, required: true, exerciseId: null });
  }

  async function saveScheme() {
    if (!organizationId || !selectedPlanId) return;

    const submittedFingerprint = assessmentDraftFingerprint(draft);
    const saved = await assessmentApi.saveScheme(organizationId, selectedPlanId, draft);
    if (saved) {
      message = $t('enterprise.saved');
      if (assessmentDraftFingerprint(draft) === submittedFingerprint) populateDraft();
      else if (assessmentApi.scheme) savedDraftFingerprint = assessmentDraftFingerprint(assessmentApi.scheme);
    }
  }

  async function publishScheme() {
    if (!organizationId || !selectedPlanId) return;

    if (!canPublishScheme || hasSchemeChanges || assessmentApi.busy) return;

    const published = await assessmentApi.publishScheme(organizationId, selectedPlanId, draft);
    if (published) message = $t('enterprise.assessment.publish');
  }

  async function selectEnrollment(enrollmentId: string) {
    if (!organizationId || assessmentApi.busy) return;
    if (hasScoreChanges && !window.confirm($t('common.unsaved_changes.message'))) return;

    clearScoreInputs();
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
    if (updated) delete inputScores[itemId];
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

<UnsavedChanges {hasUnsavedChanges} />

<svelte:head>
  <title>{$t('enterprise.assessment.title')}</title>
</svelte:head>

<Page.Root class="mx-auto max-w-6xl px-6">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>{$t('enterprise.assessment.title')}</Page.Title>
      <Page.Subtitle>{$t('enterprise.assessment.subtitle')}</Page.Subtitle>
    </Page.HeaderContent>
    {#if selectedPlanId}
      <Page.Action
        ><Button variant="secondary" href={`/admin/plans?planId=${selectedPlanId}`}
          >{$t('enterprise.operations.return_plan')}</Button
        ></Page.Action
      >
    {/if}
  </Page.Header>
  <Page.Body>
    {#snippet child()}
      {#if assessmentApi.error}<p role="alert" class="rounded-md bg-red-50 p-3 text-red-700">
          {assessmentApi.error}
        </p>{/if}
      {#if message}<p role="status" class="rounded-md bg-green-50 p-3 text-green-700">{message}</p>{/if}
      {#if selectedPlanId && trainingPlansApi.error}<p role="alert" class="rounded-md bg-red-50 p-3 text-red-700">
          {trainingPlansApi.error}
        </p>{/if}
      <div class="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label={$t('enterprise.plans.title')} class="space-y-2">
          <InputField label={$t('enterprise.admin_workflow.search_plans')} type="search" bind:value={planSearch} />
          {#each filteredPlans as plan (plan.id)}
            <Button
              variant={selectedPlanId === plan.id ? 'secondary' : 'outline'}
              class="h-auto w-full flex-col items-start py-3 text-left whitespace-normal"
              disabled={assessmentApi.busy}
              testId={`assessment-plan-${plan.id}`}
              onclick={() => selectPlan(plan.id)}
            >
              <strong>{plan.name}</strong>
              <span class="text-xs"
                >{$t(`enterprise.plans.status_${plan.status.toLowerCase()}`)} · {new Date(
                  plan.startAt
                ).toLocaleDateString($locale === 'zh' ? 'zh-CN' : $locale)} — {new Date(plan.endAt).toLocaleDateString(
                  $locale === 'zh' ? 'zh-CN' : $locale
                )}</span
              >
            </Button>
          {/each}
          {#if selectedPlanId && !trainingPlansApi.loading && filteredPlans.length === 0}
            <p role="status" class="ui:text-muted-foreground text-sm">{$t('enterprise.admin_workflow.no_matches')}</p>
          {/if}
        </nav>
        <div class="space-y-8">
          {#if assessmentApi.loading}<p>{$t('enterprise.loading')}</p>{/if}
          {#if selectedPlanId}
            <div class="space-y-3">
              <h2 class="text-xl font-semibold">{selectedPlan?.name}</h2>
              <p class="ui:text-muted-foreground text-sm">{$t('enterprise.admin_workflow.assessment_steps')}</p>
              <nav class="flex flex-wrap gap-2" aria-label={$t('enterprise.assessment.title')}>
                {#each ['setup', 'grading', 'results'] as tab}
                  <Button
                    testId={`assessment-tab-${tab}`}
                    variant={assessmentTab === tab ? 'default' : 'outline'}
                    size="sm"
                    onclick={() => (assessmentTab = tab as typeof assessmentTab)}
                    >{$t(`enterprise.admin_workflow.tab_${tab}`)}</Button
                  >
                {/each}
              </nav>
            </div>
            {#if assessmentTab === 'setup'}
              <section class="space-y-3 rounded-lg border p-5">
                <h2 class="font-semibold">{$t('enterprise.operations.plan_exercises')}</h2>
                <p class="ui:text-muted-foreground text-sm">{$t('enterprise.operations.plan_exercises_help')}</p>
                {#if enterpriseApi.overview?.canManage && !assessmentApi.loading}{#key selectedPlanId}<BatchMakeup
                      {organizationId}
                      planId={selectedPlanId}
                      exams={assessmentApi.exercises}
                      employees={assessmentApi.archive}
                      directory={enterpriseApi.employees}
                    />{/key}{/if}
                {#each assessmentApi.exercises as exercise (exercise.id)}
                  <div class="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                    <span
                      >{exercise.title} · {$t(
                        exercise.isExam ? 'enterprise.assessment.type_exam' : 'enterprise.assessment.type_assignment'
                      )}</span
                    >
                    <Button
                      variant="secondary"
                      size="sm"
                      href={`/courses/${exercise.courseId}/exercises/${exercise.id}`}
                      >{$t('enterprise.operations.open_exercise')}</Button
                    >
                  </div>
                {/each}
              </section>
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
                      <InputField
                        testId="assessment-pass-score"
                        name="assessment-pass-score"
                        label={$t('enterprise.plans.pass_score')}
                        type="number"
                        bind:value={draft.passScore}
                      />
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
                                  {assessmentApi.exercises.find((candidate) => candidate.id === item.exerciseId)
                                    ?.title ?? '—'}
                                </Select.Trigger>
                                <Select.Content>
                                  {#each assessmentApi.exercises.filter((candidate) => candidate.isExam === (item.type === 'EXAM')) as exercise (exercise.id)}
                                    <Select.Item value={exercise.id} label={exercise.title}
                                      >{exercise.title}</Select.Item
                                    >
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
                    {#if assessmentApi.scheme}
                      <Button
                        variant="secondary"
                        testId="assessment-publish"
                        disabled={assessmentApi.busy ||
                          !canPublishScheme ||
                          hasSchemeChanges ||
                          trainingPlansApi.plans.find((plan) => plan.id === selectedPlanId)?.status === 'DRAFT'}
                        onclick={publishScheme}
                      >
                        {$t('enterprise.assessment.publish')}
                      </Button>
                    {/if}
                  </div>
                  {#if hasSchemeChanges}<p role="status" class="ui:text-muted-foreground text-sm">
                      {$t('enterprise.admin_workflow.save_before_publish')}
                    </p>{/if}
                  {#if trainingPlansApi.plans.find((plan) => plan.id === selectedPlanId)?.status === 'DRAFT'}
                    <p class="ui:text-muted-foreground text-sm">{$t('enterprise.operations.publish_plan_first')}</p>
                  {/if}
                {/if}
              </section>
            {/if}

            {#if assessmentTab === 'results' && assessmentApi.statistics}
              <section class="space-y-5 rounded-lg border p-5">
                <h2 class="text-lg font-semibold">{$t('enterprise.assessment.archive')}</h2>
                <div class="flex flex-wrap items-end gap-3">
                  <InputField label={$t('enterprise.assessment.from')} type="date" bind:value={fromDate} />
                  <InputField label={$t('enterprise.assessment.to')} type="date" bind:value={toDate} />
                  <Button variant="secondary" onclick={filterStatistics}
                    >{$t('enterprise.admin_workflow.apply_filters')}</Button
                  >
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

            {#if assessmentTab === 'grading'}
              <section class="space-y-3 rounded-lg border p-5">
                <h2 class="text-lg font-semibold">{$t('enterprise.assessment.archive')}</h2>
                <InputField
                  label={$t('enterprise.admin_workflow.search_employees')}
                  type="search"
                  bind:value={employeeSearch}
                />
                {#each filteredEnrollments as row (row.enrollmentId)}
                  {@const employee = enterpriseApi.employees.find((item) => item.member.id === row.memberId)}
                  <Button
                    variant={selectedEnrollmentId === row.enrollmentId ? 'secondary' : 'outline'}
                    class="h-auto w-full justify-between gap-3 text-left whitespace-normal"
                    disabled={assessmentApi.busy}
                    testId={`assessment-employee-${row.memberId}`}
                    onclick={() => selectEnrollment(row.enrollmentId)}
                  >
                    <span
                      >{employee
                        ? employeeLabel(employee, enterpriseApi.overview?.departments)
                        : (row.memberEmail ?? row.memberId)} · {$t(trainingStatusKey(row.status))}</span
                    >
                    <span>{row.finalScore ?? '—'}</span>
                  </Button>
                {/each}
                {#if filteredEnrollments.length === 0}<p class="ui:text-muted-foreground text-sm">
                    {$t('enterprise.admin_workflow.no_matches')}
                  </p>{/if}
              </section>

              {#if assessmentApi.detail && selectedEnrollmentId}
                <section class="space-y-4 rounded-lg border p-5">
                  <h2 class="text-lg font-semibold">
                    {$t('enterprise.assessment.details')} · {selectedEmployee
                      ? employeeLabel(selectedEmployee, enterpriseApi.overview?.departments)
                      : assessmentApi.detail.enrollment.memberId}
                  </h2>
                  {#if hasScoreChanges}<div
                      class="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                    >
                      <p role="status">{$t('enterprise.admin_workflow.score_unsaved')}</p>
                      <Button size="sm" variant="outline" disabled={assessmentApi.busy} onclick={discardScoreInputs}
                        >{$t('common.discard')}</Button
                      >
                    </div>{/if}
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
                            name={`assessment-score-${item.id}`}
                            testId={`assessment-score-${item.id}`}
                            type="number"
                            isDisabled={assessmentApi.busy}
                            bind:value={inputScores[item.id]}
                          />
                          <Button
                            testId={`assessment-save-score-${item.id}`}
                            size="sm"
                            disabled={assessmentApi.busy}
                            onclick={() => enterScore(item.id)}>{$t('enterprise.save')}</Button
                          >
                        </div>
                      {/if}
                    </div>
                  {/each}
                  <div class="grid gap-3 sm:grid-cols-2">
                    <InputField
                      testId="assessment-adjustment"
                      name="assessment-adjustment"
                      label={$t('enterprise.assessment.adjustment')}
                      type="number"
                      isDisabled={assessmentApi.busy}
                      bind:value={adjustment}
                    />
                    <InputField
                      testId="assessment-adjustment-reason"
                      name="assessment-adjustment-reason"
                      label={$t('enterprise.assessment.reason')}
                      isDisabled={assessmentApi.busy}
                      bind:value={adjustmentReason}
                    />
                  </div>
                  <Button variant="secondary" disabled={assessmentApi.busy} onclick={adjustScore}
                    >{$t('enterprise.assessment.adjustment')}</Button
                  >
                  {#each assessmentApi.detail.score?.adjustments ?? [] as entry (entry.id)}
                    <p class="text-sm">
                      {entry.amount} · {entry.reason} · {new Date(entry.adjustedAt).toLocaleString(
                        $locale === 'zh' ? 'zh-CN' : $locale
                      )}
                    </p>
                  {/each}
                </section>
              {/if}
            {/if}
          {:else if trainingPlansApi.loading}
            <p role="status">{$t('enterprise.loading')}</p>
          {:else}
            <section data-testid="assessment-plan-empty" class="space-y-3 rounded-lg border p-5">
              {#if trainingPlansApi.error}
                <p role="alert" class="text-red-700">{trainingPlansApi.error}</p>
                <Button variant="secondary" onclick={() => trainingPlansApi.load(organizationId)}
                  >{$t('enterprise.ui_v2.retry')}</Button
                >
              {:else if trainingPlansApi.plans.length === 0}
                <h2 class="text-lg font-semibold">{$t('enterprise.ui_v2.no_plans')}</h2>
                <p class="ui:text-muted-foreground text-sm">{$t('enterprise.ui_v2.no_plans_hint')}</p>
              {:else if filteredPlans.length === 0}
                <p role="status" class="ui:text-muted-foreground text-sm">
                  {$t('enterprise.admin_workflow.no_matches')}
                </p>
                <Button variant="secondary" onclick={() => (planSearch = '')}
                  >{$t('enterprise.ui_v2.clear_search')}</Button
                >
              {:else}
                <h2 class="text-lg font-semibold">{$t('enterprise.assessment.scheme')}</h2>
                <p class="ui:text-muted-foreground text-sm">{$t('enterprise.admin_workflow.assessment_steps')}</p>
                <Button onclick={() => selectPlan(filteredPlans[0].id)}>{filteredPlans[0].name}</Button>
              {/if}
              <div>
                <Button variant="outline" href="/admin/plans"
                  >{$t(
                    trainingPlansApi.plans.length === 0 && !trainingPlansApi.error
                      ? 'enterprise.ui_v2.new_plan'
                      : 'enterprise.plans.title'
                  )}</Button
                >
              </div>
            </section>
          {/if}
        </div>
      </div>
    {/snippet}
  </Page.Body>
  <Page.SettingsActions
    hasChanges={hasSchemeChanges}
    loading={assessmentApi.busy}
    statusLabel={$t('common.unsaved_changes.label')}
    discardLabel={$t('common.discard')}
    saveLabel={$t('common.save_changes')}
    onSave={saveScheme}
    onDiscard={populateDraft}
  />
</Page.Root>
