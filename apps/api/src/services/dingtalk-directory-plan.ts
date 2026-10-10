import { createHash } from 'node:crypto';
import type { TDingtalkDirectory } from '@cio/utils/validation/auth/dingtalk';
import type { readDingtalkDirectoryState } from '@cio/db/queries/enterprise/dingtalk-directory';
import { isImportableEmail } from '@cio/utils/validation/organization';
import { isActiveDingtalkMember } from '@cio/db/auth/dingtalk';

export type DirectoryState = Awaited<ReturnType<typeof readDingtalkDirectoryState>>;

export function directoryRevision(state: DirectoryState) {
  return createHash('sha256').update(JSON.stringify(state)).digest('hex');
}

export function directoryEmailAddresses(directory: TDingtalkDirectory) {
  return [
    ...new Set(directory.employees.flatMap((employee) => (employee.companyEmail ? [employee.companyEmail] : [])))
  ];
}

export function directoryAccountKey(corpId: string, userId: string) {
  return createHash('sha256').update(`${corpId}:${userId}`).digest('hex');
}

export function planDingtalkDirectory(directory: TDingtalkDirectory, state: DirectoryState, corpId: string) {
  const source = `dingtalk:${corpId}`;
  const knownDepartments = new Map(
    state.departments.filter((row) => row.externalSource === source).map((row) => [Number(row.externalId), row])
  );
  const knownMembers = new Map(
    state.members.filter((row) => row.member.externalSource === source).map((row) => [row.member.externalId, row])
  );
  const sourceDepartmentIds = new Set(directory.departments.map((row) => row.id));
  const numberCounts = new Map<string, number>();
  const emailCounts = new Map<string, number>();
  for (const employee of directory.employees) {
    if (employee.employeeNo) numberCounts.set(employee.employeeNo, (numberCounts.get(employee.employeeNo) ?? 0) + 1);
    if (employee.companyEmail)
      emailCounts.set(employee.companyEmail, (emailCounts.get(employee.companyEmail) ?? 0) + 1);
  }

  const employees = directory.employees.map((employee) => {
    const existing = knownMembers.get(employee.userId);
    const departmentIds = employee.departmentIds.filter((id) => sourceDepartmentIds.has(id));
    const previousDepartment = [...knownDepartments.entries()].find(
      ([, row]) => row.id === existing?.member.departmentId
    )?.[0];
    const departmentId =
      previousDepartment && departmentIds.includes(previousDepartment)
        ? previousDepartment
        : departmentIds.length === 1
          ? departmentIds[0]
          : null;
    let status:
      | 'ready'
      | 'department_required'
      | 'inactive'
      | 'employee_no_conflict'
      | 'email_conflict'
      | 'field_invalid'
      | 'department_missing' = 'ready';
    if (
      (employee.employeeNo?.length ?? 0) > 64 ||
      (employee.position?.length ?? 0) > 128 ||
      (employee.companyEmail && !isImportableEmail(employee.companyEmail))
    )
      status = 'field_invalid';
    else if (
      existing &&
      (!existing.user || !existing.profile || !isActiveDingtalkMember({ member: existing.member, user: existing.user }))
    )
      status = 'inactive';
    else if (
      !departmentIds.length ||
      departmentIds.length !== employee.departmentIds.length ||
      departmentIds.some((id) => knownDepartments.get(id)?.status === 'INACTIVE')
    )
      status = 'department_missing';
    else if (
      employee.employeeNo &&
      ((numberCounts.get(employee.employeeNo) ?? 0) > 1 ||
        state.members.some(
          (row) => row.member.id !== existing?.member.id && row.member.employeeNo === employee.employeeNo
        ))
    )
      status = 'employee_no_conflict';
    else if (
      employee.companyEmail &&
      ((emailCounts.get(employee.companyEmail) ?? 0) > 1 ||
        state.members.some(
          (row) => row.member.id !== existing?.member.id && row.member.email?.toLowerCase() === employee.companyEmail
        ) ||
        [...state.emailOwners, ...state.profileEmailOwners].some(
          (row) => row.id !== existing?.member.profileId && row.email?.toLowerCase() === employee.companyEmail
        ))
    )
      status = 'email_conflict';
    else if (!departmentId) status = 'department_required';

    return {
      ...employee,
      departmentId,
      action: existing ? ('update' as const) : ('create' as const),
      status,
      memberId: existing?.member.id ?? null
    };
  });
  const departments = directory.departments.map((row) => ({
    ...row,
    localId: knownDepartments.get(row.id)?.id ?? null,
    action: knownDepartments.has(row.id) ? ('update' as const) : ('create' as const)
  }));
  return { departments, employees };
}
