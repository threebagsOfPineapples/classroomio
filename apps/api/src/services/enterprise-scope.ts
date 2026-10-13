type DepartmentNode = {
  id: string;
  parentId: string | null;
  leaderMemberId: number | null;
  status: 'ACTIVE' | 'INACTIVE';
};

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
