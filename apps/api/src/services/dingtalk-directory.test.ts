import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as queries from '@cio/db/queries/enterprise/dingtalk-directory';
import * as provider from '@cio/db/auth/dingtalk';
import { getEnterpriseOverview } from './enterprise';
import { previewDingtalkDirectory, syncDingtalkDirectory } from './dingtalk-directory';
import { directoryRevision, planDingtalkDirectory, type DirectoryState } from './dingtalk-directory-plan';
import {
  ZDingtalkDirectory,
  ZDingtalkDirectorySync,
  type TDingtalkDirectory,
  type TDingtalkDirectorySnapshot
} from '@cio/utils/validation/auth/dingtalk';

vi.mock('@cio/db/queries/enterprise/dingtalk-directory', () => ({
  readDingtalkDirectoryState: vi.fn(),
  saveDingtalkDirectoryPreview: vi.fn(),
  withDingtalkDirectoryPreview: vi.fn(),
  finishDingtalkDirectoryPreview: vi.fn(),
  applyDingtalkDirectoryDepartments: vi.fn(),
  createDingtalkDirectoryEmployees: vi.fn(),
  updateDingtalkDirectoryEmployee: vi.fn(),
  replaceDingtalkDirectoryEmployeeDepartments: vi.fn()
}));
vi.mock('@cio/db/auth/dingtalk', async (original) => {
  const actual = await original<typeof import('@cio/db/auth/dingtalk')>();
  return { ...actual, getDingtalkConfig: vi.fn(), getDingtalkDirectory: vi.fn() };
});
vi.mock('./enterprise', () => ({ getEnterpriseOverview: vi.fn() }));
vi.mock('./organization/student-limit', () => ({ assertStudentCapacityOrThrow: vi.fn() }));

const organizationId = '2b8f4a1c-6d3e-4b2a-9f7e-1c4d8a6e9b0f';
const profileId = '3c9052de-7e4f-4c3a-8d8e-2d5e9b7f1a3c';
const token = 'a'.repeat(64);
const corpId = 'company-a';
let state: DirectoryState;
let directory: TDingtalkDirectory;
let snapshot: TDingtalkDirectorySnapshot;

beforeEach(() => {
  vi.resetAllMocks();
  state = {
    departments: [],
    members: [
      {
        member: {
          id: 1,
          organizationId,
          profileId,
          roleId: 1,
          status: 'ACTIVE',
          employmentStatus: 'ACTIVE',
          externalSource: null,
          externalId: null,
          employeeNo: null,
          email: 'admin@zz-train.local'
        },
        user: { id: profileId, banned: false, isAnonymous: false },
        profile: { id: profileId }
      } as never
    ],
    roles: [],
    memberDepartments: [],
    emailOwners: [],
    profileEmailOwners: []
  };
  directory = {
    departments: [
      { id: 1, parentId: 0, name: '公司', sort: 0 },
      { id: 967223303, parentId: 1, name: '主公司', sort: 0 },
      { id: 2, parentId: 967223303, name: '运营部', sort: 0 }
    ],
    employees: [
      { userId: 'staff-a', name: '员工甲', employeeNo: 'A1', position: '运营', companyEmail: null, departmentIds: [2] }
    ]
  };
  const revision = directoryRevision(state);
  snapshot = { organizationId, profileId, corpId, revision, directory, result: null, selectionHash: null };
  vi.mocked(queries.readDingtalkDirectoryState).mockImplementation(async () => state);
  vi.mocked(queries.createDingtalkDirectoryEmployees).mockImplementation(async (_client, _users, _profiles, members) =>
    members.map((member, index) => ({ id: index + 100, externalId: member.externalId ?? null }))
  );
  vi.mocked(provider.getDingtalkConfig).mockReturnValue({
    corpId,
    organizationId,
    clientId: 'client',
    clientSecret: 'secret',
    redirectUri: 'http://localhost:4173/api/auth/dingtalk/callback'
  });
  vi.mocked(provider.getDingtalkDirectory).mockImplementation(async () => directory);
  vi.mocked(getEnterpriseOverview).mockResolvedValue({ isSuperAdmin: true } as never);
  vi.mocked(queries.withDingtalkDirectoryPreview).mockImplementation(
    async (_organizationId, _profileId, _token, action) => {
      const value = JSON.stringify(snapshot);
      return action({} as never, { id: 'preview-id', value });
    }
  );
});

