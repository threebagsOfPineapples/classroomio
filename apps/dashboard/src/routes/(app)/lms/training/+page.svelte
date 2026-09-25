<script lang="ts">
  import { currentOrg } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import { t } from '$lib/utils/functions/translations';
  import { coursesApi } from '$features/course/api';
  import { getStudentCourseContinuePath } from '$features/course/utils/student-course-navigation';
  import { myTrainingApi } from '$lib/features/enterprise/api/my-training.svelte';
  import { getTrainingCourseProgress, getTrainingPlanProgress } from '$lib/features/enterprise/utils/my-training-utils';
  import { trainingResultKey } from '$lib/features/enterprise/utils/training-labels';
  import { Button } from '@cio/ui/base/button';
  import { Progress } from '@cio/ui/base/progress';
  import * as Page from '@cio/ui/base/page';

  let lastLoadKey = '';
  let courseDataReady = $state(false);

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
    courseDataReady = false;
    void myTrainingApi.load(organizationId, profileId);
    void coursesApi.getEnrolledCourses().then((response) => {
      if (lastLoadKey === loadKey) courseDataReady = !!response;
    });
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
        <p role="alert" class="rounded-md bg-red-50 p-3 text-red-700">{myTrainingApi.error}</p>
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
                    <p class="ui:text-muted-foreground text-sm">{assignment.code}</p>
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
                {#each assignment.courses as course (course.id)}
                  {@const enrolledCourse = courseDataReady
                    ? coursesApi.enrolledCourses.find((item) => item.id === course.id)
                    : undefined}
                  {@const courseProgress = getTrainingCourseProgress(enrolledCourse)}
                  <div class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                    <div>
                      <p class="font-medium">{course.title}</p>
                      {#if course.dueAt}
                        <p class="ui:text-muted-foreground text-sm">
                          {$t('enterprise.my_training.due')}: {new Date(course.dueAt).toLocaleDateString()}
                        </p>
                      {/if}
                      <p class="ui:text-muted-foreground text-sm">
                        {$t('enterprise.my_training.progress')}:
                        {courseProgress === null ? $t('enterprise.my_training.pending') : `${courseProgress}%`}
                      </p>
                    </div>
                    {#if enrolledCourse}
                      <Button href={getStudentCourseContinuePath(course.id)} size="sm">
                        {$t('enterprise.my_training.continue')}
                      </Button>
                    {/if}
                  </div>
                {/each}
              </div>
            </details>
          {/each}
        </div>
      {/if}
    {/snippet}
  </Page.Body>
</Page.Root>
