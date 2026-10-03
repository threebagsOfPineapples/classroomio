import { describe, expect, it } from 'vitest';
import { ContentType } from '../src/constants/content';
import { getResumeLessonId } from '../src/functions/course-learning';

const contentItems = [
  { id: 'lesson-first', type: ContentType.Lesson, isComplete: false, isUnlocked: true },
  { id: 'lesson-recent', type: ContentType.Lesson, isComplete: false, isUnlocked: true },
  { id: 'lesson-finished', type: ContentType.Lesson, isComplete: true, isUnlocked: true },
  { id: 'lesson-locked', type: ContentType.Lesson, isComplete: false, isUnlocked: false },
  { id: 'lesson-blocked', type: ContentType.Lesson, isComplete: false, isUnlocked: true, accessible: false },
  { id: 'exercise', type: ContentType.Exercise, isComplete: false, isUnlocked: true }
];

describe('saved lesson resume selection', () => {
  it('resumes the most recent partially learned lesson instead of the first incomplete lesson', () => {
    expect(
      getResumeLessonId(
        [
          { id: 'lesson-first', effectiveSeconds: 60, lastRecordedAt: '2026-10-03T01:00:00Z', completed: false },
          { id: 'lesson-recent', effectiveSeconds: 30, lastRecordedAt: '2026-10-03T02:00:00Z', completed: false }
        ],
        contentItems
      )
    ).toBe('lesson-recent');
  });

  it.each(['lesson-finished', 'lesson-locked', 'lesson-blocked', 'exercise', 'lesson-deleted'])(
    'skips completed, locked, blocked, non-lesson, and removed content: %s',
    (id) => {
      expect(
        getResumeLessonId(
          [
            { id: 'lesson-first', effectiveSeconds: 60, lastRecordedAt: '2026-10-03T01:00:00Z', completed: false },
            { id, effectiveSeconds: 120, lastRecordedAt: '2026-10-03T02:00:00Z', completed: false }
          ],
          contentItems
        )
      ).toBe('lesson-first');
    }
  );

  it('ignores mere visits, invalid timestamps, and completed progress records', () => {
    expect(
      getResumeLessonId(
        [
          { id: 'lesson-first', effectiveSeconds: 0, lastRecordedAt: '2026-10-03T01:00:00Z', completed: false },
          { id: 'lesson-recent', effectiveSeconds: 30, lastRecordedAt: 'invalid', completed: false }
        ],
        contentItems
      )
    ).toBeNull();
    expect(
      getResumeLessonId(
        [{ id: 'lesson-recent', effectiveSeconds: 30, lastRecordedAt: '2026-10-03T02:00:00Z', completed: true }],
        contentItems
      )
    ).toBeNull();
    expect(getResumeLessonId([], contentItems)).toBeNull();
  });
});
