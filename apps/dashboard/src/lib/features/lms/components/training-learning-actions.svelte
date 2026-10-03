<script lang="ts">
  import { Button } from '@cio/ui/base/button';
  import { Progress } from '@cio/ui/base/progress';
  import { t, locale } from '$lib/utils/functions/translations';
  import type { MyTrainingAssignment } from '$features/enterprise/utils/types';
  import type { UserEnrolledCourses } from '$features/course/types';
  import { getCourseLearningAction } from '$features/course/utils/course-learning';
  import { getTrainingCourseProgress } from '$features/enterprise/utils/my-training-utils';
  import type { AssessmentTask } from '../utils/types';
  import AssessmentTaskList from './assessment-task-list.svelte';

  let {
    assignment,
    courses,
    tasks,
    coursesLoading = false,
    coursesError = false,
    tasksLoading = false,
    tasksError = false,
    checkingAccess = false,
    onRetryCourses,
    onRetryTasks
  }: {
    assignment: MyTrainingAssignment;
    courses: UserEnrolledCourses;
    tasks: AssessmentTask[];
    coursesLoading?: boolean;
    coursesError?: boolean;
    tasksLoading?: boolean;
    tasksError?: boolean;
    checkingAccess?: boolean;
    onRetryCourses: () => void;
    onRetryTasks: () => void;
  } = $props();

  const courseIds = $derived(new Set(assignment.courses.map((course) => course.id)));
  const courseTasks = $derived(tasks.filter((task) => courseIds.has(task.exercise.lesson.course.id)));

  function dateLabel(value: string) {
    return new Date(value).toLocaleDateString($locale === 'zh' ? 'zh-CN' : $locale);
  }
</script>

<div class="space-y-6">
  <section class="space-y-3" aria-label={$t('learner_tasks.training_courses')}>
    <h3 class="font-semibold">{$t('learner_tasks.training_courses')}</h3>
    {#if coursesLoading}
      <p class="ui:text-muted-foreground text-sm" role="status">{$t('enterprise.loading')}</p>
    {:else if coursesError}
      <div class="space-y-3" role="alert">
        <p class="text-sm">{$t('learner_tasks.courses_load_failed')}</p>
        <Button size="sm" variant="outline" onclick={onRetryCourses}>{$t('enterprise.ui_v2.retry')}</Button>
      </div>
    {:else}
      <ul class="divide-y">
        {#each assignment.courses as course (course.id)}
          {@const enrolledCourse = courses.find((item) => item.id === course.id)}
          {@const courseProgress = getTrainingCourseProgress(enrolledCourse)}
          {@const action = enrolledCourse ? getCourseLearningAction(enrolledCourse) : null}
          <li class="flex flex-wrap items-center justify-between gap-3 py-3">
            <div class="min-w-0 flex-1 space-y-2">
              <h4 class="font-medium break-words">{course.title}</h4>
              <p class="ui:text-muted-foreground text-sm">
                {$t(course.required ? 'enterprise.learner_home.required' : 'enterprise.learner_home.optional')}
                {#if course.dueAt}
                  · {$t('enterprise.my_training.due')}: {dateLabel(course.dueAt)}{/if}
              </p>
              <div class="flex items-center gap-3">
                {#if courseProgress !== null}
                  <Progress value={courseProgress} max={100} class="max-w-40" />
                  <span class="text-sm">{courseProgress}%</span>
                {:else}
                  <span class="ui:text-muted-foreground text-sm">{$t('enterprise.my_training.progress')}: —</span>
                {/if}
              </div>
              {#if !enrolledCourse}<p class="ui:text-muted-foreground text-sm">
                  {$t('learner_tasks.course_unavailable')}
                </p>{/if}
            </div>
            {#if action}<Button href={action.href} size="sm">{$t(action.key)}</Button>{/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
  <section class="space-y-3" aria-label={$t('learner_tasks.training_assessments')}>
    <h3 class="font-semibold">{$t('learner_tasks.training_assessments')}</h3>
    {#if tasksLoading}
      <p class="ui:text-muted-foreground text-sm" role="status">{$t('enterprise.loading')}</p>
    {:else if tasksError}
      <div class="space-y-3" role="alert">
        <p class="text-sm">{$t('learner_tasks.load_failed')}</p>
        <Button size="sm" variant="outline" onclick={onRetryTasks}>{$t('enterprise.ui_v2.retry')}</Button>
      </div>
    {:else if courseTasks.length}
      <AssessmentTaskList tasks={courseTasks} onRetry={onRetryTasks} checking={checkingAccess} />
    {:else}
      <p class="ui:text-muted-foreground text-sm">{$t('learner_tasks.training_assessments_empty')}</p>
    {/if}
  </section>
</div>
