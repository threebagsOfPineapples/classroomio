<script lang="ts">
  import { resolve } from '$app/paths';
  import * as Card from '@cio/ui/base/card';
  import * as Separator from '@cio/ui/base/separator';
  import * as Table from '@cio/ui/base/table';
  import { Badge } from '@cio/ui/base/badge';
  import { locale, t } from '$lib/utils/functions/translations';
  import type { UserCourseAnalytics } from '$features/course/utils/types';
  import {
    formatLessonLearningDate,
    formatLessonLearningDuration,
    getLessonLearningStatus
  } from '$features/course/utils/lesson-learning-utils';

  let { courseId, userCourseAnalytics }: { courseId: string; userCourseAnalytics: UserCourseAnalytics } = $props();
  const records = $derived(userCourseAnalytics.lessonLearningRecords);
  const readingSeconds = $derived(records.reduce((seconds, record) => seconds + record.readingSeconds, 0));
  const watchedSeconds = $derived(records.reduce((seconds, record) => seconds + record.watchedSeconds, 0));
</script>

<Card.Root class="ui:gap-0 ui:overflow-hidden ui:py-0" data-testid="lesson-learning-records">
  <div class="flex flex-col gap-3 px-4 py-4">
    <h2 class="text-sm font-semibold">{$t('audience.user_analytics.lesson_learning.title')}</h2>
    <p class="ui:text-muted-foreground text-sm">{$t('audience.user_analytics.lesson_learning.description')}</p>
    <dl class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div>
        <dt class="ui:text-muted-foreground text-xs">
          {$t('audience.user_analytics.lesson_learning.total_effective')}
        </dt>
        <dd class="mt-1 text-lg font-semibold tabular-nums" data-testid="effective-learning-time">
          {formatLessonLearningDuration(userCourseAnalytics.effectiveLearningSeconds)}
        </dd>
      </div>
      <div>
        <dt class="ui:text-muted-foreground text-xs">{$t('audience.user_analytics.lesson_learning.video_time')}</dt>
        <dd class="mt-1 text-lg font-semibold tabular-nums">{formatLessonLearningDuration(watchedSeconds)}</dd>
      </div>
      <div>
        <dt class="ui:text-muted-foreground text-xs">{$t('audience.user_analytics.lesson_learning.reading_time')}</dt>
        <dd class="mt-1 text-lg font-semibold tabular-nums">{formatLessonLearningDuration(readingSeconds)}</dd>
      </div>
    </dl>
  </div>
  <Separator.Root />

  {#if records.length === 0}
    <p class="ui:text-muted-foreground px-4 py-8 text-center text-sm">
      {$t('audience.user_analytics.lesson_learning.no_lessons')}
    </p>
  {:else}
    <Table.Root class="min-w-[960px]">
      <Table.Header>
        <Table.Row>
          <Table.Head class="min-w-[190px] px-4">{$t('audience.user_analytics.lesson_learning.lesson')}</Table.Head>
          <Table.Head>{$t('audience.user_analytics.lesson_learning.status')}</Table.Head>
          <Table.Head>{$t('audience.user_analytics.lesson_learning.video_time')}</Table.Head>
          <Table.Head>{$t('audience.user_analytics.lesson_learning.reading_time')}</Table.Head>
          <Table.Head>{$t('audience.user_analytics.lesson_learning.first_entered')}</Table.Head>
          <Table.Head>{$t('audience.user_analytics.lesson_learning.last_recorded')}</Table.Head>
          <Table.Head>{$t('audience.user_analytics.lesson_learning.completed_at')}</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each records as record (record.id)}
          <Table.Row data-lesson-id={record.id}>
            <Table.Cell class="px-4 py-3 align-top">
              <a
                href={resolve('/courses/[id]/lessons/[lessonId]', { id: courseId, lessonId: record.id })}
                class="text-sm font-medium hover:underline"
              >
                {record.title}
              </a>
            </Table.Cell>
            <Table.Cell class="align-top">
              <Badge variant={record.completed ? 'success' : record.effectiveSeconds > 0 ? 'secondary' : 'outline'}>
                {$t(getLessonLearningStatus(record))}
              </Badge>
            </Table.Cell>
            <Table.Cell class="align-top tabular-nums">
              <div>{formatLessonLearningDuration(record.watchedSeconds)}</div>
              <div class="ui:text-muted-foreground mt-1 text-xs">
                {$t('audience.user_analytics.lesson_learning.duration')}
                {formatLessonLearningDuration(record.durationSeconds)}
              </div>
              {#if record.lastPositionSeconds !== null && record.watchedSeconds > 0}
                <div class="ui:text-muted-foreground mt-1 text-xs">
                  {$t('audience.user_analytics.lesson_learning.position')}
                  {formatLessonLearningDuration(record.lastPositionSeconds)}
                </div>
              {/if}
            </Table.Cell>
            <Table.Cell class="align-top tabular-nums">{formatLessonLearningDuration(record.readingSeconds)}</Table.Cell
            >
            <Table.Cell class="align-top text-xs tabular-nums">
              {formatLessonLearningDate(record.firstEnteredAt, $locale)}
            </Table.Cell>
            <Table.Cell class="align-top text-xs tabular-nums">
              {formatLessonLearningDate(record.lastRecordedAt, $locale)}
            </Table.Cell>
            <Table.Cell class="align-top text-xs tabular-nums">
              {formatLessonLearningDate(record.completedAt, $locale)}
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
    <p class="ui:text-muted-foreground px-4 py-3 text-xs">
      {$t('audience.user_analytics.lesson_learning.first_entered_help')}
    </p>
  {/if}
</Card.Root>
