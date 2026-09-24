type TrainingDepartment = { id: string; parentId: string | null; status: 'ACTIVE' | 'INACTIVE' };
type TrainingMember = {
  id: number;
  profileId: string | null;
  email?: string | null;
  departmentId: string | null;
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
  const childIds = new Map<string, string[]>();
  for (const department of departments) {
    if (department.status !== 'ACTIVE' || !department.parentId) continue;

    const children = childIds.get(department.parentId) ?? [];
    children.push(department.id);
    childIds.set(department.parentId, children);
  }

  const matches = new Map<
    number,
    { memberId: number; profileId: string | null; email: string | null; matchedTargetIds: string[] }
  >();
  for (const target of targets) {
    const departmentIds = new Set<string>();
    if (target.targetType === 'DEPARTMENT' && target.departmentId) {
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

    for (const member of members) {
      const selected =
        (target.targetType === 'DEPARTMENT' && !!member.departmentId && departmentIds.has(member.departmentId)) ||
        (target.targetType === 'POSITION' &&
          !!member.position &&
          member.position.trim().toLowerCase() === target.position?.trim().toLowerCase()) ||
        (target.targetType === 'USER' && member.id === target.memberId);
      if (!selected) continue;

      const existing = matches.get(member.id);
      if (existing) {
        existing.matchedTargetIds.push(target.id);
      } else {
        matches.set(member.id, {
          memberId: member.id,
          profileId: member.profileId,
          email: member.email ?? null,
          matchedTargetIds: [target.id]
        });
      }
    }
  }

  return [...matches.values()];
}
