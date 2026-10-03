<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { page } from '$app/state';
  import { currentOrg } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import { t } from '$lib/utils/functions/translations';
  import { AssessmentApi } from '$lib/features/enterprise/api/assessment.svelte';
  import { myTrainingApi } from '$features/enterprise/api/my-training.svelte';
  import { CoursesApi } from '$features/course/api/courses.svelte';
  import { LMSExercisesApi } from '$features/lms/api/exercises.svelte';
  import { getAssessmentTasks } from '$features/lms/utils/assessment-tasks';
  import TrainingLearningActions from '$features/lms/components/training-learning-actions.svelte';
  import type { TrainingEvaluationDraft } from '$lib/features/enterprise/utils/types';
  import { trainingResultKey } from '$lib/features/enterprise/utils/training-labels';
  import { Button } from '@cio/ui/base/button';
  import { InputField } from '@cio/ui/custom/input-field';
  import { TextareaField } from '@cio/ui/custom/textarea-field';
  import * as Field from '@cio/ui/base/field';
  import * as Page from '@cio/ui/base/page';

  const assessmentApi = new AssessmentApi();
  const coursesApi = new CoursesApi();
  const exercisesApi = new LMSExercisesApi();
  let coursesFailed = $state(false);
  let now = $state(Date.now());
  const assignment = $derived(myTrainingApi.assignments.find((item) => item.enrollmentId === page.params.enrollmentId));
  const tasks = $derived(getAssessmentTasks(exercisesApi.exercises, exercisesApi.examAccess, now));

  let lastLoadKey = '';
  let message = $state('');
  let evaluation = $state<TrainingEvaluationDraft>({
    contentRating: 5,
    instructorRating: 5,
    usefulnessRating: 5,
    difficultyRating: 3,
    satisfactionRating: 5,
    helpfulContent: '',
    improvements: '',
    suggestions: ''
  });

  async function loadEnrollment(organizationId: string, enrollmentId: string, loadKey: string) {
    await assessmentApi.loadDetail(organizationId, enrollmentId);
    if (lastLoadKey !== loadKey || assessmentApi.detail?.scheme?.status !== 'PUBLISHED') return;

    await assessmentApi.recalculate(organizationId, enrollmentId);
  }

  $effect(() => {
    const organizationId = $currentOrg.id;
    const profileId = $profile.id;
    const enrollmentId = page.params.enrollmentId;
    if (!organizationId || !profileId || !enrollmentId) return;

    const loadKey = `${organizationId}:${profileId}:${enrollmentId}`;
    if (lastLoadKey === loadKey) return;

    lastLoadKey = loadKey;
    assessmentApi.detail = null;
    untrack(() => {
      void loadEnrollment(organizationId, enrollmentId, loadKey);
      void myTrainingApi.load(organizationId, profileId);
      void loadCourses();
      void loadTasks();
    });
  });

  async function loadCourses() {
    coursesFailed = false;
    const response = await coursesApi.getEnrolledCourses();
    coursesFailed = !response;
  }

  function loadTasks() {
    now = Date.now();
    return exercisesApi.load($currentOrg.id);
  }

  onMount(() => {
    const timer = window.setInterval(() => {
      now = Date.now();
    }, 30_000);
    return () => window.clearInterval(timer);
  });

  async function submitEvaluation() {
    const organizationId = $currentOrg.id;
    const enrollmentId = page.params.enrollmentId;
    if (!organizationId || !enrollmentId) return;

    const saved = await assessmentApi.evaluate(organizationId, enrollmentId, evaluation);
    if (saved) message = $t('enterprise.assessment.submitted');
  }

  async function refreshAssessment() {
    const organizationId = $currentOrg.id;
    const enrollmentId = page.params.enrollmentId;
    if (!organizationId || !enrollmentId) return;

    await assessmentApi.recalculate(organizationId, enrollmentId);
  }
</script>

<svelte:head>
  <title>{$t('learner_tasks.training_detail')}</title>
</svelte:head>

