<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { canRecordCourseLearning } from '$lib/utils/store/app';
  import { lessonApi } from '$features/course/api';
  import { t } from '$lib/utils/functions/translations';
  import { canRecordReadingActivity, getVisibleReadingBounds } from '$features/course/utils/reading-activity';

  let { courseId, lessonId }: { courseId: string; lessonId: string } = $props();

  function isEditing(target: EventTarget | null): boolean {
    return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
  }

  function getReadingSurfaces(): HTMLElement[] {
    const pdfViewer = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="lesson-pdf-viewer"]')).find(
      (viewer) => viewer.dataset.readingLesson === lessonId
    );
    const canvas = pdfViewer?.querySelector('canvas');
    if (pdfViewer?.dataset.presentation === 'fullscreen') return canvas ? [canvas] : [];

    const notes = Array.from(document.querySelectorAll<HTMLElement>('[data-reading-note]')).filter(
      (note) => note.dataset.readingNote === lessonId
    );
    return canvas ? [...notes, canvas] : notes;
  }

  function getVisibleSurfaceBounds(surface: HTMLElement) {
    if (surface.closest('[hidden], [aria-hidden="true"]')) return null;

    const surfaceStyle = getComputedStyle(surface);
    if (surfaceStyle.visibility !== 'visible' || surfaceStyle.display === 'none') return null;

    const clips = [];
    for (let ancestor = surface.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (style.visibility !== 'visible' || style.display === 'none') return null;

      const horizontal = style.overflowX !== 'visible';
      const vertical = style.overflowY !== 'visible';
      if (horizontal || vertical) {
        const bounds = ancestor.getBoundingClientRect();
        clips.push({
          top: bounds.top,
          bottom: bounds.bottom,
          left: bounds.left,
          right: bounds.right,
          horizontal,
          vertical
        });
      }
    }
    const viewport = { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
    const bounds = getVisibleReadingBounds(surface.getBoundingClientRect(), viewport, clips);
    if (!bounds) return null;

    const elementAtCenter = document.elementFromPoint(
      (bounds.left + bounds.right) / 2,
      (bounds.top + bounds.bottom) / 2
    );
    return elementAtCenter && surface.contains(elementAtCenter) ? bounds : null;
  }

  onMount(() => {
    if (!get(canRecordCourseLearning)) return;

    lessonApi.readingProgress = null;
    lessonApi.readingError = false;
    let lastInteraction = Date.now();
    let inFlight = false;
    let disposed = false;
    let pendingPause = false;
    const resources = new Set<string>();
    const recordPdf = (event: Event) => {
      const detail = (event as CustomEvent<{ lessonId: string; resource: string }>).detail;
      if (detail.lessonId === lessonId) resources.add(detail.resource);
    };
    const send = async (forceInactive = false) => {
      if (
        !get(canRecordCourseLearning) ||
        disposed ||
        lessonApi.lesson?.id !== lessonId ||
        lessonApi.readingProgress?.isComplete
      )
        return;

      if (inFlight) {
        if (forceInactive) pendingPause = true;
        return;
      }

      const surfaces = getReadingSurfaces();
      const active =
        !forceInactive &&
        canRecordReadingActivity({
          visible: document.visibilityState === 'visible',
          focused: document.hasFocus(),
          editing: isEditing(document.activeElement),
          hasReadingSurface: surfaces.some((surface) => Boolean(getVisibleSurfaceBounds(surface))),
          lastInteraction,
          now: Date.now()
        });
      const note = surfaces.find((surface) => surface.hasAttribute('data-reading-note'));
      const marker = note?.querySelector('[data-reading-note-end]');
      const noteBounds = note ? getVisibleSurfaceBounds(note) : null;
      if (active && marker && noteBounds) {
        const markerBounds = marker.getBoundingClientRect();
        if (markerBounds.top >= noteBounds.top && markerBounds.bottom <= noteBounds.bottom) resources.add('note');
      }
      inFlight = true;
      try {
        await lessonApi.recordReading(courseId, lessonId, active, [...resources]);
      } finally {
        inFlight = false;
        if (pendingPause) {
          pendingPause = false;
          if (disposed) {
            if (get(canRecordCourseLearning)) void lessonApi.recordReading(courseId, lessonId, false, []);
          } else {
            void send(true);
          }
        }
      }
    };
    const pause = () => {
      lastInteraction = 0;
      void send(true);
    };
    const markInteraction = (event: Event) => {
      const target = event.target;
      const source =
        target instanceof Element
          ? target.closest<HTMLElement>('[data-reading-note], [data-testid="lesson-pdf-viewer"]')
          : null;
      const inReadingSurface = source?.dataset.readingNote === lessonId || source?.dataset.readingLesson === lessonId;
      const isPageScroll = event.type === 'scroll';
      const isReadingKey =
        event instanceof KeyboardEvent &&
        ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key) &&
        (target === document.body || target === document.documentElement);
      if (
        isEditing(target) ||
        (!inReadingSurface && !isReadingKey && ['pointerdown', 'touchstart', 'keydown', 'focusin'].includes(event.type))
      ) {
        if (lastInteraction !== 0) pause();
        return;
      }

      if (
        (inReadingSurface || isPageScroll || isReadingKey) &&
        (event.type !== 'pointermove' || Date.now() - lastInteraction >= 1000) &&
        getReadingSurfaces().some((surface) => getVisibleSurfaceBounds(surface))
      ) {
        lastInteraction = Date.now();
      }
    };
    const resumeVisibleReading = () => {
      if (document.visibilityState !== 'visible' || !document.hasFocus() || isEditing(document.activeElement)) {
        pause();
        return;
      }

      if (getReadingSurfaces().some((surface) => getVisibleSurfaceBounds(surface))) lastInteraction = Date.now();
      void send();
    };
    const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'focusin'];
    for (const event of events) window.addEventListener(event, markInteraction, true);
    window.addEventListener('lesson-reading-resource', recordPdf);
    window.addEventListener('blur', pause);
    window.addEventListener('focus', resumeVisibleReading);
    document.addEventListener('visibilitychange', resumeVisibleReading);
    void send();
    const timer = window.setInterval(() => void send(), 5000);
    return () => {
      disposed = true;
      clearInterval(timer);
      for (const event of events) window.removeEventListener(event, markInteraction, true);
      window.removeEventListener('lesson-reading-resource', recordPdf);
      window.removeEventListener('blur', pause);
      window.removeEventListener('focus', resumeVisibleReading);
      document.removeEventListener('visibilitychange', resumeVisibleReading);
      if (inFlight) pendingPause = true;
      else if (get(canRecordCourseLearning)) void lessonApi.recordReading(courseId, lessonId, false, []);
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
