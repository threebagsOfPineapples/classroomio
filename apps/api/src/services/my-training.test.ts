import { describe, expect, it } from 'vitest';
import { groupMyTrainingAssignments } from './my-training';

describe('employee training assignments', () => {
  it('groups courses under the published assignment without inventing progress', () => {
    const rows = [
      {
        planId: 'plan-1',
        planName: 'Operations onboarding',
        planCode: 'OPS-1',
        planDescription: null,
        planType: 'ONBOARDING',
        planStatus: 'PUBLISHED',
        startAt: '2026-09-01T00:00:00Z',
        endAt: '2026-10-01T00:00:00Z',
        enrollmentStatus: 'NOT_STARTED',
        assignedAt: '2026-09-02T00:00:00Z',
        courseId: 'course-1',
        courseTitle: 'Safety',
        courseSort: 0,
        courseRequired: true,
        courseDueAt: null
      },
      {
        planId: 'plan-1',
        planName: 'Operations onboarding',
        planCode: 'OPS-1',
        planDescription: null,
        planType: 'ONBOARDING',
        planStatus: 'PUBLISHED',
        startAt: '2026-09-01T00:00:00Z',
        endAt: '2026-10-01T00:00:00Z',
        enrollmentStatus: 'NOT_STARTED',
        assignedAt: '2026-09-02T00:00:00Z',
        courseId: 'course-2',
        courseTitle: 'Practice',
        courseSort: 1,
        courseRequired: false,
        courseDueAt: null
      }
    ];

    const assignments = groupMyTrainingAssignments(rows as never);

    expect(assignments).toHaveLength(1);
    expect(assignments[0].courses.map((course) => course.id)).toEqual(['course-1', 'course-2']);
    expect(assignments[0]).not.toHaveProperty('progressPercent');
  });
});