<Page.Root role="main" class="mx-auto max-w-4xl px-6">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>{$t('learner_tasks.training_detail')}</Page.Title>
      <Page.Subtitle>{assessmentApi.detail?.plan.name ?? $t('enterprise.my_training.title')}</Page.Subtitle>
    </Page.HeaderContent>
    <Page.Action>
      <Button href="/lms/training" variant="secondary">{$t('enterprise.my_training.title')}</Button>
    </Page.Action>
  </Page.Header>
  <Page.Body>
    {#snippet child()}
      {#if assessmentApi.error}<div role="alert" class="training-panel space-y-3">
          <p>{assessmentApi.error}</p>
          <Button
            size="sm"
            variant="outline"
            onclick={() => loadEnrollment($currentOrg.id, page.params.enrollmentId!, lastLoadKey)}
          >
            {$t('enterprise.ui_v2.retry')}
          </Button>
        </div>{/if}
      {#if message}<p role="status" class="rounded-md bg-green-50 p-3 text-green-700">{message}</p>{/if}
      {#if assessmentApi.loading}<p>{$t('enterprise.loading')}</p>{/if}
      {#if myTrainingApi.loading}
        <p role="status">{$t('enterprise.loading')}</p>
      {:else if myTrainingApi.error}
        <div role="alert" class="training-panel space-y-3">
          <p>{myTrainingApi.error}</p>
          <Button size="sm" variant="outline" onclick={() => myTrainingApi.load($currentOrg.id, $profile.id)}>
            {$t('enterprise.ui_v2.retry')}
          </Button>
        </div>
      {:else if assignment}
        <section class="training-panel mb-6 space-y-3">
          {#if assignment.description}<p class="ui:text-muted-foreground text-sm">{assignment.description}</p>{/if}
          <TrainingLearningActions
            {assignment}
            courses={coursesApi.enrolledCourses}
            {tasks}
            coursesLoading={coursesApi.isLoading}
            coursesError={coursesFailed}
            tasksLoading={exercisesApi.isLoading}
            tasksError={!!exercisesApi.error}
            checkingAccess={exercisesApi.accessLoading}
            onRetryCourses={loadCourses}
            onRetryTasks={loadTasks}
          />
        </section>
      {/if}
      {#if assessmentApi.detail}
        <div class="space-y-6 pb-8">
          <section class="space-y-3 rounded-lg border p-5">
            <h2 class="text-lg font-semibold">{$t('enterprise.assessment.score')}</h2>
            {#if assessmentApi.detail.scheme?.status === 'PUBLISHED'}
              <Button variant="secondary" size="sm" disabled={assessmentApi.busy} onclick={refreshAssessment}>
                {$t('enterprise.assessment.recalculate')}
              </Button>
            {/if}
            <p>
              {assessmentApi.detail.score?.finalScore ?? '—'} · {$t(
                trainingResultKey(assessmentApi.detail.score?.result ?? null)
              )}
            </p>
            <p>
              {$t('enterprise.my_training.progress')}: {assessmentApi.detail.enrollment.progressPercent === null
                ? '—'
                : `${assessmentApi.detail.enrollment.progressPercent}%`}
            </p>
            {#each assessmentApi.detail.scheme?.items ?? [] as item (item.id)}
              {@const detail = assessmentApi.detail.score?.details.find((candidate) => candidate.itemId === item.id)}
              <p>{item.name}: {detail?.rawScore ?? '—'} / {item.maxScore} · {detail?.weightedScore ?? '—'}</p>
            {/each}
          </section>

          {#if assessmentApi.detail.evaluation}
            <p>{$t('enterprise.assessment.submitted')}</p>
          {:else if assessmentApi.detail.enrollment.status === 'COMPLETED'}
            <section class="space-y-4 rounded-lg border p-5">
              <h2 class="text-lg font-semibold">{$t('enterprise.assessment.evaluate')}</h2>
              <Field.Group>
                <Field.Set>
                  <Field.Legend>{$t('enterprise.assessment.evaluate')}</Field.Legend>
                  <div class="grid gap-3 sm:grid-cols-2">
                    <InputField
                      label={$t('enterprise.assessment.content_rating')}
                      type="number"
                      min={1}
                      max={5}
                      bind:value={evaluation.contentRating}
                    />
                    <InputField
                      label={$t('enterprise.assessment.instructor_rating')}
                      type="number"
                      min={1}
                      max={5}
                      bind:value={evaluation.instructorRating}
                    />
                    <InputField
                      label={$t('enterprise.assessment.usefulness_rating')}
                      type="number"
                      min={1}
                      max={5}
                      bind:value={evaluation.usefulnessRating}
                    />
                    <InputField
                      label={$t('enterprise.assessment.difficulty_rating')}
                      type="number"
                      min={1}
                      max={5}
                      bind:value={evaluation.difficultyRating}
                    />
                    <InputField
                      label={$t('enterprise.assessment.satisfaction_rating')}
                      type="number"
                      min={1}
                      max={5}
                      bind:value={evaluation.satisfactionRating}
                    />
                  </div>
                  <TextareaField
                    label={$t('enterprise.assessment.helpful_content')}
                    bind:value={evaluation.helpfulContent}
                  />
                  <TextareaField
                    label={$t('enterprise.assessment.improvements')}
                    bind:value={evaluation.improvements}
                  />
                  <TextareaField label={$t('enterprise.assessment.suggestions')} bind:value={evaluation.suggestions} />
                </Field.Set>
              </Field.Group>
              <Button disabled={assessmentApi.busy} onclick={submitEvaluation}
                >{$t('enterprise.assessment.evaluate')}</Button
              >
            </section>
          {/if}
        </div>
      {/if}
    {/snippet}
  </Page.Body>
</Page.Root>
