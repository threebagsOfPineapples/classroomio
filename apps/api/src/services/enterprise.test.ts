import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as queries from '@cio/db/queries/enterprise';
import { ROLE } from '@cio/utils/constants';
import {
  addEnterpriseDepartment,
  editEnterpriseEmployee,
  getEnterpriseEmployee,
  getEnterpriseEmployees,
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
  });

  it('queries only the responsible department tree and the member themselves', async () => {
    await getEnterpriseEmployees('org-a', 'profile-a');

    expect(queries.listEnterpriseEmployees).toHaveBeenCalledWith('org-a', ['root', 'child'], 7);
    await expect(getEnterpriseEmployee('org-a', 'profile-a', 9)).rejects.toMatchObject({ statusCode: 404 });
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
