import { describe, expect, it } from 'vitest';
import {
  formatLessonLearningDate,
  formatLessonLearningDuration,
  getLessonLearningStatus
} from './lesson-learning-utils';

describe('lesson learning record display', () => {
  it('distinguishes a recorded zero duration from an unknown video duration', () => {
    expect(formatLessonLearningDuration(0)).toBe('00:00');
    expect(formatLessonLearningDuration(null)).toBe('—');
    expect(formatLessonLearningDuration(undefined)).toBe('—');
  });

  it('preserves cumulative hours without wrapping after a day', () => {
    expect(formatLessonLearningDuration(61)).toBe('01:01');
    expect(formatLessonLearningDuration(3661)).toBe('01:01:01');
    expect(formatLessonLearningDuration(90061)).toBe('25:01:01');
  });

  it('does not show invalid or missing activity dates as a real date', () => {
    expect(formatLessonLearningDate(null)).toBe('—');
    expect(formatLessonLearningDate('invalid')).toBe('—');
    expect(formatLessonLearningDate('2026-10-03T00:01:02.000Z', 'zh', 'Asia/Shanghai')).toContain('08:01:02');
  });

  it('uses saved effective activity to distinguish not started from learning', () => {
    expect(getLessonLearningStatus({ completed: false, effectiveSeconds: 0 })).toBe(
      'audience.user_analytics.lesson_learning.not_started'
    );
    expect(getLessonLearningStatus({ completed: false, effectiveSeconds: 5 })).toBe(
      'audience.user_analytics.lesson_learning.in_progress'
    );
    expect(getLessonLearningStatus({ completed: true, effectiveSeconds: 61 })).toBe(
      'audience.user_analytics.lesson_learning.completed'
    );
  });
});
