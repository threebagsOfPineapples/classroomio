import type { EnterpriseDepartment, EnterpriseEmployee, TrainingScopesDraft } from './types';

export function departmentPath(department: EnterpriseDepartment, departments: EnterpriseDepartment[]) {
  const names = [department.name];
  const visitedIds = new Set([department.id]);
  let parentId = department.parentId;
  while (parentId && !visitedIds.has(parentId)) {
    visitedIds.add(parentId);
    const parent = departments.find((item) => item.id === parentId);
    if (!parent) break;

    names.unshift(parent.name);
    parentId = parent.parentId;
  }

  return `${names.join(' / ')} · ${department.code}`;
}

export function scopeEmployeeLabel(employee: EnterpriseEmployee, departments: EnterpriseDepartment[]) {
  const department = departments.find((item) => item.id === employee.member.departmentId);
  const departmentLabel = department ? departmentPath(department, departments) : '';
  return [employee.fullname, employee.member.employeeNo, employee.email ?? employee.member.email, departmentLabel]
    .filter(Boolean)
    .join(' · ');
}

export function trainingScopesFingerprint(scopes: TrainingScopesDraft) {
  const departmentIds = [...new Set(scopes.departmentIds)].sort();
  const memberIds = [...new Set(scopes.memberIds)].sort((left, right) => left - right);
  return JSON.stringify({ departmentIds, memberIds });
}
