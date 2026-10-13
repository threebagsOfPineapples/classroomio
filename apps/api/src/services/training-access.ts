import { getEnterpriseOverview } from '@api/services/enterprise';
import { AppError, ErrorCodes } from '@api/utils/errors';
import { getEnterpriseMember } from '@cio/db/queries/enterprise';
import { getTrainingHeadquartersMemberIds, listEnterpriseScopedMemberIds } from '@cio/db/queries/enterprise/access';

export async function loadActiveTrainingActor(organizationId: string, profileId: string) {
  const overview = await getEnterpriseOverview(organizationId, profileId);
  const headquartersMemberIds = await getTrainingHeadquartersMemberIds(organizationId);
  if (
    !overview.canManageTraining &&
    headquartersMemberIds !== null &&
    !headquartersMemberIds.includes(overview.memberId)
  ) {
    throw new AppError('Member is outside the training scope', ErrorCodes.ORG_TEAM_NOT_AUTHORIZED, 403);
  }

  return {
    organizationId,
    profileId,
    memberId: overview.memberId,
    roles: overview.roles,
    canManageTraining: overview.canManageTraining,
    canGrantPermissions: overview.isSuperAdmin,
    canReadReports: overview.canManageTraining || overview.roles.includes('DEPARTMENT_MANAGER'),
    canReadSummary:
      overview.canManageTraining ||
      overview.roles.includes('DEPARTMENT_MANAGER') ||
      overview.roles.includes('EXECUTIVE'),
    departmentIds: overview.scopedDepartmentIds,
    memberIds: overview.scopedMemberIds
  };
}

export type TrainingActor = Awaited<ReturnType<typeof loadActiveTrainingActor>>;
export type TrainingReadScope = { type: 'ALL' } | { type: 'MEMBERS'; memberIds: number[] };

export function requireTrainingAdministrator(actor: TrainingActor) {
  if (!actor.canManageTraining) {
    throw new AppError('Training administrator access required', ErrorCodes.ORG_TEAM_NOT_AUTHORIZED, 403);
  }
}

export function requireTrainingReportReader(actor: TrainingActor) {
  if (!actor.canReadReports) {
    throw new AppError('Training report access required', ErrorCodes.ORG_TEAM_NOT_AUTHORIZED, 403);
  }
}

export async function resolveTrainingReadScope(actor: TrainingActor): Promise<TrainingReadScope> {
  const headquartersMemberIds = await getTrainingHeadquartersMemberIds(actor.organizationId);
  if (actor.canManageTraining) {
    return headquartersMemberIds === null ? { type: 'ALL' } : { type: 'MEMBERS', memberIds: headquartersMemberIds };
  }

  const allowedIds = headquartersMemberIds === null ? null : new Set(headquartersMemberIds);
  const selfIds = !allowedIds || allowedIds.has(actor.memberId) ? [actor.memberId] : [];
  if (!actor.roles.includes('DEPARTMENT_MANAGER')) return { type: 'MEMBERS', memberIds: selfIds };

  const members = await listEnterpriseScopedMemberIds(actor.organizationId, actor.departmentIds, actor.memberIds);
  const scopedIds = [...new Set([...selfIds, ...members.map((member) => member.id)])];
  const memberIds = allowedIds ? scopedIds.filter((memberId) => allowedIds.has(memberId)) : scopedIds;
  return { type: 'MEMBERS', memberIds };
}

export async function requireTrainingMemberVisible(actor: TrainingActor, memberId: number) {
  const scope = await resolveTrainingReadScope(actor);
  if (scope.type === 'MEMBERS' && !scope.memberIds.includes(memberId)) {
    throw new AppError('Training member not found', ErrorCodes.ORG_TEAM_NOT_AUTHORIZED, 404);
  }

  const [member] = await getEnterpriseMember(actor.organizationId, memberId);
  if (!member) throw new AppError('Training member not found', ErrorCodes.VALIDATION_ERROR, 404);

  return member;
}

export async function requireActiveTrainingMember(organizationId: string, memberId: number) {
  const headquartersMemberIds = await getTrainingHeadquartersMemberIds(organizationId);
  if (headquartersMemberIds !== null && !headquartersMemberIds.includes(memberId)) {
    throw new AppError('Member is outside the training scope', ErrorCodes.VALIDATION_ERROR, 400);
  }

  const [member] = await getEnterpriseMember(organizationId, memberId);
  if (!member || member.status !== 'ACTIVE' || member.employmentStatus === 'TERMINATED') {
    throw new AppError('Active training member required', ErrorCodes.VALIDATION_ERROR, 400);
  }

  return member;
}
