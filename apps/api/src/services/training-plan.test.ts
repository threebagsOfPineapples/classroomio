import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getEnterpriseOverview: vi.fn(),
  getEnterpriseMember: vi.fn(),
  listEnterpriseDepartments: vi.fn(),
  withTrainingPlanTransaction: vi.fn(),
  lockTrainingPlan: vi.fn(),
  getPlanItems: vi.fn(),
  getEligibleTrainingMembers: vi.fn(),
  getOrgTrainingCourses: vi.fn(),
  insertTrainingEnrollments: vi.fn(),
  insertGroupMembersOnConflictDoNothing: vi.fn(),
  publishTrainingPlanRecord: vi.fn(),
  getTrainingPlanDetail: vi.fn(),
  getTrainingPlan: vi.fn(),
  createTrainingPlan: vi.fn(),
  replaceTrainingPlanItems: vi.fn(),
  updateTrainingPlanDraft: vi.fn()
}));

vi.mock('@api/services/enterprise', () => ({ getEnterpriseOverview: mocks.getEnterpriseOverview }));
vi.mock('@cio/db/queries/enterprise', () => ({
  getEnterpriseMember: mocks.getEnterpriseMember,
  listEnterpriseDepartments: mocks.listEnterpriseDepartments
}));
vi.mock('@cio/db/queries/training-plan', () => ({
  withTrainingPlanTransaction: mocks.withTrainingPlanTransaction,
  lockTrainingPlan: mocks.lockTrainingPlan,
  getPlanItems: mocks.getPlanItems,
  getEligibleTrainingMembers: mocks.getEligibleTrainingMembers,
  getOrgTrainingCourses: mocks.getOrgTrainingCourses,
  insertTrainingEnrollments: mocks.insertTrainingEnrollments,
  publishTrainingPlanRecord: mocks.publishTrainingPlanRecord,
  getTrainingPlanDetail: mocks.getTrainingPlanDetail,
  getTrainingPlan: mocks.getTrainingPlan,
  createTrainingPlan: mocks.createTrainingPlan,
  replaceTrainingPlanItems: mocks.replaceTrainingPlanItems,
  updateTrainingPlanDraft: mocks.updateTrainingPlanDraft
}));
vi.mock('@cio/core/services/course/completion-readiness', () => ({ assertCourseCompletionReady: vi.fn() }));
vi.mock('@cio/db/queries/group', () => ({
  insertGroupMembersOnConflictDoNothing: mocks.insertGroupMembersOnConflictDoNothing
}));

import {
  addTrainingPlan,
  editTrainingPlan,
  previewTrainingPlan,
  publishTrainingPlan,
  supplementTrainingPlan
} from './training-plan';

const transaction = { id: 'transaction' };
const plan = { id: 'plan-1', status: 'DRAFT', version: 2 };
const draftWithoutOwner = {
  name: 'Training',
  code: 'training',
  year: 2026,
  planType: 'ANNUAL' as const,
  startAt: '2026-10-01T00:00:00Z',
  endAt: '2026-12-01T00:00:00Z',
  courseIds: ['course-1'],
  targets: [{ targetType: 'USER' as const, memberId: 2 }]
};

