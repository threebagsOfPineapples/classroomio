<script lang="ts">
  import { Button } from '@cio/ui/base/button';
  import { Badge } from '@cio/ui/base/badge';
  import { t, locale } from '$lib/utils/functions/translations';
  import type { AssessmentTask } from '../utils/types';

  let {
    tasks,
    onRetry,
    checking = false
  }: { tasks: AssessmentTask[]; onRetry: () => void; checking?: boolean } = $props();

  function dateLabel(value: string | null) {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleString($locale === 'zh' ? 'zh-CN' : $locale, { dateStyle: 'short', timeStyle: 'short' });
  }
</script>

<ul class="ui:border-border ui:bg-background divide-y rounded-lg border">
  {#each tasks as task (task.exercise.id)}
    <li class="grid min-w-0 gap-4 p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
      <div class="min-w-0 space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{$t(task.exercise.isExam ? 'learner_tasks.exam' : 'learner_tasks.assignment')}</Badge
          >
          <h3 class="font-semibold break-words">{task.exercise.title}</h3>
        </div>
        <a
          class="ui:text-muted-foreground text-sm underline-offset-4 hover:underline"
          href={`/courses/${task.exercise.lesson.course.id}/lessons`}
        >
          {task.exercise.lesson.course.title}
        </a>
      </div>
      <div class="ui:text-muted-foreground space-y-1 text-sm">
        {#if task.exercise.isExam}
          <p>{$t('learner_tasks.opens_at')}: {dateLabel(task.exercise.opensAt)}</p>
          <p>{$t('learner_tasks.closes_at')}: {dateLabel(task.exercise.closesAt)}</p>
          {#if task.exercise.durationMinutes}
            <p>{$t('learner_tasks.duration', { minutes: task.exercise.durationMinutes })}</p>
          {/if}
        {:else}
          <p>{$t('learner_tasks.due_at')}: {dateLabel(task.exercise.dueBy)}</p>
        {/if}
      </div>
      <div class="space-y-2 text-sm">
        <div class="flex flex-wrap items-center gap-2">
          <Badge variant={task.submissionState === 'graded' ? 'secondary' : 'outline'}>
            {$t(task.submissionState === 'grading' ? 'exercises.in_progress' : `exercises.${task.submissionState}`)}
          </Badge>
          {#if task.exercise.isExam || ['unknown', 'unavailable'].includes(task.state)}
            <span class="ui:text-muted-foreground">{$t(`learner_tasks.state_${task.state}`)}</span>
          {/if}
        </div>
        {#if task.submissionState === 'graded'}
          <p>{$t('learner_tasks.score')}: {task.submission?.total ?? '—'} / {task.totalPoints}</p>
        {/if}
        {#if task.exercise.isExam && task.exercise.activeAttemptExpiresAt && task.state === 'in_progress'}
          <p class="ui:text-muted-foreground">
            {$t('learner_tasks.attempt_due')}: {dateLabel(task.exercise.activeAttemptExpiresAt)}
          </p>
        {/if}
      </div>
      <div class="flex flex-wrap items-center gap-2 md:justify-end">
        {#if task.action}
          <Button href={task.href} size="sm" variant={task.action === 'result' ? 'outline' : 'default'}>
            {$t(`learner_tasks.action_${task.action}`)}
          </Button>
        {:else if task.access === 'denied'}
          <span class="ui:text-muted-foreground text-sm">{$t('learner_tasks.access_unavailable')}</span>
        {:else if task.state === 'unknown' || (['submitted', 'graded'].includes(task.state) && !checking)}
          <Button size="sm" variant="outline" onclick={onRetry} disabled={checking}
            >{$t('enterprise.ui_v2.retry')}</Button
          >
        {:else if checking}
          <span class="ui:text-muted-foreground text-sm">{$t('learner_tasks.checking')}</span>
        {/if}
      </div>
    </li>
  {/each}
</ul>
