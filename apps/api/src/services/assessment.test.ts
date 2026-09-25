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
  getCourseMemberProgressSummaries: vi.fn()
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
  getTrainingPlan: mocks.getTrainingPlan
}));

import {
  getTrainingArchiveSummary,
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
