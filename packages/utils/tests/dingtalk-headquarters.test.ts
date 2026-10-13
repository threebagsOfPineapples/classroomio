import { describe, expect, it } from 'vitest';
import {
  filterDingtalkHeadquartersDirectory,
  resolveDingtalkHeadquartersScope
} from '../src/functions/dingtalk-headquarters';
import type { TDingtalkDirectory } from '../src/validation/auth/dingtalk';

function directory(): TDingtalkDirectory {
  const departments = [
    { id: 1, parentId: 0, name: 'Root', sort: 0 },
    { id: 986403624, parentId: 1, name: 'Group', sort: 0 },
    { id: 967223303, parentId: 986403624, name: 'Headquarters', sort: 0 },
    { id: 10, parentId: 967223303, name: 'Operations', sort: 0 },
    { id: 11, parentId: 10, name: 'Team', sort: 0 },
    { id: 1076307045, parentId: 967223303, name: 'Excluded company', sort: 0 },
    { id: 20, parentId: 1076307045, name: 'Excluded team', sort: 0 },
    { id: 30, parentId: 986403624, name: 'Other company', sort: 0 }
  ];
  const assignments = [
    ['headquarters', [10]],
    ['root-only', [1]],
    ['group-only', [986403624]],
    ['excluded', [20]],
    ['other-company', [30]],
    ['cross-company', [10, 20]],
    ['multi-headquarters', [10, 11]]
  ] as const;
  const employees = assignments.map(([userId, departmentIds]) => ({
    userId,
    departmentIds: [...departmentIds],
    name: 'Synthetic employee',
    employeeNo: null,
    position: null,
    companyEmail: null
  }));

  return { departments, employees };
}

describe('confirmed DingTalk headquarters scope', () => {
  it('retains only headquarters staff, removes excluded descendants and keeps structural ancestors', () => {
    const filtered = filterDingtalkHeadquartersDirectory(directory());

    expect(filtered.directory.departments.map((department) => department.id)).toEqual([
      1, 986403624, 967223303, 10, 11
    ]);
    expect(filtered.directory.employees.map((employee) => employee.userId)).toEqual([
      'headquarters',
      'cross-company',
      'multi-headquarters'
    ]);
    expect(filtered.summary).toMatchObject({
      eligibleDepartmentCount: 3,
      ancestorDepartmentCount: 2,
      excludedEmployeeCount: 4,
      excludedDepartmentCount: 3,
      multiDepartmentEmployeeCount: 2
    });
  });

  it('keeps original multi-department statistics after discarding departments outside headquarters', () => {
    const source = directory();
    const filtered = filterDingtalkHeadquartersDirectory(source);
    const employee = filtered.directory.employees.find((row) => row.userId === 'cross-company');

    expect(employee).toMatchObject({ departmentIds: [10], hasMultipleDepartments: true });
    expect(source.employees.find((row) => row.userId === 'cross-company')?.departmentIds).toEqual([10, 20]);
    expect(filterDingtalkHeadquartersDirectory(filtered.directory).directory).toEqual(filtered.directory);
  });

  it('resolves local department IDs from external identifiers and never includes ancestors in member scope', () => {
    const departments = [
      { id: 'local-root', parentId: null, externalId: '1' },
      { id: 'local-group', parentId: 'local-root', externalId: '986403624' },
      { id: 'local-hq', parentId: 'local-group', externalId: '967223303' },
      { id: 'local-team', parentId: 'local-hq', externalId: '10' },
      { id: 'local-excluded', parentId: 'local-hq', externalId: '1076307045' },
      { id: 'local-excluded-team', parentId: 'local-excluded', externalId: '20' }
    ];
    const scope = resolveDingtalkHeadquartersScope(departments);

    expect([...scope.departmentIds].sort()).toEqual(['local-hq', 'local-team']);
    expect([...scope.ancestorIds].sort()).toEqual(['local-group', 'local-root']);
  });

  it('does not substitute the group or root when headquarters is missing', () => {
    const scope = resolveDingtalkHeadquartersScope([{ id: 'root', parentId: null, externalId: '1' }]);

    expect(scope.departmentIds.size).toBe(0);
    expect(scope.ancestorIds.size).toBe(0);
  });
});
