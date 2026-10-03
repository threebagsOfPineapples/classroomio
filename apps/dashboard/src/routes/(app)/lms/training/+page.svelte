<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { currentOrg } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import { t } from '$lib/utils/functions/translations';
  import { CoursesApi } from '$features/course/api/courses.svelte';
  import { LMSExercisesApi } from '$features/lms/api/exercises.svelte';
  import { getAssessmentTasks } from '$features/lms/utils/assessment-tasks';
  import TrainingLearningActions from '$features/lms/components/training-learning-actions.svelte';
  import { myTrainingApi } from '$lib/features/enterprise/api/my-training.svelte';
  import { getTrainingPlanProgress } from '$lib/features/enterprise/utils/my-training-utils';
  import { trainingResultKey, trainingStatusKey } from '$lib/features/enterprise/utils/training-labels';
  import { Button } from '@cio/ui/base/button';
  import { Progress } from '@cio/ui/base/progress';
  import * as Page from '@cio/ui/base/page';

  let lastLoadKey = '';
  const coursesApi = new CoursesApi();
  const exercisesApi = new LMSExercisesApi();
  let courseDataReady = $state(false);
  let coursesFailed = $state(false);
  let now = $state(Date.now());
  const tasks = $derived(getAssessmentTasks(exercisesApi.exercises, exercisesApi.examAccess, now));

  async function loadCourses() {
    courseDataReady = false;
    coursesFailed = false;
    const loadKey = lastLoadKey;
    const response = await coursesApi.getEnrolledCourses();
    if (lastLoadKey !== loadKey) return;

    courseDataReady = !!response;
    coursesFailed = !response;
  }

  function loadTasks() {
    now = Date.now();
    return exercisesApi.load($currentOrg.id);
  }

  $effect(() => {
    const organizationId = $currentOrg.id;
    const profileId = $profile.id;
    if (!organizationId || !profileId) {
      lastLoadKey = '';
      courseDataReady = false;
      myTrainingApi.clear();
      return;
    }

    const loadKey = `${organizationId}:${profileId}`;
    if (lastLoadKey === loadKey) return;

    lastLoadKey = loadKey;
    untrack(() => {
      void myTrainingApi.load(organizationId, profileId);
      void loadCourses();
      void loadTasks();
    });
  });

  onMount(() => {
    const timer = window.setInterval(() => {
      now = Date.now();
    }, 30_000);
    return () => window.clearInterval(timer);
  });
</script>

<svelte:head>
  <title>{$t('enterprise.my_training.title')}</title>
</svelte:head>

<Page.Root role="main" class="mx-auto max-w-5xl px-6">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>{$t('enterprise.my_training.title')}</Page.Title>
      <Page.Subtitle>{$t('enterprise.my_training.subtitle')}</Page.Subtitle>
    </Page.HeaderContent>
    <Page.Action>
      <Button href="/lms/mylearning" variant="secondary">{$t('enterprise.my_training.my_courses')}</Button>
      <Button href="/lms/training/archive" variant="secondary">{$t('enterprise.assessment.archive')}</Button>
    </Page.Action>
  </Page.Header>
  <Page.Body>
    {#snippet child()}
      {#if myTrainingApi.error}
        <div role="alert" class="training-panel space-y-3">
          <p>{myTrainingApi.error}</p>
          <Button size="sm" variant="outline" onclick={() => myTrainingApi.load($currentOrg.id, $profile.id)}>
            {$t('enterprise.ui_v2.retry')}
          </Button>
        </div>
      {:else if myTrainingApi.loading}
        <p>{$t('enterprise.loading')}</p>
      {:else if myTrainingApi.assignments.length === 0}
        <p class="ui:text-muted-foreground">{$t('enterprise.my_training.empty')}</p>
      {:else}
        <div class="space-y-4 pb-8">
          {#each myTrainingApi.assignments as assignment (assignment.id)}
            {@const planProgress = courseDataReady
              ? getTrainingPlanProgress(assignment, coursesApi.enrolledCourses)
              : null}
            <details class="rounded-lg border p-5">
              <summary class="cursor-pointer space-y-3">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 class="text-lg font-semibold">{assignment.name}</h2>
                    <p class="ui:text-muted-foreground text-sm">
                      {assignment.code} · {$t(trainingStatusKey(assignment.enrollmentStatus))}
                    </p>
                  </div>
                  <span class="ui:text-muted-foreground text-sm">
                    {new Date(assignment.startAt).toLocaleDateString()} –
                    {new Date(assignment.endAt).toLocaleDateString()}
                  </span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-sm">{$t('enterprise.my_training.progress')}</span>
                  {#if planProgress === null}
                    <span class="ui:text-muted-foreground text-sm">{$t('enterprise.my_training.pending')}</span>
                  {:else}
                    <Progress value={planProgress} max={100} class="max-w-48" />
                    <span class="text-sm">{planProgress}%</span>
                  {/if}
                </div>
              </summary>
              <div class="mt-5 space-y-4 border-t pt-4">
                {#if assignment.description}<p class="text-sm">{assignment.description}</p>{/if}
                <p class="text-sm">
                  {$t('enterprise.assessment.score')}: {assignment.finalScore ?? '—'} · {$t(
                    trainingResultKey(assignment.result)
                  )}
                </p>
                <Button href={`/lms/training/${assignment.enrollmentId}`} variant="secondary" size="sm">
                  {$t('enterprise.assessment.details')}
                </Button>
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
              </div>
            </details>
          {/each}
        </div>
      {/if}
    {/snippet}
  </Page.Body>
</Page.Root>
