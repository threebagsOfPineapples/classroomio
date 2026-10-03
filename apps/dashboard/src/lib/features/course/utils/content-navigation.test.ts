import { describe, expect, it } from 'vitest';

import {
  getContinueLearningContent,
  getSavedLessonLearningSeconds,
  isContentItemInPath,
  updateCourseSavedLessonLearning
} from './content-navigation';
import { ContentType } from '@cio/utils/constants/content';
import type { Course } from './types';

function courseWithContent(
  resumeLessonId: string | null,
  recentLesson: { isComplete?: boolean; isUnlocked?: boolean; accessible?: boolean } = {}
) {
  return {
    resumeLessonId,
    lessonLearningProgress: [
      { lessonId: 'lesson-recent', effectiveSeconds: 35, lastRecordedAt: '2026-10-03T02:00:00Z' }
    ],
    content: {
      grouped: false,
      sections: [],
      items: [
        { id: 'lesson-first', type: ContentType.Lesson, order: 1, isComplete: false, isUnlocked: true },
        {
          id: 'lesson-recent',
          type: ContentType.Lesson,
          order: 2,
          isComplete: false,
          isUnlocked: true,
          ...recentLesson
        }
      ]
    }
  } as unknown as Course;
}

describe('isContentItemInPath', () => {
  it('returns false when the current path is missing', () => {
    expect(isContentItemInPath('lesson-1', undefined)).toBe(false);
    expect(isContentItemInPath('lesson-1', null)).toBe(false);
    expect(isContentItemInPath('lesson-1', '')).toBe(false);
  });

  it('matches content ids as exact pathname segments', () => {
    expect(isContentItemInPath('lesson-1', '/courses/abc/lessons/lesson-1')).toBe(true);
    expect(isContentItemInPath('lesson-1', '/courses/abc/lessons/lesson-10')).toBe(false);
  });
});

describe('continue learning navigation', () => {
  it('selects a saved partially learned later lesson', () => {
    expect(getContinueLearningContent(courseWithContent('lesson-recent'))?.id).toBe('lesson-recent');
  });

  it.each([{ isComplete: true }, { isUnlocked: false }, { accessible: false }])(
    'falls back when the saved lesson is complete or unavailable: %o',
    (recentLesson) => {
      expect(getContinueLearningContent(courseWithContent('lesson-recent', recentLesson))?.id).toBe('lesson-first');
    }
  );

  it('falls back when no saved lesson remains and returns nothing for an empty course', () => {
    expect(getContinueLearningContent(courseWithContent(null))?.id).toBe('lesson-first');
    expect(getContinueLearningContent(courseWithContent('lesson-deleted'))?.id).toBe('lesson-first');
    expect(getContinueLearningContent(null)).toBeUndefined();
  });

  it('only shows learning in progress based on persisted seconds', () => {
    expect(getSavedLessonLearningSeconds(courseWithContent('lesson-recent'), 'lesson-recent')).toBe(35);
    expect(getSavedLessonLearningSeconds(courseWithContent('lesson-recent'), 'lesson-first')).toBe(0);
    expect(getSavedLessonLearningSeconds(null, 'lesson-first')).toBe(0);
  });

  it('updates partial lesson status and resume only after the server accepts positive learning', () => {
    const updatedCourse = updateCourseSavedLessonLearning(courseWithContent(null), 'lesson-recent', 50, true);
    expect(updatedCourse.resumeLessonId).toBe('lesson-recent');
    expect(getSavedLessonLearningSeconds(updatedCourse, 'lesson-recent')).toBe(50);
    const visitedCourse = updateCourseSavedLessonLearning(updatedCourse, 'lesson-first', 0, false);
    expect(visitedCourse.resumeLessonId).toBe('lesson-recent');
    expect(getSavedLessonLearningSeconds(visitedCourse, 'lesson-first')).toBe(0);
  });

  it('clears a completed resume target and falls back to another saved partial lesson', () => {
    const course = courseWithContent('lesson-recent', { isComplete: true });
    course.lessonLearningProgress.push({
      lessonId: 'lesson-first',
      effectiveSeconds: 20,
      lastRecordedAt: '2026-10-03T01:00:00Z'
    });
    const updatedCourse = updateCourseSavedLessonLearning(course, 'lesson-recent', 100, true);
    expect(updatedCourse.resumeLessonId).toBe('lesson-first');
    expect(getContinueLearningContent(updatedCourse)?.id).toBe('lesson-first');
  });

  it('preserves recent accepted learning order without inventing a server timestamp', () => {
    const firstCourse = updateCourseSavedLessonLearning(courseWithContent(null), 'lesson-first', 20, true);
    const recentCourse = updateCourseSavedLessonLearning(firstCourse, 'lesson-recent', 50, true);
    recentCourse.content.items[1].isComplete = true;
    const updatedCourse = updateCourseSavedLessonLearning(recentCourse, 'lesson-recent', 100, true);
    expect(updatedCourse.resumeLessonId).toBe('lesson-first');
    expect(
      updatedCourse.lessonLearningProgress.find((record) => record.lessonId === 'lesson-first')?.lastRecordedAt
    ).toBeNull();
  });
});
