<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { canRecordCourseLearning } from '$lib/utils/store/app';
  import { lessonApi } from '$features/course/api';
  import { t } from '$lib/utils/functions/translations';

  let { courseId, lessonId }: { courseId: string; lessonId: string } = $props();

  onMount(() => {
    if (!get(canRecordCourseLearning)) return;

    lessonApi.readingProgress = null;
    lessonApi.readingError = false;
    let lastInteraction = Date.now();
    let inFlight = false;
    let disposed = false;
    const resources = new Set<string>();
    const markInteraction = () => {
      lastInteraction = Date.now();
    };
    const recordPdf = (event: Event) => {
      const detail = (event as CustomEvent<{ lessonId: string; resource: string }>).detail;
      if (detail.lessonId === lessonId) resources.add(detail.resource);
    };
    const send = async () => {
      if (
        !get(canRecordCourseLearning) ||
        inFlight ||
        disposed ||
        lessonApi.lesson?.id !== lessonId ||
        lessonApi.readingProgress?.isComplete
      )
        return;

      const active =
        document.visibilityState === 'visible' && document.hasFocus() && Date.now() - lastInteraction < 60000;
      const marker = document.querySelector('[data-reading-note-end]');
      if (active && marker) {
        const bounds = marker.getBoundingClientRect();
        if (bounds.top >= 0 && bounds.bottom <= window.innerHeight) resources.add('note');
      }
      inFlight = true;
      try {
        await lessonApi.recordReading(courseId, lessonId, active, [...resources]);
      } finally {
        inFlight = false;
      }
    };
    const pause = () => {
      lastInteraction = 0;
      void send();
    };
    const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'];
    for (const event of events) window.addEventListener(event, markInteraction, true);
    window.addEventListener('lesson-reading-resource', recordPdf);
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', pause);
    void send();
    const timer = window.setInterval(send, 5000);
    return () => {
      disposed = true;
      clearInterval(timer);
      for (const event of events) window.removeEventListener(event, markInteraction, true);
      window.removeEventListener('lesson-reading-resource', recordPdf);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', pause);
      if (get(canRecordCourseLearning)) void lessonApi.recordReading(courseId, lessonId, false, []);
    };
  });
</script>

<div class="mb-4 rounded-md border p-3 text-sm" role="status">
  {#if lessonApi.readingError}
    {$t('reading_progress.error')}
  {:else if lessonApi.readingProgress?.isComplete}
    {$t('reading_progress.complete')}
  {:else if lessonApi.readingProgress?.supported === false}
    {$t('reading_progress.unsupported')}
  {:else if lessonApi.readingProgress}
    {$t('reading_progress.status', {
      seconds: lessonApi.readingProgress.seconds,
      required: lessonApi.readingProgress.requiredSeconds
    })}
    <span class="ml-2"
      >{$t(
        lessonApi.readingProgress.reachedEnd ? 'reading_progress.end_reached' : 'reading_progress.end_required'
      )}</span
    >
  {:else}
    {$t('reading_progress.loading')}
  {/if}
</div>
