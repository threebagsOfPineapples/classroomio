import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getEnterpriseOverview: vi.fn(),
  listEnterpriseDepartments: vi.fn(),
  withTrainingPlanTransaction: vi.fn(),
  lockTrainingPlan: vi.fn(),
  getPlanItems: vi.fn(),
  getEligibleTrainingMembers: vi.fn(),
  getOrgTrainingCourses: vi.fn(),
  insertTrainingEnrollments: vi.fn(),
  insertGroupMembersOnConflictDoNothing: vi.fn(),
  publishTrainingPlanRecord: vi.fn(),
  getTrainingPlanDetail: vi.fn()
}));

vi.mock('@api/services/enterprise', () => ({ getEnterpriseOverview: mocks.getEnterpriseOverview }));
vi.mock('@cio/db/queries/enterprise', () => ({ listEnterpriseDepartments: mocks.listEnterpriseDepartments }));
vi.mock('@cio/db/queries/training-plan', () => ({
  withTrainingPlanTransaction: mocks.withTrainingPlanTransaction,
  lockTrainingPlan: mocks.lockTrainingPlan,
  getPlanItems: mocks.getPlanItems,
  getEligibleTrainingMembers: mocks.getEligibleTrainingMembers,
  getOrgTrainingCourses: mocks.getOrgTrainingCourses,
  insertTrainingEnrollments: mocks.insertTrainingEnrollments,
  publishTrainingPlanRecord: mocks.publishTrainingPlanRecord,
  getTrainingPlanDetail: mocks.getTrainingPlanDetail
}));
vi.mock('@cio/db/queries/group', () => ({
  insertGroupMembersOnConflictDoNothing: mocks.insertGroupMembersOnConflictDoNothing
}));

import { publishTrainingPlan } from './training-plan';

const transaction = { id: 'transaction' };
const plan = { id: 'plan-1', status: 'DRAFT', version: 2 };

describe('training plan publication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEnterpriseOverview.mockResolvedValue({ canManage: true, memberId: 1 });
    mocks.withTrainingPlanTransaction.mockImplementation((callback) => callback(transaction));
    mocks.lockTrainingPlan.mockResolvedValue(plan);
    mocks.getPlanItems.mockResolvedValue([
      [{ courseId: 'course-1' }],
      [
        {
          id: 'target-1',
          targetType: 'USER',
          departmentId: null,
          position: null,
          memberId: 2,
          includeDescendants: false
        }
      ]
    ]);
    mocks.listEnterpriseDepartments.mockResolvedValue([]);
    mocks.getEligibleTrainingMembers.mockResolvedValue([
      { id: 2, profileId: 'profile-2', email: null, departmentId: null, position: null }
    ]);
    mocks.getOrgTrainingCourses.mockResolvedValue([{ id: 'course-1', groupId: 'group-1' }]);
    mocks.insertTrainingEnrollments.mockResolvedValue([]);
    mocks.insertGroupMembersOnConflictDoNothing.mockResolvedValue(undefined);
    mocks.publishTrainingPlanRecord.mockResolvedValue([]);
    mocks.getTrainingPlanDetail.mockResolvedValue({ plan, courses: [], targets: [], enrollmentCount: 1 });
  });

  it('creates one assignment, grants course access, and publishes in one transaction', async () => {
    await publishTrainingPlan('org-1', 'admin-1', 'plan-1');

    expect(mocks.insertTrainingEnrollments).toHaveBeenCalledWith(
      [
        {
          organizationId: 'org-1',
          planId: 'plan-1',
          memberId: 2,
          matchedTargetIds: ['target-1'],
          planVersion: 2
        }
      ],
      transaction
    );
    expect(mocks.insertGroupMembersOnConflictDoNothing).toHaveBeenCalledWith(
      [{ groupId: 'group-1', roleId: 3, profileId: 'profile-2', email: undefined }],
      transaction
    );
    expect(mocks.publishTrainingPlanRecord).toHaveBeenCalledOnce();
  });

  it('does not create duplicate assignments after publication', async () => {
    mocks.lockTrainingPlan.mockResolvedValue({ ...plan, status: 'PUBLISHED' });

    await publishTrainingPlan('org-1', 'admin-1', 'plan-1');

    expect(mocks.insertTrainingEnrollments).not.toHaveBeenCalled();
    expect(mocks.insertGroupMembersOnConflictDoNothing).not.toHaveBeenCalled();
    expect(mocks.publishTrainingPlanRecord).not.toHaveBeenCalled();
  });

  it('keeps an assignment for an employee awaiting account registration', async () => {
    mocks.getEligibleTrainingMembers.mockResolvedValue([
      { id: 2, profileId: null, email: 'employee@example.com', departmentId: null, position: null }
    ]);

    await publishTrainingPlan('org-1', 'admin-1', 'plan-1');

    expect(mocks.insertTrainingEnrollments).toHaveBeenCalledWith(
      [
        {
          organizationId: 'org-1',
          planId: 'plan-1',
          memberId: 2,
          matchedTargetIds: ['target-1'],
          planVersion: 2
        }
      ],
      transaction
    );
    expect(mocks.insertGroupMembersOnConflictDoNothing).toHaveBeenCalledWith([], transaction);
  });

  it('does not mark the plan published when course access fails', async () => {
    mocks.insertGroupMembersOnConflictDoNothing.mockRejectedValue(new Error('course assignment failed'));

    await expect(publishTrainingPlan('org-1', 'admin-1', 'plan-1')).rejects.toThrow('course assignment failed');
    expect(mocks.publishTrainingPlanRecord).not.toHaveBeenCalled();
  });

  it('rejects courses outside the active published organization set', async () => {
    mocks.getOrgTrainingCourses.mockResolvedValue([]);

    await expect(publishTrainingPlan('org-1', 'admin-1', 'plan-1')).rejects.toThrow('unavailable course');
    expect(mocks.insertTrainingEnrollments).not.toHaveBeenCalled();
  });
});
