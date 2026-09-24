import { describe, expect, it } from 'vitest';
import { getTrainingPlanProgress } from './my-training-utils';

describe('training plan progress', () => {
  it('derives progress from enrolled courses and leaves missing course data unknown', () => {
    const assignment = { courses: [{ id: 'course-1' }, { id: 'course-2' }] } as never;
    const enrolledCourses = [
      { id: 'course-1', type: 'SELF_PACED', lessonCount: 1, progressRate: 1, exerciseCount: 0, exercisesCompleted: 0 },
      { id: 'course-2', type: 'SELF_PACED', lessonCount: 2, progressRate: 1, exerciseCount: 0, exercisesCompleted: 0 }
    ] as never;

    expect(getTrainingPlanProgress(assignment, enrolledCourses)).toBe(75);
    expect(getTrainingPlanProgress(assignment, [enrolledCourses[0]] as never)).toBeNull();
  });
});
