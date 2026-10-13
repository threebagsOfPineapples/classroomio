import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as queries from '@cio/db/queries/enterprise';
import * as accessQueries from '@cio/db/queries/enterprise/access';
import { ROLE } from '@cio/utils/constants';
import {
  addEnterpriseDepartment,
  editEnterpriseEmployee,
  getEnterpriseEmployee,
  getEnterpriseEmployees,
  getEnterpriseOverview,
  setEnterpriseTrainingScopes,
  setEnterpriseRoles
} from './enterprise';

vi.mock('@cio/db/queries/enterprise', () => ({
  createEnterpriseDepartment: vi.fn(),
  getEnterpriseMember: vi.fn(),
  getEnterpriseMemberByProfile: vi.fn(),
  listEnterpriseDepartments: vi.fn(),
  listEnterpriseEmployees: vi.fn(),
  listEnterpriseRoles: vi.fn(),
  replaceEnterpriseRoles: vi.fn(),
  updateEnterpriseDepartment: vi.fn(),
  updateEnterpriseEmployee: vi.fn()
}));

vi.mock('@cio/db/queries/enterprise/access', () => ({
  getEnterpriseMemberScopes: vi.fn(),
  lockEnterpriseMember: vi.fn(),
  replaceEnterpriseMemberScopes: vi.fn(),
  addTrainingOperationAudit: vi.fn(),
  withEnterpriseAccessTransaction: vi.fn()
}));

vi.mock('@cio/db/queries/group', () => ({ isCourseTeamMemberOrOrgAdmin: vi.fn() }));

