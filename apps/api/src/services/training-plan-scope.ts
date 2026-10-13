type TrainingDepartment = { id: string; parentId: string | null; status: 'ACTIVE' | 'INACTIVE' };
type TrainingMember = {
  id: number;
  profileId: string | null;
  email?: string | null;
  departmentIds: string[];
  position: string | null;
};
type TrainingTarget = {
  id: string;
  targetType: 'DEPARTMENT' | 'POSITION' | 'USER';
  departmentId: string | null;
  position: string | null;
  memberId: number | null;
  includeDescendants: boolean;
};

export function resolveTrainingRecipients(
  departments: TrainingDepartment[],
  members: TrainingMember[],
  targets: TrainingTarget[]
) {
  const activeDepartmentIds = new Set(
    departments.filter((department) => department.status === 'ACTIVE').map((department) => department.id)
  );
  const childIds = new Map<string, string[]>();
  for (const department of departments) {
    if (department.status !== 'ACTIVE' || !department.parentId) continue;

    const children = childIds.get(department.parentId) ?? [];
    children.push(department.id);
    childIds.set(department.parentId, children);
  }

  const departmentTargets = targets.filter((target) => target.targetType === 'DEPARTMENT');
  const positionTargets = targets.filter((target) => target.targetType === 'POSITION');
  const preparedTargets = targets.map((target) => {
    const departmentIds = new Set<string>();
    if (target.targetType === 'DEPARTMENT' && target.departmentId && activeDepartmentIds.has(target.departmentId)) {
      departmentIds.add(target.departmentId);
      if (target.includeDescendants) {
        const pending = [target.departmentId];
        while (pending.length) {
          const parentId = pending.shift()!;
          for (const childId of childIds.get(parentId) ?? []) {
            if (departmentIds.has(childId)) continue;

            departmentIds.add(childId);
            pending.push(childId);
          }
        }
      }
    }

    return { target, departmentIds };
  });
  const matches = new Map<
    number,
    { memberId: number; profileId: string | null; email: string | null; matchedTargetIds: string[] }
  >();
  for (const member of members) {
    const matchedTargets = preparedTargets.filter(
      ({ target, departmentIds }) =>
        (target.targetType === 'DEPARTMENT' &&
          member.departmentIds.some((departmentId) => departmentIds.has(departmentId))) ||
        (target.targetType === 'POSITION' &&
          !!member.position &&
          member.position.trim().toLowerCase() === target.position?.trim().toLowerCase()) ||
        (target.targetType === 'USER' && member.id === target.memberId)
    );
    const selected =
      matchedTargets.some(({ target }) => target.targetType === 'USER') ||
      ((departmentTargets.length > 0 || positionTargets.length > 0) &&
        (!departmentTargets.length || matchedTargets.some(({ target }) => target.targetType === 'DEPARTMENT')) &&
        (!positionTargets.length || matchedTargets.some(({ target }) => target.targetType === 'POSITION')));
    if (!selected) continue;

    const matchedTargetIds = [...new Set(matchedTargets.map(({ target }) => target.id))];
    const existing = matches.get(member.id);
    if (existing) {
      existing.matchedTargetIds = [...new Set([...existing.matchedTargetIds, ...matchedTargetIds])];
    } else {
      matches.set(member.id, {
        memberId: member.id,
        profileId: member.profileId,
        email: member.email ?? null,
        matchedTargetIds
      });
    }
  }

  return [...matches.values()];
}