describe('training plan publication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEnterpriseOverview.mockResolvedValue({ canManage: true, memberId: 1 });
    mocks.getEnterpriseMember.mockImplementation(async (_organizationId, memberId) => [
      { id: memberId, status: 'ACTIVE', employmentStatus: null, departmentId: null }
    ]);
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
      { id: 2, profileId: 'profile-2', email: null, departmentId: null, departmentIds: [], position: null }
    ]);
    mocks.getOrgTrainingCourses.mockResolvedValue([{ id: 'course-1', groupId: 'group-1' }]);
    mocks.insertTrainingEnrollments.mockResolvedValue([]);
    mocks.insertGroupMembersOnConflictDoNothing.mockResolvedValue(undefined);
    mocks.publishTrainingPlanRecord.mockResolvedValue([]);
    mocks.getTrainingPlanDetail.mockResolvedValue({ plan, courses: [], targets: [], enrollmentCount: 1 });
    mocks.getTrainingPlan.mockResolvedValue(plan);
    mocks.createTrainingPlan.mockResolvedValue([{ id: plan.id }]);
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
    mocks.lockTrainingPlan.mockResolvedValueOnce(plan).mockResolvedValueOnce({ ...plan, status: 'PUBLISHED' });

    await publishTrainingPlan('org-1', 'admin-1', 'plan-1');
    await publishTrainingPlan('org-1', 'admin-1', 'plan-1');

    expect(mocks.insertTrainingEnrollments).toHaveBeenCalledOnce();
    expect(mocks.insertGroupMembersOnConflictDoNothing).toHaveBeenCalledOnce();
    expect(mocks.publishTrainingPlanRecord).toHaveBeenCalledOnce();
  });

  it('keeps an assignment for an employee awaiting account registration', async () => {
    mocks.getEligibleTrainingMembers.mockResolvedValue([
      { id: 2, profileId: null, email: 'employee@example.com', departmentId: null, departmentIds: [], position: null }
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

  it('previews and publishes the same multi-department intersection plus explicit additions', async () => {
    mocks.listEnterpriseDepartments.mockResolvedValue([
      { id: 'team-a', parentId: null, status: 'ACTIVE' },
      { id: 'team-b', parentId: null, status: 'ACTIVE' }
    ]);
    mocks.getEligibleTrainingMembers.mockResolvedValue([
      { id: 2, profileId: 'profile-2', departmentId: null, departmentIds: ['team-a', 'team-b'], position: 'Analyst' },
      { id: 3, profileId: 'profile-3', departmentId: 'team-a', departmentIds: ['team-a'], position: 'Engineer' },
      { id: 4, profileId: null, departmentId: 'team-b', departmentIds: ['team-b'], position: 'Engineer' }
    ]);
    mocks.getPlanItems.mockResolvedValue([
      [{ courseId: 'course-1' }],
      [
        {
          id: 'department-a',
          targetType: 'DEPARTMENT',
          departmentId: 'team-a',
          position: null,
          memberId: null,
          includeDescendants: false
        },
        {
          id: 'department-b',
          targetType: 'DEPARTMENT',
          departmentId: 'team-b',
          position: null,
          memberId: null,
          includeDescendants: false
        },
        {
          id: 'analyst',
          targetType: 'POSITION',
          departmentId: null,
          position: 'Analyst',
          memberId: null,
          includeDescendants: false
        },
        { id: 'extra', targetType: 'USER', departmentId: null, position: null, memberId: 4, includeDescendants: false }
      ]
    ]);

    await expect(previewTrainingPlan('org-1', 'admin-1', 'plan-1')).resolves.toEqual({ count: 2, memberIds: [2, 4] });
    await publishTrainingPlan('org-1', 'admin-1', 'plan-1');

    expect(mocks.insertTrainingEnrollments).toHaveBeenCalledWith(
      [
        {
          organizationId: 'org-1',
          planId: 'plan-1',
          memberId: 2,
          matchedTargetIds: ['department-a', 'department-b', 'analyst'],
          planVersion: 2
        },
        {
          organizationId: 'org-1',
          planId: 'plan-1',
          memberId: 4,
          matchedTargetIds: ['department-b', 'extra'],
          planVersion: 2
        }
      ],
      transaction
    );
    expect(mocks.getEligibleTrainingMembers).toHaveBeenCalledWith('org-1');
    expect(mocks.getEligibleTrainingMembers).toHaveBeenCalledWith('org-1', transaction);
  });

  it('rejects explicit users absent from the legal candidate set in draft and publication', async () => {
    const draft = {
      name: 'Training',
      code: 'training',
      year: 2026,
      planType: 'ANNUAL' as const,
      startAt: '2026-10-01T00:00:00Z',
      endAt: '2026-12-01T00:00:00Z',
      ownerMemberId: 2,
      courseIds: ['course-1'],
      targets: [{ targetType: 'USER' as const, memberId: 99 }]
    };
    await expect(addTrainingPlan('org-1', 'admin-1', draft)).rejects.toThrow('Target employee is invalid');
    expect(mocks.createTrainingPlan).not.toHaveBeenCalled();

    mocks.getEligibleTrainingMembers.mockResolvedValue([]);
    await expect(previewTrainingPlan('org-1', 'admin-1', 'plan-1')).resolves.toEqual({ count: 0, memberIds: [] });
    await expect(publishTrainingPlan('org-1', 'admin-1', 'plan-1')).rejects.toThrow('inactive employee');
    expect(mocks.insertTrainingEnrollments).not.toHaveBeenCalled();
  });

  it('accepts a draft owner and explicit recipient with a null primary department', async () => {
    mocks.getEligibleTrainingMembers.mockResolvedValue([
      { id: 2, profileId: 'profile-2', departmentId: null, departmentIds: ['team-a'], position: null }
    ]);
    await addTrainingPlan('org-1', 'admin-1', {
      name: 'Training',
      code: 'training',
      year: 2026,
      planType: 'ANNUAL',
      startAt: '2026-10-01T00:00:00Z',
      endAt: '2026-12-01T00:00:00Z',
      ownerMemberId: 2,
      courseIds: ['course-1'],
      targets: [{ targetType: 'USER', memberId: 2 }]
    });

    expect(mocks.createTrainingPlan).toHaveBeenCalledOnce();
    expect(mocks.replaceTrainingPlanItems).toHaveBeenCalledWith(
      'plan-1',
      ['course-1'],
      [
        {
          planId: 'plan-1',
          targetType: 'USER',
          departmentId: null,
          position: null,
          memberId: 2,
          includeDescendants: false
        }
      ],
      transaction
    );
  });

  it.each(['create', 'edit'])(
    'allows a departmentless administrator to %s a plan for eligible headquarters learners',
    async (operation) => {
      mocks.getEligibleTrainingMembers.mockResolvedValue([
        { id: 2, profileId: 'profile-2', departmentId: null, departmentIds: ['headquarters-team'], position: null }
      ]);
      if (operation === 'create') await addTrainingPlan('org-1', 'admin-1', draftWithoutOwner);
      else await editTrainingPlan('org-1', 'admin-1', 'plan-1', draftWithoutOwner);

      const write = operation === 'create' ? mocks.createTrainingPlan : mocks.updateTrainingPlanDraft;
      const values = operation === 'create' ? write.mock.calls[0][0] : write.mock.calls[0][2];
      expect(values.ownerMemberId).toBe(1);
      expect(mocks.getEnterpriseMember).toHaveBeenCalledWith('org-1', 1);
      expect(mocks.replaceTrainingPlanItems).toHaveBeenCalledWith(
        'plan-1',
        ['course-1'],
        [
          {
            planId: 'plan-1',
            targetType: 'USER',
            departmentId: null,
            position: null,
            memberId: 2,
            includeDescendants: false
          }
        ],
        transaction
      );
    }
  );

  it.each([
    ['missing or foreign', []],
    ['deactivated', [{ id: 99, status: 'DEACTIVATED', employmentStatus: null }]],
    ['terminated', [{ id: 99, status: 'ACTIVE', employmentStatus: 'TERMINATED' }]]
  ])('rejects a %s plan owner independently of recipient scope', async (_state, owners) => {
    mocks.getEnterpriseMember.mockResolvedValue(owners);
    const draft = { ...draftWithoutOwner, ownerMemberId: 99 };
    await expect(addTrainingPlan('org-1', 'admin-1', draft)).rejects.toThrow('Plan owner must be an active employee');
    await expect(editTrainingPlan('org-1', 'admin-1', 'plan-1', draft)).rejects.toThrow(
      'Plan owner must be an active employee'
    );
    expect(mocks.createTrainingPlan).not.toHaveBeenCalled();
    expect(mocks.updateTrainingPlanDraft).not.toHaveBeenCalled();
    expect(mocks.getEnterpriseMember).toHaveBeenCalledWith('org-1', 99);
  });
});

describe('training plan supplementation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEnterpriseOverview.mockResolvedValue({ canManage: true, memberId: 1 });
    mocks.withTrainingPlanTransaction.mockImplementation((callback) => callback(transaction));
    mocks.lockTrainingPlan.mockResolvedValue({ ...plan, status: 'PUBLISHED' });
    mocks.getPlanItems.mockResolvedValue([[{ courseId: 'course-1' }], []]);
    mocks.getEligibleTrainingMembers.mockResolvedValue([
      { id: 2, profileId: 'profile-2' },
      { id: 3, profileId: 'profile-3' }
    ]);
    mocks.getOrgTrainingCourses.mockResolvedValue([{ id: 'course-1', groupId: 'group-1' }]);
    mocks.insertTrainingEnrollments.mockResolvedValue([{ memberId: 3 }]);
    mocks.getTrainingPlanDetail.mockResolvedValue({ plan, courses: [], targets: [], enrollmentCount: 2 });
  });

  it('grants course access only to newly enrolled employees when some were already assigned', async () => {
    await supplementTrainingPlan('org-1', 'admin-1', 'plan-1', [2, 3]);

    expect(mocks.insertTrainingEnrollments).toHaveBeenCalledWith(
      [
        { organizationId: 'org-1', planId: 'plan-1', memberId: 2, matchedTargetIds: [], planVersion: 2 },
        { organizationId: 'org-1', planId: 'plan-1', memberId: 3, matchedTargetIds: [], planVersion: 2 }
      ],
      transaction
    );
    expect(mocks.insertGroupMembersOnConflictDoNothing).toHaveBeenCalledWith(
      [{ groupId: 'group-1', roleId: 3, profileId: 'profile-3', email: undefined }],
      transaction
    );
  });

  it('rejects members outside the active organization set without assigning anyone', async () => {
    await expect(supplementTrainingPlan('org-1', 'admin-1', 'plan-1', [2, 99])).rejects.toThrow(
      'outside this organization'
    );
    expect(mocks.insertTrainingEnrollments).not.toHaveBeenCalled();
  });

  it('deduplicates repeated manual selections and grants no new access when enrollment already exists', async () => {
    mocks.insertTrainingEnrollments.mockResolvedValue([]);
    await supplementTrainingPlan('org-1', 'admin-1', 'plan-1', [2, 2]);
    await supplementTrainingPlan('org-1', 'admin-1', 'plan-1', [2]);

    const assignment = { organizationId: 'org-1', planId: 'plan-1', memberId: 2, matchedTargetIds: [], planVersion: 2 };
    expect(mocks.insertTrainingEnrollments).toHaveBeenNthCalledWith(1, [assignment], transaction);
    expect(mocks.insertTrainingEnrollments).toHaveBeenNthCalledWith(2, [assignment], transaction);
    expect(mocks.insertGroupMembersOnConflictDoNothing).toHaveBeenNthCalledWith(1, [], transaction);
    expect(mocks.insertGroupMembersOnConflictDoNothing).toHaveBeenNthCalledWith(2, [], transaction);
  });

  it('rejects all manual selections when the headquarters candidate set is empty', async () => {
    mocks.getEligibleTrainingMembers.mockResolvedValue([]);
    await expect(supplementTrainingPlan('org-1', 'admin-1', 'plan-1', [2])).rejects.toThrow(
      'outside this organization'
    );
    expect(mocks.insertTrainingEnrollments).not.toHaveBeenCalled();
  });
});
