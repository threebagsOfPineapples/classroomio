import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  overview: vi.fn(),
  lock: vi.fn(),
  extend: vi.fn(),
  remind: vi.fn(),
  exercises: vi.fn(),
  grant: vi.fn(),
  transaction: {}
}));
vi.mock('@api/services/enterprise', () => ({ getEnterpriseOverview: mocks.overview }));
vi.mock('@cio/core/services/course/completion-readiness', () => ({ assertCourseCompletionReady: vi.fn() }));
vi.mock('@cio/db/queries/enterprise', () => ({ listEnterpriseDepartments: vi.fn() }));
vi.mock('@cio/db/queries/group', () => ({
  insertGroupMembersOnConflictDoNothing: vi.fn(),
  getGroupMemberIdByCourseAndProfile: async () => 'group-member-1'
}));
vi.mock('@cio/db/queries/assessment', () => ({
  listAssessmentPlanCourses: async () => [{ courseId: 'course-1' }],
  listAssessmentExercises: mocks.exercises
}));
vi.mock('@cio/db/queries/exercise', () => ({ grantExamMakeup: mocks.grant }));
vi.mock('@cio/db/queries/training-plan', () => ({
  lockTrainingPlan: mocks.lock,
  extendTrainingPlanRecord: mocks.extend,
  remindTrainingEnrollments: mocks.remind,
  getEligibleTrainingMembers: async () => [
    { id: 1, profileId: 'employee-1' },
    { id: 2, profileId: null }
  ],
  withTrainingPlanTransaction: async (callback: (transaction: object) => Promise<void>) => callback(mocks.transaction),
  getTrainingPlanDetail: async () => ({ plan: { id: 'plan-1' }, makeupMemberIds: [1] })
}));

import { extendTrainingPlan, remindTrainingPlan, grantTrainingMakeup } from '@api/services/training-plan';

const previousEndAt = '2099-01-01T00:00:00.000Z';
const endAt = '2099-02-01T00:00:00.000Z';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.overview.mockResolvedValue({ canManage: true });
  mocks.lock.mockResolvedValue({ status: 'PUBLISHED', startAt: '2098-01-01T00:00:00.000Z', endAt: previousEndAt });
});

it('延期在锁定计划的同一事务中执行', async () => {
  await extendTrainingPlan('org-1', 'user-1', 'plan-1', previousEndAt, endAt);
  expect(mocks.extend).toHaveBeenCalledWith('org-1', 'plan-1', endAt, mocks.transaction);
});

it('拒绝覆盖别人修改的截止时间', async () => {
  await expect(extendTrainingPlan('org-1', 'user-1', 'plan-1', endAt, endAt)).rejects.toMatchObject({
    statusCode: 400
  });
  expect(mocks.extend).not.toHaveBeenCalled();
});

it('不能缩短期限', async () => {
  await expect(extendTrainingPlan('org-1', 'user-1', 'plan-1', previousEndAt, previousEndAt)).rejects.toMatchObject({
    statusCode: 400
  });
  expect(mocks.extend).not.toHaveBeenCalled();
});

it('拒绝非管理人员', async () => {
  mocks.overview.mockResolvedValue({ canManage: false });
  await expect(extendTrainingPlan('org-1', 'user-1', 'plan-1', previousEndAt, endAt)).rejects.toMatchObject({
    statusCode: 403
  });
  expect(mocks.extend).not.toHaveBeenCalled();
});

it('催学只向有账号的有效员工写入提醒', async () => {
  mocks.lock.mockResolvedValue({ status: 'PUBLISHED', startAt: '2000-01-01T00:00:00Z', endAt });
  mocks.remind.mockResolvedValue([{ memberId: 1 }]);
  await expect(remindTrainingPlan('org-1', 'user-1', 'plan-1')).resolves.toEqual({ count: 1 });
  expect(mocks.remind).toHaveBeenCalledWith('org-1', 'plan-1', [1], 'user-1', mocks.transaction);
});

it('已截止的培训需要先延期再催学', async () => {
  mocks.lock.mockResolvedValue({ status: 'PUBLISHED', startAt: '2000-01-01T00:00:00Z', endAt: '2001-01-01T00:00:00Z' });
  await expect(remindTrainingPlan('org-1', 'user-1', 'plan-1')).rejects.toMatchObject({ statusCode: 400 });
  expect(mocks.remind).not.toHaveBeenCalled();
});

const makeup = {
  exerciseId: 'exam-1',
  memberIds: [1],
  opensAt: '2098-12-01T00:00:00Z',
  closesAt: '2098-12-02T00:00:00Z'
};

it('补考仅授权计划中的有效员工，并保留事务锁', async () => {
  mocks.exercises.mockResolvedValue([{ id: 'exam-1', courseId: 'course-1', isExam: true }]);
  mocks.grant.mockResolvedValue(true);
  await expect(grantTrainingMakeup('org-1', 'admin-1', 'plan-1', makeup)).resolves.toEqual({ count: 1, skipped: 0 });
  expect(mocks.grant).toHaveBeenCalledWith(
    'exam-1',
    'group-member-1',
    makeup.opensAt,
    makeup.closesAt,
    'admin-1',
    mocks.transaction
  );
});

it('补考拒绝无管理权限、其他计划考试及无账号员工', async () => {
  mocks.overview.mockResolvedValue({ canManage: false });
  await expect(grantTrainingMakeup('org-1', 'user-1', 'plan-1', makeup)).rejects.toMatchObject({ statusCode: 403 });
  mocks.overview.mockResolvedValue({ canManage: true });
  mocks.exercises.mockResolvedValue([]);
  await expect(grantTrainingMakeup('org-1', 'admin-1', 'plan-1', makeup)).rejects.toMatchObject({ statusCode: 400 });
  mocks.exercises.mockResolvedValue([{ id: 'exam-1', courseId: 'course-1', isExam: true }]);
  await expect(grantTrainingMakeup('org-1', 'admin-1', 'plan-1', { ...makeup, memberIds: [2] })).rejects.toMatchObject({
    statusCode: 400
  });
  expect(mocks.grant).not.toHaveBeenCalled();
});

it('补考窗口不能超过培训期限，正在考试的员工计入跳过', async () => {
  mocks.exercises.mockResolvedValue([{ id: 'exam-1', courseId: 'course-1', isExam: true }]);
  await expect(grantTrainingMakeup('org-1', 'admin-1', 'plan-1', { ...makeup, closesAt: endAt })).rejects.toMatchObject(
    { statusCode: 400 }
  );
  expect(mocks.grant).not.toHaveBeenCalled();
  mocks.grant.mockResolvedValue(false);
  await expect(grantTrainingMakeup('org-1', 'admin-1', 'plan-1', makeup)).resolves.toEqual({ count: 0, skipped: 1 });
});
