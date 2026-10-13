import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getEnterpriseOverview } from './enterprise';
import { getTrainingHeadquartersMemberIds, listEnterpriseScopedMemberIds } from '@cio/db/queries/enterprise/access';
import {
  loadActiveTrainingActor,
  requireTrainingAdministrator,
  requireTrainingReportReader,
  resolveTrainingReadScope
} from './training-access';

vi.mock('./enterprise', () => ({ getEnterpriseOverview: vi.fn() }));
vi.mock('@cio/db/queries/enterprise/access', () => ({
  listEnterpriseScopedMemberIds: vi.fn(),
  getTrainingHeadquartersMemberIds: vi.fn()
}));
vi.mock('@cio/db/queries/enterprise', () => ({ getEnterpriseMember: vi.fn() }));

describe('training access', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getTrainingHeadquartersMemberIds).mockResolvedValue(null);
    vi.mocked(getEnterpriseOverview).mockResolvedValue({
      memberId: 7,
      roles: ['DEPARTMENT_MANAGER'],
      canManage: false,
      canManageTraining: false,
      isSuperAdmin: false,
      scopedDepartmentIds: ['team-a'],
      scopedMemberIds: [11],
      departments: []
    });
    vi.mocked(listEnterpriseScopedMemberIds).mockResolvedValue([{ id: 11 }, { id: 12 }]);
  });

  it('resolves only explicit manager grants plus their own member record', async () => {
    const actor = await loadActiveTrainingActor('org', 'profile');
    await expect(resolveTrainingReadScope(actor)).resolves.toEqual({ type: 'MEMBERS', memberIds: [7, 11, 12] });
    expect(listEnterpriseScopedMemberIds).toHaveBeenCalledWith('org', ['team-a'], [11]);
    expect(() => requireTrainingAdministrator(actor)).toThrow();
  });

  it('keeps an executive out of raw reports and management actions', async () => {
    const actor = await loadActiveTrainingActor('org', 'profile');
    actor.roles = ['EXECUTIVE'];
    actor.canReadReports = false;
    actor.canReadSummary = true;

    expect(() => requireTrainingReportReader(actor)).toThrow();
    expect(() => requireTrainingAdministrator(actor)).toThrow();
    await expect(resolveTrainingReadScope(actor)).resolves.toEqual({ type: 'MEMBERS', memberIds: [7] });
  });

  it('propagates a suspended actor rejection before resolving any scope', async () => {
    vi.mocked(getEnterpriseOverview).mockRejectedValue(new Error('inactive actor'));
    await expect(loadActiveTrainingActor('org', 'profile')).rejects.toThrow('inactive actor');
    expect(listEnterpriseScopedMemberIds).not.toHaveBeenCalled();
  });

  it('intersects explicit people grants with headquarters membership', async () => {
    vi.mocked(getTrainingHeadquartersMemberIds).mockResolvedValue([7, 12]);
    const actor = await loadActiveTrainingActor('org', 'profile');
    await expect(resolveTrainingReadScope(actor)).resolves.toEqual({ type: 'MEMBERS', memberIds: [7, 12] });
  });

  it('keeps administrators reports within headquarters while permitting administration', async () => {
    const actor = await loadActiveTrainingActor('org', 'profile');
    actor.canManageTraining = true;
    vi.mocked(getTrainingHeadquartersMemberIds).mockResolvedValue([12]);
    await expect(resolveTrainingReadScope(actor)).resolves.toEqual({ type: 'MEMBERS', memberIds: [12] });
  });

  it('denies a non-headquarters learner even with an active organization account', async () => {
    vi.mocked(getTrainingHeadquartersMemberIds).mockResolvedValue([12]);
    await expect(loadActiveTrainingActor('org', 'profile')).rejects.toThrow('outside the training scope');
  });
});
