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
  listArchiveCourseEvidence: vi.fn()
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
  listArchiveCourseEvidence: mocks.listArchiveCourseEvidence
}));
vi.mock('@cio/db/queries/training-plan', () => ({
  lockTrainingPlan: mocks.lockTrainingPlan,
  getTrainingPlan: mocks.getTrainingPlan
}));

import { getTrainingArchiveSummary, publishPlanAssessment, submitTrainingEvaluation } from './assessment';

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
});
