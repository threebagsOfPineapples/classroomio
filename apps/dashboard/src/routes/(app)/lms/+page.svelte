<script lang="ts">
  import { resolve } from '$app/paths';
  import { DashboardPage } from '$features/lms/pages';
  import { getGreeting } from '$lib/utils/functions/date';
  import { locale, t } from '$lib/utils/functions/translations';
  import { profile } from '$lib/utils/store/user';
  import { coursesApi } from '$features/course/api';
  import { myTrainingApi } from '$lib/features/enterprise/api/my-training.svelte';
  import { trainingStatusKey } from '$lib/features/enterprise/utils/training-labels';
  import { Button } from '@cio/ui/base/button';
  import * as Page from '@cio/ui/base/page';

  const todayLabel = $derived(
    new Intl.DateTimeFormat($locale === 'zh' ? 'zh-CN' : $locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    }).format(new Date())
  );

  const firstName = $derived($profile.fullname?.trim().split(/\s+/)[0] || $t('dashboard.learner'));

  let totalCompleted = $derived(
    coursesApi.enrolledCourses.reduce((acc, course) => {
      const exercisesCompleted =
        'exercisesCompleted' in course && typeof course.exercisesCompleted === 'number' ? course.exercisesCompleted : 0;

      return acc + (course.progressRate || 0) + exercisesCompleted;
    }, 0)
  );

  let totalLessons = $derived(
    coursesApi.enrolledCourses.reduce((acc, course) => {
      const exercises =
        'exerciseCount' in course && typeof course.exerciseCount === 'number' ? course.exerciseCount : 0;

      return acc + (course.lessonCount || 0) + exercises;
    }, 0)
  );

  let progressPercentage = $derived(totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0);
  let unfinishedTraining = $derived(
    myTrainingApi.assignments
      .filter((assignment) => !['COMPLETED', 'CANCELLED'].includes(assignment.enrollmentStatus))
      .sort((left, right) => new Date(left.endAt).getTime() - new Date(right.endAt).getTime())
  );
</script>

<svelte:head>
  <title>{$t('lms_navigation.home')} · {$t('enterprise.company_name')}</title>
</svelte:head>

<Page.Root class="w-full">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>
        {$t(getGreeting())},
        <span>{firstName}</span>
      </Page.Title>
      <Page.Subtitle>
        {#if totalLessons > 0}
          {$t('dashboard.lms_today_progress', { progress: progressPercentage })}
        {:else}
          {$t('dashboard.lms_today_empty')}
        {/if}
      </Page.Subtitle>
    </Page.HeaderContent>
    <p class="learner-date">{todayLabel}</p>
  </Page.Header>

  <Page.Body>
    {#snippet child()}
      {#if myTrainingApi.loading || myTrainingApi.error || unfinishedTraining.length > 0}
        <section class="training-panel mb-6" aria-label={$t('enterprise.my_training.title')}>
          <div class="mb-3 flex items-center justify-between gap-3">
            <h2 class="text-lg font-semibold">{$t('enterprise.my_training.title')}</h2>
            <Button href="/lms/training" variant="secondary" size="sm">{$t('dashboard.view_more')}</Button>
          </div>
          {#if myTrainingApi.loading}
            <p class="ui:text-muted-foreground text-sm">{$t('enterprise.loading')}</p>
          {:else if myTrainingApi.error}
            <p role="alert" class="text-sm text-red-700">{myTrainingApi.error}</p>
          {:else if myTrainingApi.assignments.length === 0}
            <p class="ui:text-muted-foreground text-sm">{$t('enterprise.my_training.empty')}</p>
          {:else if unfinishedTraining.length === 0}
            <p class="ui:text-muted-foreground text-sm">{$t('enterprise.plans.status_completed')}</p>
          {:else}
            <p class="ui:text-muted-foreground mb-3 text-sm">
              {$t('enterprise.assessment.unfinished_plans')}: {unfinishedTraining.length}
            </p>
            <ul class="space-y-2">
              {#each unfinishedTraining.slice(0, 3) as assignment (assignment.enrollmentId)}
                <li class="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
                  <a
                    href={resolve('/lms/training/[enrollmentId]', { enrollmentId: assignment.enrollmentId })}
                    class="font-medium underline-offset-2 hover:underline"
                  >
                    {assignment.name}
                  </a>
                  <span class="ui:text-muted-foreground">
                    {$t(trainingStatusKey(assignment.enrollmentStatus))} · {$t('enterprise.my_training.due')}
                    {new Date(assignment.endAt).toLocaleDateString($locale === 'zh' ? 'zh-CN' : $locale)}
                  </span>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      {/if}
      <DashboardPage />
    {/snippet}
  </Page.Body>
</Page.Root>
