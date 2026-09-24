import {
  createEnterpriseDepartment,
  getEnterpriseMember,
  getEnterpriseMemberByProfile,
  listEnterpriseDepartments,
  listEnterpriseEmployees,
  listEnterpriseRoles,
  replaceEnterpriseRoles,
  updateEnterpriseDepartment,
  updateEnterpriseEmployee
} from '@cio/db/queries/enterprise';
import type {
  TEnterpriseDepartment,
  TEnterpriseDepartmentUpdate,
  TEnterpriseEmployeeUpdate,
  TEnterpriseRoles
} from '@cio/utils/validation/enterprise';
import { AppError, ErrorCodes } from '@api/utils/errors';
import { ROLE } from '@cio/utils/constants';
import { visibleDepartmentIds, wouldCreateDepartmentCycle } from './enterprise-scope';

async function getContext(organizationId: string, profileId: string) {
  const [member] = await getEnterpriseMemberByProfile(organizationId, profileId);
  if (!member || member.employmentStatus === 'TERMINATED') {
    throw new AppError('Active organization membership required', ErrorCodes.ORG_TEAM_NOT_AUTHORIZED, 403);
  }

  const roleRows = await listEnterpriseRoles(organizationId, member.id);
  const roles = roleRows.map((row) => row.role);
  const isSuperAdmin = member.roleId === ROLE.ADMIN || roles.includes('SUPER_ADMIN');
  const canManage = isSuperAdmin || roles.includes('TRAINING_ADMIN') || roles.includes('HR');
  const departments = await listEnterpriseDepartments(organizationId);
  const scopedDepartmentIds = roles.includes('DEPARTMENT_MANAGER') ? visibleDepartmentIds(departments, member.id) : [];

  return { member, roles, isSuperAdmin, canManage, departments, scopedDepartmentIds };
}

function requireManager(canManage: boolean) {
  if (!canManage) throw new AppError('Enterprise manager access required', ErrorCodes.ORG_TEAM_NOT_AUTHORIZED, 403);
}

async function requireActiveMember(organizationId: string, memberId: number, allowTerminated = false) {
  const [member] = await getEnterpriseMember(organizationId, memberId);
  if (!member || member.status !== 'ACTIVE' || (!allowTerminated && member.employmentStatus === 'TERMINATED')) {
    throw new AppError('Active organization member not found', ErrorCodes.VALIDATION_ERROR, 400);
  }

  return member;
}

function requireActiveDepartment(departments: Awaited<ReturnType<typeof listEnterpriseDepartments>>, id: string) {
  const department = departments.find((item) => item.id === id && item.status === 'ACTIVE');
  if (!department) throw new AppError('Active department not found', ErrorCodes.VALIDATION_ERROR, 400);

  return department;
}

export async function getEnterpriseOverview(organizationId: string, profileId: string) {
  const context = await getContext(organizationId, profileId);
  const visibleIds = new Set(context.scopedDepartmentIds);
  if (context.member.departmentId) visibleIds.add(context.member.departmentId);
  const departments = context.canManage
    ? context.departments
    : context.departments.filter((item) => visibleIds.has(item.id));

  return {
    memberId: context.member.id,
    roles: context.roles,
    canManage: context.canManage,
    isSuperAdmin: context.isSuperAdmin,
    departments
  };
}

export async function getEnterpriseEmployees(organizationId: string, profileId: string) {
  const context = await getContext(organizationId, profileId);
  const scope = context.canManage ? undefined : context.scopedDepartmentIds;
  const selfMemberId = context.canManage ? undefined : context.member.id;

  return listEnterpriseEmployees(organizationId, scope, selfMemberId);
}

export async function getEnterpriseEmployee(organizationId: string, profileId: string, memberId: number) {
  const employees = await getEnterpriseEmployees(organizationId, profileId);
  const employee = employees.find((item) => item.member.id === memberId);
  if (!employee) throw new AppError('Employee not found', ErrorCodes.ORG_TEAM_NOT_AUTHORIZED, 404);

  const roleRows = await listEnterpriseRoles(organizationId, memberId);
  return { ...employee, roles: roleRows.map((row) => row.role) };
}

export async function addEnterpriseDepartment(
  organizationId: string,
  profileId: string,
  values: TEnterpriseDepartment
) {
  const context = await getContext(organizationId, profileId);
  requireManager(context.canManage);
  if (values.parentId) requireActiveDepartment(context.departments, values.parentId);
  if (values.leaderMemberId) await requireActiveMember(organizationId, values.leaderMemberId);

  const [created] = await createEnterpriseDepartment({ organizationId, ...values });
  return created;
}

