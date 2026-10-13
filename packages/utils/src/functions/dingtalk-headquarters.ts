import type { TDingtalkDirectory } from '../validation/auth/dingtalk';

export const DINGTALK_HEADQUARTERS_RULE = {
  headquartersDepartmentId: '967223303',
  excludedDepartmentIds: ['1076307045']
} as const;

type ScopeDepartment = { id: string; parentId: string | null; externalId: string | null };

export function resolveDingtalkHeadquartersScope(departments: readonly ScopeDepartment[]) {
  const children = new Map<string, string[]>();
  const byId = new Map(departments.map((department) => [department.id, department]));
  for (const department of departments) {
    if (!department.parentId) continue;

    const siblings = children.get(department.parentId) ?? [];
    siblings.push(department.id);
    children.set(department.parentId, siblings);
  }

  function descendants(rootIds: string[]) {
    const result = new Set<string>();
    const pending = [...rootIds];
    while (pending.length) {
      const departmentId = pending.pop()!;
      if (result.has(departmentId)) continue;

      result.add(departmentId);
      pending.push(...(children.get(departmentId) ?? []));
    }

    return result;
  }

  const headquarters = departments.filter(
    (department) => department.externalId === DINGTALK_HEADQUARTERS_RULE.headquartersDepartmentId
  );
  const excludedRoots = departments.filter((department) =>
    DINGTALK_HEADQUARTERS_RULE.excludedDepartmentIds.some((externalId) => department.externalId === externalId)
  );
  const excludedIds = descendants(excludedRoots.map((department) => department.id));
  const departmentIds = descendants(headquarters.map((department) => department.id));
  for (const excludedId of excludedIds) departmentIds.delete(excludedId);

  const ancestorIds = new Set<string>();
  for (const root of headquarters) {
    let parentId = root.parentId;
    while (parentId && byId.has(parentId) && !ancestorIds.has(parentId) && !departmentIds.has(parentId)) {
      ancestorIds.add(parentId);
      parentId = byId.get(parentId)!.parentId;
    }
  }

  return { departmentIds, ancestorIds };
}

export function filterDingtalkHeadquartersDirectory(source: TDingtalkDirectory) {
  const scopeDepartments = source.departments.map((department) => ({
    id: String(department.id),
    parentId: department.parentId === 0 ? null : String(department.parentId),
    externalId: String(department.id)
  }));
  const scope = resolveDingtalkHeadquartersScope(scopeDepartments);
  const departments = source.departments.filter(
    (department) => scope.departmentIds.has(String(department.id)) || scope.ancestorIds.has(String(department.id))
  );
  const employees = source.employees.flatMap((employee) => {
    const departmentIds = employee.departmentIds.filter((departmentId) =>
      scope.departmentIds.has(String(departmentId))
    );
    if (!departmentIds.length) return [];

    const hasMultipleDepartments = employee.hasMultipleDepartments === true || employee.departmentIds.length > 1;
    return [{ ...employee, departmentIds, hasMultipleDepartments }];
  });
  const directory = { departments, employees };
  const summary = {
    ...DINGTALK_HEADQUARTERS_RULE,
    eligibleDepartmentCount: scope.departmentIds.size,
    ancestorDepartmentCount: scope.ancestorIds.size,
    excludedDepartmentCount: source.departments.length - departments.length,
    excludedEmployeeCount: source.employees.length - employees.length,
    multiDepartmentEmployeeCount: employees.filter((employee) => employee.hasMultipleDepartments).length
  };

  return { directory, summary };
}
