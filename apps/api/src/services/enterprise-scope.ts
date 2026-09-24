type DepartmentNode = {
  id: string;
  parentId: string | null;
  leaderMemberId: number | null;
  status: 'ACTIVE' | 'INACTIVE';
};

export function visibleDepartmentIds(departments: DepartmentNode[], memberId: number): string[] {
  const visible = new Set(
    departments.filter((item) => item.status === 'ACTIVE' && item.leaderMemberId === memberId).map((item) => item.id)
  );
  let changed = true;

  while (changed) {
    changed = false;
    for (const item of departments) {
      if (item.status === 'ACTIVE' && item.parentId && visible.has(item.parentId) && !visible.has(item.id)) {
        visible.add(item.id);
        changed = true;
      }
    }
  }

  return [...visible];
}

export function wouldCreateDepartmentCycle(
  departments: Pick<DepartmentNode, 'id' | 'parentId'>[],
  departmentId: string,
  parentId: string | null
): boolean {
  const parents = new Map(departments.map((item) => [item.id, item.parentId]));
  const visited = new Set<string>();
  let current = parentId;

  while (current) {
    if (current === departmentId || visited.has(current)) return true;

    visited.add(current);
    current = parents.get(current) ?? null;
  }

  return false;
}
