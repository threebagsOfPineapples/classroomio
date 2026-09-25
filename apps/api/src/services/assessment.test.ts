import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getEnterpriseOverview: vi.fn(),
  getEnterpriseEmployees: vi.fn(),
  getAssessmentEnrollment: vi.fn(),
  getAssessmentScheme: vi.fn(),
  createTrainingEvaluation: vi.fn(),
  publishAssessmentScheme: vi.fn(),
  withAssessmentTransaction: vi.fn(),
  lockTrainingPlan: vi.fn(),
  getTrainingPlan: vi.fn(),
  listTrainingPlans: vi.fn(),
  listAssessmentEnrollments: vi.fn(),
  listArchiveCourseEvidence: vi.fn(),
  listPublishedAssessmentEnrollmentsForCourse: vi.fn(),
  listAssessmentPlanCourses: vi.fn(),
  listAssessmentInputs: vi.fn(),
  listCompletedAssessmentSubmissions: vi.fn(),
  getAssessmentScore: vi.fn(),
  saveAssessmentScore: vi.fn(),
  updateAssessmentEnrollment: vi.fn(),
  getProfileByGroupMemberId: vi.fn(),
  getBatchStudentCourseMembership: vi.fn(),
  getCourseTrackableContentCounts: vi.fn(),
  getCourseMemberProgressSummaries: vi.fn(),
  countLearningMinutesForMembers: vi.fn()
}));

vi.mock('@api/services/enterprise', () => ({
  getEnterpriseOverview: mocks.getEnterpriseOverview,
  getEnterpriseEmployees: mocks.getEnterpriseEmployees
}));
vi.mock('@cio/db/queries/assessment', () => ({
  getAssessmentEnrollment: mocks.getAssessmentEnrollment,
  getAssessmentScheme: mocks.getAssessmentScheme,
  createTrainingEvaluation: mocks.createTrainingEvaluation,
  publishAssessmentScheme: mocks.publishAssessmentScheme,
  withAssessmentTransaction: mocks.withAssessmentTransaction,
  listAssessmentEnrollments: mocks.listAssessmentEnrollments,
  listArchiveCourseEvidence: mocks.listArchiveCourseEvidence,
  listPublishedAssessmentEnrollmentsForCourse: mocks.listPublishedAssessmentEnrollmentsForCourse,
  listAssessmentPlanCourses: mocks.listAssessmentPlanCourses,
  listAssessmentInputs: mocks.listAssessmentInputs,
  listCompletedAssessmentSubmissions: mocks.listCompletedAssessmentSubmissions,
  getAssessmentScore: mocks.getAssessmentScore,
  saveAssessmentScore: mocks.saveAssessmentScore,
  updateAssessmentEnrollment: mocks.updateAssessmentEnrollment
}));
vi.mock('@cio/db/queries/course/people', () => ({
  getProfileByGroupMemberId: mocks.getProfileByGroupMemberId
}));
vi.mock('@cio/db/queries/course/member-progress', () => ({
  getBatchStudentCourseMembership: mocks.getBatchStudentCourseMembership,
  getCourseTrackableContentCounts: mocks.getCourseTrackableContentCounts
}));
vi.mock('@api/services/course/member-progress', () => ({
  getCourseMemberProgressSummaries: mocks.getCourseMemberProgressSummaries
}));
vi.mock('@cio/db/queries/training-plan', () => ({
  lockTrainingPlan: mocks.lockTrainingPlan,
  getTrainingPlan: mocks.getTrainingPlan,
  listTrainingPlans: mocks.listTrainingPlans,
  countLearningMinutesForMembers: mocks.countLearningMinutesForMembers
}));

import {
  getTrainingArchiveSummary,
  getTrainingMatrix,
  getTrainingStatistics,
  publishPlanAssessment,
  submitTrainingEvaluation,
  syncAssessmentsForSubmission
} from './assessment';

