import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getOrgIdByCourseId: vi.fn(),
  getBatchStudentCourseMembership: vi.fn(),
  recordLearningMinute: vi.fn()
}));

vi.mock('@cio/db/queries/course', () => ({ getOrgIdByCourseId: mocks.getOrgIdByCourseId }));
vi.mock('@cio/db/queries/course/member-progress', () => ({
  getBatchStudentCourseMembership: mocks.getBatchStudentCourseMembership
}));
vi.mock('@cio/db/queries/training-plan', () => ({ recordLearningMinute: mocks.recordLearningMinute }));

import { groupMyTrainingAssignments, recordCourseLearning } from './my-training';

describe('employee training assignments', () => {
  it('groups courses under the published assignment without inventing progress', () => {
    const rows = [
      {
        enrollmentId: 'enrollment-1',
        planId: 'plan-1',
        planName: 'Operations onboarding',
        planCode: 'OPS-1',
        planDescription: null,
        planType: 'ONBOARDING',
        planStatus: 'PUBLISHED',
        startAt: '2026-09-01T00:00:00Z',
        endAt: '2026-10-01T00:00:00Z',
        enrollmentStatus: 'NOT_STARTED',
        result: 'PENDING',
        finalScore: null,
        scoreCalculatedAt: null,
        progressPercent: null,
        evaluatedAt: null,
        assignedAt: '2026-09-02T00:00:00Z',
        courseId: 'course-1',
        courseTitle: 'Safety',
        courseSort: 0,
        courseRequired: true,
        courseDueAt: null
      },
      {
        enrollmentId: 'enrollment-1',
        planId: 'plan-1',
        planName: 'Operations onboarding',
        planCode: 'OPS-1',
        planDescription: null,
        planType: 'ONBOARDING',
        planStatus: 'PUBLISHED',
        startAt: '2026-09-01T00:00:00Z',
        endAt: '2026-10-01T00:00:00Z',
        enrollmentStatus: 'NOT_STARTED',
        result: 'PENDING',
        finalScore: null,
        scoreCalculatedAt: null,
        progressPercent: null,
        evaluatedAt: null,
        assignedAt: '2026-09-02T00:00:00Z',
        courseId: 'course-2',
        courseTitle: 'Practice',
        courseSort: 1,
        courseRequired: false,
        courseDueAt: null
      }
    ];

    const exams = [
      {
        enrollmentId: 'enrollment-1',
        exerciseId: 'exam-1',
        courseId: 'course-1',
        title: 'Safety exam',
        opensAt: '2026-09-27T00:00:00Z',
        closesAt: '2026-09-28T00:00:00Z'
      }
    ];
    const assignments = groupMyTrainingAssignments(rows as never, [...exams, ...exams] as never);

    expect(assignments).toHaveLength(1);
    expect(assignments[0].courses.map((course) => course.id)).toEqual(['course-1', 'course-2']);
    expect(assignments[0].progressPercent).toBeNull();
    expect(assignments[0].exams).toEqual([
      {
        id: 'exam-1',
        courseId: 'course-1',
        title: 'Safety exam',
        opensAt: '2026-09-27T00:00:00Z',
        closesAt: '2026-09-28T00:00:00Z'
      }
    ]);
  });
});

describe('learning activity', () => {
  it('records a minute only for a course in the current organization with learner membership', async () => {
    vi.clearAllMocks();
    mocks.getOrgIdByCourseId.mockResolvedValue('other-org');
    await expect(recordCourseLearning('org', 'learner', 'course')).rejects.toMatchObject({ statusCode: 404 });

    mocks.getOrgIdByCourseId.mockResolvedValue('org');
    mocks.getBatchStudentCourseMembership.mockResolvedValue(new Map());
    await expect(recordCourseLearning('org', 'learner', 'course')).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.recordLearningMinute).not.toHaveBeenCalled();

    mocks.getBatchStudentCourseMembership.mockResolvedValue(new Map([['learner', { groupMemberId: 1 }]]));
    await recordCourseLearning('org', 'learner', 'course');
    expect(mocks.recordLearningMinute).toHaveBeenCalledWith('org', 'learner', 'course');
  });
});
