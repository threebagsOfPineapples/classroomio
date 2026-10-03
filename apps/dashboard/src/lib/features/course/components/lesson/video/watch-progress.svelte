<script lang="ts">
  import { lessonApi } from '$features/course/api';
  import { t } from '$lib/utils/functions/translations';
  import { formatLessonLearningDuration } from '$features/course/utils/lesson-learning-utils';

  const progress = $derived(lessonApi.lesson?.watchProgress);
  const assets = $derived(progress?.assets ?? []);
  const watchedSeconds = $derived(assets.reduce((seconds, asset) => seconds + asset.watchedSeconds, 0));
  const durationSeconds = $derived(
    assets.length > 0 && assets.every((asset) => asset.durationSeconds && asset.durationSeconds > 0)
      ? assets.reduce((seconds, asset) => seconds + (asset.durationSeconds ?? 0), 0)
      : null
  );
  const isComplete = $derived(progress?.isComplete ?? false);
  const statusKey = $derived(
    isComplete
      ? 'course.navItem.lessons.watch_progress.completed'
      : watchedSeconds > 0
        ? 'course.navItem.lessons.watch_progress.in_progress'
        : 'course.navItem.lessons.watch_progress.not_started'
  );
</script>

<section
  class="ui:border-border ui:bg-muted/30 mb-4 rounded-lg border p-4 text-sm"
  aria-label={$t('course.navItem.lessons.watch_progress.title')}
>
  <div class="flex flex-wrap items-center justify-between gap-2">
    <h2 class="font-medium">{$t('course.navItem.lessons.watch_progress.title')}</h2>
    <span class="ui:text-muted-foreground">{$t(statusKey)}</span>
  </div>
  <p class="mt-2 font-medium tabular-nums" role="status" aria-live="polite">
    {$t('course.navItem.lessons.watch_progress.saved_duration', {
      watched: formatLessonLearningDuration(watchedSeconds),
      duration: formatLessonLearningDuration(durationSeconds)
    })}
  </p>
  {#if assets.length === 1 && assets[0].lastPositionSeconds > 0 && !isComplete}
    <p class="ui:text-muted-foreground mt-1 tabular-nums">
      {$t('course.navItem.lessons.watch_progress.resume_position', {
        position: formatLessonLearningDuration(assets[0].lastPositionSeconds)
      })}
    </p>
  {/if}
  {#if !isComplete}
    <p class="ui:text-muted-foreground mt-2">
      {$t('course.navItem.lessons.watch_progress.threshold', { percent: lessonApi.lesson?.videoWatchThreshold ?? 95 })}
    </p>
    <p class="ui:text-muted-foreground mt-1">{$t('course.navItem.lessons.watch_progress.save_hint')}</p>
  {/if}
</section>