describe('assessment publication and evaluation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEnterpriseOverview.mockResolvedValue({ canManage: true, memberId: 7 });
    mocks.getEnterpriseEmployees.mockResolvedValue([{ member: { id: 7 } }, { member: { id: 8 } }]);
    mocks.listAssessmentEnrollments.mockResolvedValue([]);
    mocks.listArchiveCourseEvidence.mockResolvedValue([]);
    mocks.listTrainingPlans.mockResolvedValue([]);
    mocks.countLearningMinutesForMembers.mockResolvedValue(0);
    mocks.withAssessmentTransaction.mockImplementation((callback) => callback({}));
    mocks.lockTrainingPlan.mockResolvedValue({ id: 'plan', status: 'PUBLISHED' });
    mocks.getTrainingPlan.mockResolvedValue({ id: 'plan' });
    mocks.getAssessmentScheme.mockResolvedValue({
      id: 'scheme',
      status: 'DRAFT',
      items: [{ weight: 40 }, { weight: 60 }]
    });
    mocks.publishAssessmentScheme.mockResolvedValue([]);
  });

  it('rejects weights below 100 and publishes exactly 100', async () => {
    mocks.getAssessmentScheme.mockResolvedValueOnce({ id: 'scheme', status: 'DRAFT', items: [{ weight: 99 }] });
    await expect(publishPlanAssessment('org', 'admin', 'plan')).rejects.toThrow('weights must total 100');
    expect(mocks.publishAssessmentScheme).not.toHaveBeenCalled();

    await publishPlanAssessment('org', 'admin', 'plan');
    expect(mocks.publishAssessmentScheme).toHaveBeenCalledOnce();
  });

  it('accepts only a completed enrollment owned by the evaluator and prevents duplicates', async () => {
    mocks.getAssessmentEnrollment.mockResolvedValue({
      member: { profileId: 'learner' },
      enrollment: { status: 'COMPLETED' }
    });
    const ratings = {
      contentRating: 5,
      instructorRating: 4,
      usefulnessRating: 5,
      difficultyRating: 3,
      satisfactionRating: 5
    };
    await expect(submitTrainingEvaluation('org', 'other', 'enrollment', ratings)).rejects.toThrow('not visible');
    mocks.createTrainingEvaluation.mockResolvedValueOnce([]);
    await expect(submitTrainingEvaluation('org', 'learner', 'enrollment', ratings)).rejects.toThrow(
      'already submitted'
    );
    expect(mocks.createTrainingEvaluation).toHaveBeenCalledWith({ enrollmentId: 'enrollment', ...ratings });
  });

  it('defaults an archive summary to the current member even for an administrator', async () => {
    const summary = await getTrainingArchiveSummary('org', 'admin');
    expect(summary.trainingCount).toBe(0);
    expect(mocks.listAssessmentEnrollments).toHaveBeenCalledWith('org', undefined, [7]);
    expect(mocks.listArchiveCourseEvidence).toHaveBeenCalledWith('org', undefined, [7]);
    expect(mocks.countLearningMinutesForMembers).toHaveBeenCalledWith('org', [7], []);
  });

  it('counts assignments and completions in their actual Beijing months', async () => {
    mocks.listAssessmentEnrollments.mockResolvedValue([
      {
        enrollment: {
          id: 'enrollment',
          assignedAt: '2026-09-25T00:00:00.000Z',
          completedAt: '2026-10-02T00:00:00.000Z',
          status: 'COMPLETED',
          progressPercent: 100
        },
        plan: {
          id: 'plan',
          name: 'Training',
          planType: 'MANDATORY',
          endAt: '2026-12-31T00:00:00.000Z',
          status: 'PUBLISHED'
        },
        member: { id: 7, email: 'learner@example.com', departmentId: null },
        score: null,
        evaluation: null
      }
    ]);

    const statistics = await getTrainingStatistics('org', 'admin');
    mocks.listArchiveCourseEvidence.mockResolvedValue([
      {
        enrollmentId: 'enrollment',
        courseId: 'course',
        courseTitle: 'Training course',
        certificateEarnedAt: null,
        certificateIssuedAt: null,
        certificateExpiresAt: null,
        certificateStatus: null
      }
    ]);
    mocks.countLearningMinutesForMembers.mockResolvedValueOnce(90);
    const summary = await getTrainingArchiveSummary('org', 'admin');
    expect(summary.actualLearningHours).toBe(1.5);
    expect(mocks.countLearningMinutesForMembers).toHaveBeenLastCalledWith('org', [7], ['course']);
    mocks.countLearningMinutesForMembers.mockResolvedValueOnce(1);
    const oneMinute = await getTrainingArchiveSummary('org', 'admin');
    expect(oneMinute.actualLearningHours).toBe(0.02);
    expect(statistics.monthlyTrend).toEqual([
      { month: '2026-09', assigned: 1, completed: 0 },
      { month: '2026-10', assigned: 0, completed: 1 }
    ]);

    const october = await getTrainingStatistics('org', 'admin', undefined, '2026-10-01', '2026-10-31');
    expect(october.monthlyTrend).toEqual([{ month: '2026-10', assigned: 0, completed: 1 }]);
  });

  it('limits department manager statistics to visible employees and rejects regular employees', async () => {
    mocks.getEnterpriseOverview.mockResolvedValue({
      canManage: false,
      roles: ['DEPARTMENT_MANAGER'],
      memberId: 7
    });

    await getTrainingStatistics('org', 'manager');
    expect(mocks.listAssessmentEnrollments).toHaveBeenCalledWith('org', undefined, [7, 8]);

    mocks.getEnterpriseOverview.mockResolvedValue({ canManage: false, roles: ['EMPLOYEE'], memberId: 7 });
    mocks.listAssessmentEnrollments.mockClear();
    await expect(getTrainingStatistics('org', 'employee')).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.listAssessmentEnrollments).not.toHaveBeenCalled();
  });

  it('shows department managers only plans assigned to their visible employees in the matrix', async () => {
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    mocks.getEnterpriseOverview.mockResolvedValue({
      canManage: false,
      roles: ['DEPARTMENT_MANAGER'],
      memberId: 7
    });
    mocks.getEnterpriseEmployees.mockResolvedValue([
      { member: { id: 7, status: 'ACTIVE', employmentStatus: 'ACTIVE', email: 'manager@example.com' } },
      { member: { id: 8, status: 'ACTIVE', employmentStatus: 'ACTIVE', email: 'learner@example.com' } }
    ]);
    mocks.listTrainingPlans.mockResolvedValue([
      { id: 'visible-plan', name: 'Visible', status: 'PUBLISHED' },
      { id: 'other-plan', name: 'Other', status: 'PUBLISHED' }
    ]);
    mocks.listAssessmentEnrollments.mockResolvedValue([
      {
        enrollment: {
          id: 'enrollment',
          assignedAt: '2026-09-25T00:00:00.000Z',
          completedAt: null,
          status: 'NOT_STARTED',
          progressPercent: null
        },
        plan: {
          id: 'visible-plan',
          name: 'Visible',
          planType: 'MANDATORY',
          endAt: '2026-12-31T00:00:00.000Z',
          status: 'PUBLISHED'
        },
        member: { id: 8, email: 'learner@example.com', departmentId: 'managed' },
        score: null,
        evaluation: null
      }
    ]);
    mocks.listArchiveCourseEvidence.mockResolvedValue([
      {
        enrollmentId: 'enrollment',
        courseId: 'course',
        courseTitle: 'Security',
        certificateEarnedAt: null,
        certificateIssuedAt: '2026-09-01T00:00:00.000Z',
        certificateExpiresAt: expiresAt,
        certificateStatus: 'valid'
      }
    ]);

    const matrix = await getTrainingMatrix('org', 'manager');
    expect(matrix.plans).toEqual([{ id: 'visible-plan', name: 'Visible' }]);
    expect(matrix.employees).toHaveLength(2);
    expect(matrix.employees.find((employee) => employee.memberId === 8)?.cells[0]).toMatchObject({
      nearestCertificateExpiry: expiresAt,
      certificateExpiringSoon: true
    });
    expect(mocks.listAssessmentEnrollments).toHaveBeenCalledWith('org', undefined, [7, 8]);
  });

  it('updates the assigned learner score when a native submission changes', async () => {
    mocks.getProfileByGroupMemberId.mockResolvedValue({ id: 'learner' });
    mocks.listPublishedAssessmentEnrollmentsForCourse.mockResolvedValue([
      { organizationId: 'org', enrollmentId: 'enrollment' }
    ]);
    mocks.getAssessmentEnrollment.mockResolvedValue({
      enrollment: { startedAt: null },
      plan: { id: 'plan' },
      member: { profileId: 'learner' }
    });
    mocks.getAssessmentScheme.mockResolvedValue({
      status: 'PUBLISHED',
      passScore: 60,
      items: [{ id: 'exam', type: 'EXAM', exerciseId: 'exercise', weight: 100, maxScore: 100, required: true }]
    });
    mocks.listAssessmentPlanCourses.mockResolvedValue([{ courseId: 'course', groupId: 'group', required: true }]);
    mocks.listAssessmentInputs.mockResolvedValue([]);
    mocks.getAssessmentScore.mockResolvedValue(null);
    mocks.getCourseTrackableContentCounts.mockResolvedValue({ lessonsCount: 1, exercisesCount: 1 });
    mocks.getBatchStudentCourseMembership.mockResolvedValue(new Set(['learner']));
    mocks.getCourseMemberProgressSummaries.mockResolvedValue(new Map([['learner', { progressPercent: 50 }]]));
    mocks.listCompletedAssessmentSubmissions.mockResolvedValue([{ id: 'submission', total: 80 }]);

    await syncAssessmentsForSubmission('course', 'group-member');

    expect(mocks.listPublishedAssessmentEnrollmentsForCourse).toHaveBeenCalledWith('course', 'learner');
    expect(mocks.getAssessmentEnrollment).toHaveBeenCalledWith('org', 'enrollment', {}, true);
    expect(mocks.saveAssessmentScore).toHaveBeenCalledWith(
      'enrollment',
      expect.objectContaining({ finalScore: 80, result: 'PASS' }),
      [expect.objectContaining({ itemId: 'exam', sourceId: 'submission', rawScore: 80 })],
      {}
    );
    expect(mocks.updateAssessmentEnrollment).toHaveBeenCalledWith(
      'enrollment',
      expect.objectContaining({ status: 'IN_PROGRESS', progressPercent: 50, finalScore: 80 }),
      {}
    );
  });
});