export async function editEnterpriseDepartment(
  organizationId: string,
  profileId: string,
  departmentId: string,
  values: TEnterpriseDepartmentUpdate
) {
  const context = await getContext(organizationId, profileId);
  requireManager(context.canManage);
  const current = context.departments.find((item) => item.id === departmentId);
  if (!current) throw new AppError('Department not found', ErrorCodes.VALIDATION_ERROR, 404);

  const nextParentId = values.parentId === undefined ? current.parentId : values.parentId;
  if (nextParentId) requireActiveDepartment(context.departments, nextParentId);
  if (wouldCreateDepartmentCycle(context.departments, departmentId, nextParentId)) {
    throw new AppError('Department hierarchy cannot contain a cycle', ErrorCodes.VALIDATION_ERROR, 400);
  }

  if (values.leaderMemberId) await requireActiveMember(organizationId, values.leaderMemberId);

  if (values.status === 'INACTIVE') {
    const hasActiveChild = context.departments.some(
      (item) => item.parentId === departmentId && item.status === 'ACTIVE'
    );
    const employees = await listEnterpriseEmployees(organizationId, [departmentId]);
    const hasActiveEmployee = employees.some(
      (item) => item.member.departmentId === departmentId && item.member.employmentStatus !== 'TERMINATED'
    );
    if (hasActiveChild || hasActiveEmployee) {
      throw new AppError('Department has active children or employees', ErrorCodes.VALIDATION_ERROR, 400);
    }
  }

  const [updated] = await updateEnterpriseDepartment(organizationId, departmentId, values);
  return updated;
}

export async function editEnterpriseEmployee(
  organizationId: string,
  profileId: string,
  memberId: number,
  values: TEnterpriseEmployeeUpdate
) {
  const context = await getContext(organizationId, profileId);
  requireManager(context.canManage);
  const target = await requireActiveMember(organizationId, memberId, true);
  if (values.employmentStatus === 'TERMINATED' && !context.isSuperAdmin) {
    const targetRoles = await listEnterpriseRoles(organizationId, memberId);
    const targetIsSuperAdmin = target.roleId === ROLE.ADMIN || targetRoles.some((row) => row.role === 'SUPER_ADMIN');
    if (targetIsSuperAdmin) {
      throw new AppError('Organization admin access required', ErrorCodes.ORG_TEAM_NOT_AUTHORIZED, 403);
    }
  }

  if (values.departmentId) requireActiveDepartment(context.departments, values.departmentId);
  if (values.managerMemberId) {
    if (values.managerMemberId === memberId) {
      throw new AppError('Employee cannot manage themselves', ErrorCodes.VALIDATION_ERROR, 400);
    }

    await requireActiveMember(organizationId, values.managerMemberId);
    const visited = new Set([memberId]);
    let managerId: number | null = values.managerMemberId;
    while (managerId) {
      if (visited.has(managerId)) {
        throw new AppError('Manager chain cannot contain a cycle', ErrorCodes.VALIDATION_ERROR, 400);
      }

      visited.add(managerId);
      const [manager] = await getEnterpriseMember(organizationId, managerId);
      managerId = manager?.managerMemberId ?? null;
    }
  }

  const nextSource = values.externalSource === undefined ? target.externalSource : values.externalSource;
  const nextExternalId = values.externalId === undefined ? target.externalId : values.externalId;
  if (Boolean(nextSource) !== Boolean(nextExternalId)) {
    throw new AppError('External source and ID must be set together', ErrorCodes.VALIDATION_ERROR, 400);
  }

  const [updated] = await updateEnterpriseEmployee(organizationId, memberId, values);
  return updated;
}

export async function setEnterpriseRoles(
  organizationId: string,
  profileId: string,
  memberId: number,
  values: TEnterpriseRoles
) {
  const context = await getContext(organizationId, profileId);
  if (!context.isSuperAdmin) {
    throw new AppError('Organization admin access required', ErrorCodes.ORG_TEAM_NOT_AUTHORIZED, 403);
  }

  await requireActiveMember(organizationId, memberId);
  const roles = [...new Set(values.roles)];
  return replaceEnterpriseRoles(organizationId, memberId, roles, profileId);
}