describe('directory sync permissions and atomic input validation', () => {
  it('imports a new multi-department employee without guessing a primary or duplicating the employee', async () => {
    directory.employees[0].departmentIds = [967223303, 2];
    const preview = await previewDingtalkDirectory(organizationId, profileId);

    expect(preview.employees).toHaveLength(1);
    expect(preview.employees[0]).toMatchObject({ status: 'ready', departmentId: null });
    const result = await syncDingtalkDirectory(organizationId, profileId, {
      token,
      selections: [{ userId: 'staff-a', departmentId: null }]
    });
    const member = vi.mocked(queries.createDingtalkDirectoryEmployees).mock.calls[0][3][0];
    const associations = vi.mocked(queries.replaceDingtalkDirectoryEmployeeDepartments).mock.calls[0];

    expect(member.departmentId).toBeNull();
    expect(result.employeesCreated).toBe(1);
    expect(vi.mocked(queries.createDingtalkDirectoryEmployees).mock.calls[0][3]).toHaveLength(1);
    expect(associations[3]).toHaveLength(2);
    expect(queries.replaceDingtalkDirectoryEmployeeDepartments).toHaveBeenCalledOnce();
  });

  it('preserves an existing allowed primary when the confirmation has no primary preference', async () => {
    state.members[0].member.externalSource = 'dingtalk:company-a';
    state.members[0].member.externalId = 'staff-a';
    state.members[0].member.departmentId = 'local-operations';
    state.departments.push({
      id: 'local-operations',
      externalSource: 'dingtalk:company-a',
      externalId: '2',
      status: 'ACTIVE'
    } as never);
    directory.employees[0].departmentIds = [967223303, 2];
    snapshot.revision = directoryRevision(state);
    await syncDingtalkDirectory(organizationId, profileId, {
      token,
      selections: [{ userId: 'staff-a', departmentId: null }]
    });

    expect(vi.mocked(queries.updateDingtalkDirectoryEmployee).mock.calls[0][5].departmentId).toBe('local-operations');
    expect(vi.mocked(queries.replaceDingtalkDirectoryEmployeeDepartments).mock.calls[0][3]).toContain(
      'local-operations'
    );
    expect(vi.mocked(queries.replaceDingtalkDirectoryEmployeeDepartments).mock.calls[0][3]).toHaveLength(2);
  });

  it('discards an out-of-scope affiliation while importing the same employee without a primary preference', async () => {
    directory.departments.push({ id: 1076307045, parentId: 967223303, name: 'Excluded branch', sort: 0 });
    directory.employees[0].departmentIds = [2, 1076307045];
    const result = await syncDingtalkDirectory(organizationId, profileId, {
      token,
      selections: [{ userId: 'staff-a', departmentId: null }]
    });
    const rows = vi.mocked(queries.applyDingtalkDirectoryDepartments).mock.calls[0][1];
    const associations = vi.mocked(queries.replaceDingtalkDirectoryEmployeeDepartments).mock.calls[0][3];
    const localOperations = rows.find((row) => row.externalId === '2')!.id;

    expect(rows.some((row) => row.externalId === '1076307045')).toBe(false);
    expect(associations).toEqual([localOperations]);
    expect(result.employeesCreated).toBe(1);
  });

  it('accepts an optional primary and rejects duplicate selections for one multi-department employee', () => {
    expect(
      ZDingtalkDirectorySync.safeParse({ token, selections: [{ userId: 'staff-a', departmentId: null }] }).success
    ).toBe(true);
    expect(
      ZDingtalkDirectorySync.safeParse({
        token,
        selections: [
          { userId: 'staff-a', departmentId: null },
          { userId: 'staff-a', departmentId: 2 }
        ]
      }).success
    ).toBe(false);
  });

  it('stores only the confirmed headquarters scope and reports excluded staff', async () => {
    directory.departments.push(
      { id: 1076307045, parentId: 967223303, name: 'Excluded branch', sort: 0 },
      { id: 3, parentId: 1076307045, name: 'Excluded team', sort: 0 }
    );
    directory.employees.push({
      ...directory.employees[0],
      userId: 'excluded-staff',
      employeeNo: 'B1',
      departmentIds: [3]
    });
    directory.employees.push({
      ...directory.employees[0],
      userId: 'group-staff',
      employeeNo: 'C1',
      departmentIds: [1]
    });
    directory.employees[0].departmentIds = [2, 3];
    const preview = await previewDingtalkDirectory(organizationId, profileId);
    const stored = vi.mocked(queries.saveDingtalkDirectoryPreview).mock.calls[0][1];

    expect(preview.scope).toMatchObject({ excludedEmployeeCount: 2, multiDepartmentEmployeeCount: 1 });
    expect(preview.employees).toHaveLength(1);
    expect(preview.employees[0]).toMatchObject({
      status: 'ready',
      departmentId: 2,
      departmentIds: [2]
    });
    expect(stored.directory.employees.map((employee) => employee.userId)).toEqual(['staff-a']);
    expect(stored.directory.departments.some((department) => department.id === 3)).toBe(false);
  });

  it('reapplies headquarters filtering to old snapshots and rejects excluded selections before writes', async () => {
    directory.departments.push({ id: 1076307045, parentId: 967223303, name: 'Excluded branch', sort: 0 });
    directory.employees.push({
      ...directory.employees[0],
      userId: 'excluded-staff',
      employeeNo: 'B1',
      departmentIds: [1076307045]
    });

    await expect(
      syncDingtalkDirectory(organizationId, profileId, {
        token,
        selections: [{ userId: 'excluded-staff', departmentId: 1076307045 }]
      })
    ).rejects.toMatchObject({ code: 'DINGTALK_DIRECTORY_CHANGED' });
    expect(queries.applyDingtalkDirectoryDepartments).not.toHaveBeenCalled();
    expect(queries.replaceDingtalkDirectoryEmployeeDepartments).not.toHaveBeenCalled();
  });

  it('persists every allowed department within the same transaction for an explicitly selected primary', async () => {
    directory.employees[0].departmentIds = [967223303, 2];
    await syncDingtalkDirectory(organizationId, profileId, {
      token,
      selections: [{ userId: 'staff-a', departmentId: 2 }]
    });
    const [transaction, rows] = vi.mocked(queries.applyDingtalkDirectoryDepartments).mock.calls[0];
    const localDepartmentIds = rows
      .filter((row) => ['967223303', '2'].includes(row.externalId ?? ''))
      .map((row) => row.id);
    const [associationTransaction, associationOrg, memberId, associations] = vi.mocked(
      queries.replaceDingtalkDirectoryEmployeeDepartments
    ).mock.calls[0];

    expect(associationTransaction).toBe(transaction);
    expect(associationOrg).toBe(organizationId);
    expect(memberId).toBe(100);
    expect(associations.sort()).toEqual(localDepartmentIds.sort());
    const member = vi.mocked(queries.createDingtalkDirectoryEmployees).mock.calls[0][3][0];
    expect(member.departmentId).toBe(rows.find((row) => row.externalId === '2')?.id);
    expect(member.roleId).toBe(3);
  });

  it('does not complete a preview when relationship replacement fails', async () => {
    vi.mocked(queries.replaceDingtalkDirectoryEmployeeDepartments).mockRejectedValue(new Error('relationship failed'));

    await expect(
      syncDingtalkDirectory(organizationId, profileId, { token, selections: [{ userId: 'staff-a', departmentId: 2 }] })
    ).rejects.toThrow('relationship failed');
    expect(queries.finishDingtalkDirectoryPreview).not.toHaveBeenCalled();
  });

  it('updates only selected existing staff and leaves unselected terminated employee history alone', async () => {
    state.members[0].member.externalSource = 'dingtalk:company-a';
    state.members[0].member.externalId = 'staff-a';
    state.members[0].member.departmentId = 'old-excluded-department';
    state.departments.push({
      id: 'old-excluded-department',
      externalSource: 'dingtalk:company-a',
      externalId: '1076307045',
      status: 'ACTIVE'
    } as never);
    const inactiveMember = {
      ...state.members[0].member,
      id: 2,
      profileId: '4b9052de-7e4f-4c3a-8d8e-2d5e9b7f1a3c',
      externalId: 'staff-unselected',
      employmentStatus: 'TERMINATED' as const
    };
    state.members.push({ ...state.members[0], member: inactiveMember });
    directory.employees.push({ ...directory.employees[0], userId: 'staff-unselected', employeeNo: 'B1' });
    snapshot.revision = directoryRevision(state);
    directory.employees[0].departmentIds = [967223303, 2];
    const result = await syncDingtalkDirectory(organizationId, profileId, {
      token,
      selections: [{ userId: 'staff-a', departmentId: 2 }]
    });

    expect(result).toMatchObject({ employeesCreated: 0, employeesUpdated: 1 });
    expect(queries.updateDingtalkDirectoryEmployee).toHaveBeenCalledOnce();
    const update = vi.mocked(queries.updateDingtalkDirectoryEmployee).mock.calls[0];
    expect(update[2]).toBe(1);
    expect(update[5]).not.toHaveProperty('roleId');
    expect(queries.replaceDingtalkDirectoryEmployeeDepartments).toHaveBeenCalledOnce();
    const associations = vi.mocked(queries.replaceDingtalkDirectoryEmployeeDepartments).mock.calls[0];
    expect(associations[2]).toBe(1);
    expect(associations[3]).toHaveLength(2);
    expect(associations[3]).not.toContain('old-excluded-department');
    expect(state.members[1].member.employmentStatus).toBe('TERMINATED');
  });

  it('fails closed when the confirmed headquarters department is absent', async () => {
    directory.departments = [{ id: 1, parentId: 0, name: 'Root', sort: 0 }];
    directory.employees = [];

    await expect(previewDingtalkDirectory(organizationId, profileId)).rejects.toMatchObject({
      code: 'DINGTALK_DIRECTORY_INVALID_DIRECTORY'
    });
    expect(queries.saveDingtalkDirectoryPreview).not.toHaveBeenCalled();
  });

  it('rejects HR and ordinary employees before calling DingTalk or storing a preview', async () => {
    vi.mocked(getEnterpriseOverview).mockResolvedValue({ isSuperAdmin: false } as never);
    await expect(previewDingtalkDirectory(organizationId, profileId)).rejects.toMatchObject({ statusCode: 403 });
    expect(provider.getDingtalkDirectory).not.toHaveBeenCalled();
    expect(queries.saveDingtalkDirectoryPreview).not.toHaveBeenCalled();
  });

  it('preview does not write departments, employees or learning records', async () => {
    const preview = await previewDingtalkDirectory(organizationId, profileId);
    expect(preview.employees[0]).toMatchObject({ status: 'ready', action: 'create', departmentId: 2 });
    expect(queries.saveDingtalkDirectoryPreview).toHaveBeenCalledOnce();
    expect(queries.createDingtalkDirectoryEmployees).not.toHaveBeenCalled();
    expect(queries.applyDingtalkDirectoryDepartments).not.toHaveBeenCalled();
  });

  it.each(['unknown_employee', 'wrong_department', 'changed_data', 'wrong_company', 'wrong_actor'])(
    'rejects stale or tampered input before writes: %s',
    async (condition) => {
      if (condition === 'changed_data') state.members[0].member.employeeNo = 'CHANGED';
      if (condition === 'wrong_company') snapshot.corpId = 'company-b';
      if (condition === 'wrong_actor') snapshot.profileId = crypto.randomUUID();
      const userId = condition === 'unknown_employee' ? 'staff-b' : 'staff-a';
      const departmentId = condition === 'wrong_department' ? 1 : 2;
      await expect(
        syncDingtalkDirectory(organizationId, profileId, { token, selections: [{ userId, departmentId }] })
      ).rejects.toMatchObject({ code: 'DINGTALK_DIRECTORY_CHANGED' });
      expect(queries.createDingtalkDirectoryEmployees).not.toHaveBeenCalled();
      expect(queries.applyDingtalkDirectoryDepartments).not.toHaveBeenCalled();
    }
  );

  it('rejects an expired preview', async () => {
    vi.mocked(queries.withDingtalkDirectoryPreview).mockImplementation(async (_org, _profile, _token, action) =>
      action({} as never, undefined)
    );
    await expect(syncDingtalkDirectory(organizationId, profileId, { token, selections: [] })).rejects.toMatchObject({
      code: 'DINGTALK_DIRECTORY_EXPIRED'
    });
  });

  it('creates learners without granting admin roles, sending emails or asserting email verification', async () => {
    const result = await syncDingtalkDirectory(organizationId, profileId, {
      token,
      selections: [{ userId: 'staff-a', departmentId: 2 }]
    });
    expect(result).toEqual({ departmentsCreated: 3, departmentsUpdated: 0, employeesCreated: 1, employeesUpdated: 0 });
    const [, users, profiles, members] = vi.mocked(queries.createDingtalkDirectoryEmployees).mock.calls[0];
    expect(users[0]).toMatchObject({ name: '员工甲', emailVerified: false });
    expect(users[0].email).toMatch(/@zz-train\.invalid$/);
    expect(profiles[0]).toMatchObject({ fullname: '员工甲', email: null, locale: 'zh', canAddCourse: false });
    expect(members[0]).toMatchObject({
      roleId: 3,
      externalSource: 'dingtalk:company-a',
      externalId: 'staff-a',
      employmentStatus: 'ACTIVE'
    });
    expect(queries.finishDingtalkDirectoryPreview).toHaveBeenCalledOnce();
  });

  it('repeats the same confirmation without writing duplicates and rejects a different confirmation', async () => {
    const values = { token, selections: [{ userId: 'staff-a', departmentId: 2 }] };
    const result = await syncDingtalkDirectory(organizationId, profileId, values);
    snapshot = vi.mocked(queries.finishDingtalkDirectoryPreview).mock.calls[0][2];
    expect(await syncDingtalkDirectory(organizationId, profileId, values)).toEqual(result);
    expect(queries.createDingtalkDirectoryEmployees).toHaveBeenCalledOnce();
    await expect(syncDingtalkDirectory(organizationId, profileId, { token, selections: [] })).rejects.toMatchObject({
      code: 'DINGTALK_DIRECTORY_CHANGED'
    });
  });

  it('does not mark a failed transaction as applied', async () => {
    vi.mocked(queries.createDingtalkDirectoryEmployees).mockRejectedValue(new Error('database rejected write'));
    await expect(
      syncDingtalkDirectory(organizationId, profileId, { token, selections: [{ userId: 'staff-a', departmentId: 2 }] })
    ).rejects.toThrow('database rejected write');
    expect(queries.finishDingtalkDirectoryPreview).not.toHaveBeenCalled();
  });
});

