import type { LessonLearningRecord } from './types';

export function formatLessonLearningDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  const minuteSeconds = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;

  return hours > 0 ? `${String(hours).padStart(2, '0')}:${minuteSeconds}` : minuteSeconds;
}

export function formatLessonLearningDate(value: string | null | undefined, locale = 'zh', timeZone?: string): string {
  if (!value) return '—';

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone
  }).format(date);
}

export function getLessonLearningStatus(record: Pick<LessonLearningRecord, 'completed' | 'effectiveSeconds'>) {
  if (record.completed) return 'audience.user_analytics.lesson_learning.completed';
  if (record.effectiveSeconds > 0) return 'audience.user_analytics.lesson_learning.in_progress';

  return 'audience.user_analytics.lesson_learning.not_started';
}