describe('enterprise access', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(queries.getEnterpriseMemberByProfile).mockResolvedValue([
      { id: 7, roleId: 3, status: 'ACTIVE' } as never
    ]);
    vi.mocked(queries.listEnterpriseRoles).mockResolvedValue([{ role: 'DEPARTMENT_MANAGER' }]);
    vi.mocked(queries.listEnterpriseDepartments).mockResolvedValue([
      { id: 'root', parentId: null, leaderMemberId: 7, status: 'ACTIVE' },
      { id: 'child', parentId: 'root', leaderMemberId: null, status: 'ACTIVE' },
      { id: 'other', parentId: null, leaderMemberId: 8, status: 'ACTIVE' }
    ] as never);
    vi.mocked(queries.listEnterpriseEmployees).mockResolvedValue([]);
    vi.mocked(accessQueries.getEnterpriseMemberScopes).mockResolvedValue({ departmentIds: ['child'], memberIds: [9] });
    vi.mocked(accessQueries.withEnterpriseAccessTransaction).mockImplementation(async (callback) =>
      callback({} as never)
    );
  });

  it('uses explicit departments and people without expanding the leader department tree', async () => {
    await getEnterpriseEmployees('org-a', 'profile-a');

    expect(queries.listEnterpriseEmployees).toHaveBeenCalledWith('org-a', ['child'], 7, [9]);
    await expect(getEnterpriseEmployee('org-a', 'profile-a', 9)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('keeps managers with no explicit grants limited to their own record', async () => {
    vi.mocked(accessQueries.getEnterpriseMemberScopes).mockResolvedValue({ departmentIds: [], memberIds: [] });
    await getEnterpriseEmployees('org-a', 'profile-a');

    expect(queries.listEnterpriseEmployees).toHaveBeenCalledWith('org-a', [], 7, []);
  });

  it('does not grant new training administrator actions through the legacy HR flag', async () => {
    vi.mocked(queries.listEnterpriseRoles).mockResolvedValue([{ role: 'HR' }]);
    const overview = await getEnterpriseOverview('org-a', 'profile-a');

    expect(overview.canManage).toBe(true);
    expect(overview.canManageTraining).toBe(false);
  });

  it('prevents managers from expanding their own scope', async () => {
    await expect(
      setEnterpriseTrainingScopes('org-a', 'profile-a', 7, { departmentIds: ['other'], memberIds: [] })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(accessQueries.replaceEnterpriseMemberScopes).not.toHaveBeenCalled();
  });

  it('rejects granting a member of another organization', async () => {
    vi.mocked(queries.getEnterpriseMemberByProfile).mockResolvedValue([
      { id: 7, roleId: ROLE.ADMIN, status: 'ACTIVE' }
    ] as never);
    vi.mocked(queries.getEnterpriseMember).mockResolvedValue([]);

    await expect(
      setEnterpriseTrainingScopes('org-a', 'profile-a', 7, { departmentIds: [], memberIds: [88] })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(accessQueries.replaceEnterpriseMemberScopes).not.toHaveBeenCalled();
  });

  it('allows an administrator to revoke all scopes and records each change', async () => {
    vi.mocked(queries.getEnterpriseMemberByProfile).mockResolvedValue([
      { id: 1, roleId: ROLE.ADMIN, status: 'ACTIVE' }
    ] as never);
    vi.mocked(accessQueries.lockEnterpriseMember).mockResolvedValue({ id: 7, status: 'ACTIVE' } as never);

    await expect(
      setEnterpriseTrainingScopes('org-a', 'profile-admin', 7, { departmentIds: [], memberIds: [] })
    ).resolves.toEqual({ departmentIds: [], memberIds: [] });
    expect(accessQueries.replaceEnterpriseMemberScopes).toHaveBeenCalledWith('org-a', 7, [], [], 'profile-admin', {});
    expect(accessQueries.addTrainingOperationAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorProfileId: 'profile-admin',
        targetMemberId: 7,
        resourceType: 'department',
        resourceId: 'child',
        action: 'SCOPE_REVOKED'
      }),
      {}
    );
    expect(accessQueries.addTrainingOperationAudit).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: 'employee', resourceId: '9', action: 'SCOPE_REVOKED' }),
      {}
    );
  });

  it('lets a member read themselves and blocks a terminated member', async () => {
    vi.mocked(queries.listEnterpriseEmployees).mockResolvedValue([
      { member: { id: 7 }, fullname: 'Alex', email: 'alex@example.test' }
    ] as never);

    const employee = await getEnterpriseEmployee('org-a', 'profile-a', 7);
    expect(employee.member.id).toBe(7);

    vi.mocked(queries.getEnterpriseMemberByProfile).mockResolvedValue([
      { id: 7, roleId: 3, status: 'ACTIVE', employmentStatus: 'TERMINATED' }
    ] as never);
    await expect(getEnterpriseEmployees('org-a', 'profile-a')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects writes from a department manager', async () => {
    await expect(editEnterpriseEmployee('org-a', 'profile-a', 9, { position: 'HR' })).rejects.toMatchObject({
      statusCode: 403
    });
    await expect(setEnterpriseRoles('org-a', 'profile-a', 9, { roles: ['HR'] })).rejects.toMatchObject({
      statusCode: 403
    });
    expect(queries.updateEnterpriseEmployee).not.toHaveBeenCalled();
  });

  it('rejects a department leader outside the organization', async () => {
    vi.mocked(queries.listEnterpriseRoles).mockResolvedValue([{ role: 'HR' }]);
    vi.mocked(queries.getEnterpriseMember).mockResolvedValue([]);

    await expect(
      addEnterpriseDepartment('org-a', 'profile-a', { name: 'Ops', code: 'OPS', leaderMemberId: 9 })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(queries.getEnterpriseMember).toHaveBeenCalledWith('org-a', 9);
    expect(queries.createEnterpriseDepartment).not.toHaveBeenCalled();
  });

  it('prevents HR from terminating an organization admin', async () => {
    vi.mocked(queries.listEnterpriseRoles).mockResolvedValue([{ role: 'HR' }]);
    vi.mocked(queries.getEnterpriseMember).mockResolvedValue([
      { id: 9, roleId: ROLE.ADMIN, status: 'ACTIVE' }
    ] as never);

    await expect(
      editEnterpriseEmployee('org-a', 'profile-a', 9, { employmentStatus: 'TERMINATED' })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(queries.updateEnterpriseEmployee).not.toHaveBeenCalled();
  });

  it('prevents HR from changing identities used for external login', async () => {
    vi.mocked(queries.listEnterpriseRoles).mockResolvedValue([{ role: 'HR' }]);
    vi.mocked(queries.getEnterpriseMember).mockResolvedValue([
      { id: 9, roleId: ROLE.STUDENT, status: 'ACTIVE', externalSource: null, externalId: null }
    ] as never);
    await expect(
      editEnterpriseEmployee('org-a', 'profile-a', 9, { externalSource: 'dingtalk:company-a', externalId: 'staff-a' })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(queries.updateEnterpriseEmployee).not.toHaveBeenCalled();
  });
});