describe('directory account and department matching', () => {
  it('rejects duplicate identities and disconnected department trees at the boundary', () => {
    directory.employees.push({ ...directory.employees[0] });
    expect(ZDingtalkDirectory.safeParse(directory).success).toBe(false);
    directory.employees.pop();
    directory.departments[1].parentId = 9;
    expect(ZDingtalkDirectory.safeParse(directory).success).toBe(false);
  });
  it('never chooses the first department for a new multi-department employee', () => {
    directory.employees[0].departmentIds = [1, 2];
    expect(planDingtalkDirectory(directory, state, corpId).employees[0]).toMatchObject({
      status: 'ready',
      departmentId: null
    });
  });

  it('preserves an existing primary department and matches by company and user ID', () => {
    directory.employees[0].departmentIds = [1, 2];
    state.departments.push({
      id: 'local-dept',
      externalSource: 'dingtalk:company-a',
      externalId: '2',
      status: 'ACTIVE'
    } as never);
    const member = {
      ...state.members[0].member,
      externalSource: 'dingtalk:company-a',
      externalId: 'staff-a',
      departmentId: 'local-dept'
    };
    state.members[0] = { ...state.members[0], member };
    expect(planDingtalkDirectory(directory, state, corpId).employees[0]).toMatchObject({
      action: 'update',
      departmentId: 2,
      memberId: 1
    });
    state.members[0].member.externalSource = 'dingtalk:company-b';
    expect(planDingtalkDirectory(directory, state, corpId).employees[0]).toMatchObject({
      action: 'create',
      status: 'ready'
    });
  });

  it('requires existing email accounts to link and rejects duplicate employee numbers', () => {
    directory.employees[0].companyEmail = 'existing@example.test';
    state.emailOwners.push({ id: 'another-profile', email: 'existing@example.test' });
    expect(planDingtalkDirectory(directory, state, corpId).employees[0].status).toBe('email_conflict');
    directory.employees[0].companyEmail = null;
    state.members[0].member.employeeNo = 'A1';
    expect(planDingtalkDirectory(directory, state, corpId).employees[0].status).toBe('employee_no_conflict');
  });

  it('never reactivates terminated accounts or truncates oversized fields', () => {
    state.members[0].member.externalSource = 'dingtalk:company-a';
    state.members[0].member.externalId = 'staff-a';
    state.members[0].member.employmentStatus = 'TERMINATED';
    expect(planDingtalkDirectory(directory, state, corpId).employees[0].status).toBe('inactive');
    state.members[0].member.employmentStatus = 'ACTIVE';
    directory.employees[0].position = '职'.repeat(129);
    expect(planDingtalkDirectory(directory, state, corpId).employees[0].status).toBe('field_invalid');
  });
});
