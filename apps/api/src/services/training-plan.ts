import { AppError, ErrorCodes } from '@api/utils/errors';
import { getEnterpriseOverview } from '@api/services/enterprise';
import { resolveTrainingRecipients } from './training-plan-scope';
import { listEnterpriseDepartments } from '@cio/db/queries/enterprise';
import {
  createTrainingPlan,
  getEligibleTrainingMembers,
  getOrgTrainingCourses,
  getPlanItems,
  getTrainingPlan,
  getTrainingPlanDetail,
  insertTrainingEnrollments,
  listAvailableTrainingCourses,
  listTrainingPlans,
  lockTrainingPlan,
  publishTrainingPlanRecord,
  replaceTrainingPlanItems,
  updateTrainingPlanDraft,
  withTrainingPlanTransaction
} from '@cio/db/queries/training-plan';
import { insertGroupMembersOnConflictDoNothing } from '@cio/db/queries/group';
import { ROLE } from '@cio/utils/constants';
import type { TTrainingPlanDraft, TTrainingPlanTarget } from '@cio/utils/validation/training-plan';

async function requireTrainingManager(organizationId: string, profileId: string) {
  const overview = await getEnterpriseOverview(organizationId, profileId);
  if (!overview.canManage) {
    throw new AppError('Training manager access required', ErrorCodes.ORG_TEAM_NOT_AUTHORIZED, 403);
  }

  return overview;
}

function invalidPlan(message: string): never {
  throw new AppError(message, ErrorCodes.VALIDATION_ERROR, 400);
}

function toStoredTargets(planId: string, targets: TTrainingPlanTarget[]) {
  return targets.map((target) => ({
    planId,
    targetType: target.targetType,
    departmentId: target.targetType === 'DEPARTMENT' ? target.departmentId : null,
    position: target.targetType === 'POSITION' ? target.position : null,
    memberId: target.targetType === 'USER' ? target.memberId : null,
    includeDescendants: target.targetType === 'DEPARTMENT' ? target.includeDescendants : false
  }));
}

async function validateDraftReferences(organizationId: string, ownerMemberId: number, values: TTrainingPlanDraft) {
  const [departments, members, courses] = await Promise.all([
    listEnterpriseDepartments(organizationId),
    getEligibleTrainingMembers(organizationId),
    getOrgTrainingCourses(organizationId, values.courseIds)
  ]);
  const activeDepartmentIds = new Set(departments.filter((item) => item.status === 'ACTIVE').map((item) => item.id));
  const activeMemberIds = new Set(members.map((item) => item.id));
  const uniqueCourseIds = new Set(values.courseIds);

  if (!activeMemberIds.has(ownerMemberId)) invalidPlan('Plan owner must be an active employee');
  if (values.departmentId && !activeDepartmentIds.has(values.departmentId)) invalidPlan('Plan department is invalid');
  if (uniqueCourseIds.size !== values.courseIds.length || courses.length !== uniqueCourseIds.size) {
    invalidPlan('Plan courses must be published courses in this organization');
  }

  const targetKeys = new Set<string>();
  for (const target of values.targets) {
    if (target.targetType === 'DEPARTMENT' && !activeDepartmentIds.has(target.departmentId)) {
      invalidPlan('Target department is invalid');
    }
    if (target.targetType === 'USER' && !activeMemberIds.has(target.memberId)) {
      invalidPlan('Target employee is invalid');
    }

    const key =
      target.targetType === 'DEPARTMENT'
        ? `DEPARTMENT:${target.departmentId}`
        : target.targetType === 'POSITION'
          ? `POSITION:${target.position.toLowerCase()}`
          : `USER:${target.memberId}`;
    if (targetKeys.has(key)) invalidPlan('Training targets must be unique');

    targetKeys.add(key);
  }
}

export async function getTrainingPlans(organizationId: string, profileId: string) {
  await requireTrainingManager(organizationId, profileId);
  return listTrainingPlans(organizationId);
}

export async function getAvailableTrainingCourses(organizationId: string, profileId: string) {
  await requireTrainingManager(organizationId, profileId);
  return listAvailableTrainingCourses(organizationId);
}

export async function getTrainingPlanById(organizationId: string, profileId: string, planId: string) {
  await requireTrainingManager(organizationId, profileId);
  const detail = await getTrainingPlanDetail(organizationId, planId);
  if (!detail) throw new AppError('Training plan not found', ErrorCodes.VALIDATION_ERROR, 404);

  return detail;
}

export async function addTrainingPlan(organizationId: string, profileId: string, values: TTrainingPlanDraft) {
  const overview = await requireTrainingManager(organizationId, profileId);
  const ownerMemberId = values.ownerMemberId ?? overview.memberId;
  await validateDraftReferences(organizationId, ownerMemberId, values);

  const planId = await withTrainingPlanTransaction(async (transaction) => {
    const [created] = await createTrainingPlan(
      {
        organizationId,
        name: values.name,
        code: values.code,
        description: values.description ?? null,
        year: values.year,
        planType: values.planType,
        ownerMemberId,
        departmentId: values.departmentId ?? null,
        startAt: values.startAt,
        endAt: values.endAt,
        passScore: values.passScore ?? null,
        createdByProfileId: profileId
      },
      transaction
    );
    await replaceTrainingPlanItems(
      created.id,
      values.courseIds,
      toStoredTargets(created.id, values.targets),
      transaction
    );
    return created.id;
  });

  return getTrainingPlanById(organizationId, profileId, planId);
}

export async function editTrainingPlan(
  organizationId: string,
  profileId: string,
  planId: string,
  values: TTrainingPlanDraft
) {
  const overview = await requireTrainingManager(organizationId, profileId);
  const ownerMemberId = values.ownerMemberId ?? overview.memberId;
  await validateDraftReferences(organizationId, ownerMemberId, values);

  await withTrainingPlanTransaction(async (transaction) => {
    const current = await lockTrainingPlan(organizationId, planId, transaction);
    if (!current) throw new AppError('Training plan not found', ErrorCodes.VALIDATION_ERROR, 404);
    if (current.status !== 'DRAFT') invalidPlan('Only draft plans can be edited');

    await updateTrainingPlanDraft(
      organizationId,
      planId,
      {
        name: values.name,
        code: values.code,
        description: values.description ?? null,
        year: values.year,
        planType: values.planType,
        ownerMemberId,
        departmentId: values.departmentId ?? null,
        startAt: values.startAt,
        endAt: values.endAt,
        passScore: values.passScore ?? null,
        version: current.version + 1
      },
      transaction
    );
    await replaceTrainingPlanItems(planId, values.courseIds, toStoredTargets(planId, values.targets), transaction);
  });

  return getTrainingPlanById(organizationId, profileId, planId);
}

export async function previewTrainingPlan(organizationId: string, profileId: string, planId: string) {
  await requireTrainingManager(organizationId, profileId);
  const plan = await getTrainingPlan(organizationId, planId);
  if (!plan) throw new AppError('Training plan not found', ErrorCodes.VALIDATION_ERROR, 404);

  const [departments, members, [, targets]] = await Promise.all([
    listEnterpriseDepartments(organizationId),
    getEligibleTrainingMembers(organizationId),
    getPlanItems(planId)
  ]);
  const recipients = resolveTrainingRecipients(departments, members, targets);
  return { count: recipients.length, memberIds: recipients.map((item) => item.memberId) };
}

export async function publishTrainingPlan(organizationId: string, profileId: string, planId: string) {
  await requireTrainingManager(organizationId, profileId);

  await withTrainingPlanTransaction(async (transaction) => {
    const plan = await lockTrainingPlan(organizationId, planId, transaction);
    if (!plan) throw new AppError('Training plan not found', ErrorCodes.VALIDATION_ERROR, 404);
    if (plan.status === 'PUBLISHED') return;
    if (plan.status !== 'DRAFT') invalidPlan('Only draft plans can be published');

    const [[courses, targets], departments, members] = await Promise.all([
      getPlanItems(planId, transaction),
      listEnterpriseDepartments(organizationId),
      getEligibleTrainingMembers(organizationId, transaction)
    ]);
    if (courses.length === 0 || targets.length === 0) invalidPlan('Plan needs courses and targets');

    const validCourses = await getOrgTrainingCourses(
      organizationId,
      courses.map((item) => item.courseId),
      transaction
    );
    if (validCourses.length !== courses.length) invalidPlan('Plan includes an unavailable course');

    const activeDepartmentIds = new Set(departments.filter((item) => item.status === 'ACTIVE').map((item) => item.id));
    const activeMemberIds = new Set(members.map((item) => item.id));
    for (const target of targets) {
      if (target.targetType === 'DEPARTMENT' && !activeDepartmentIds.has(target.departmentId!)) {
        invalidPlan('Plan includes an inactive department');
      }
      if (target.targetType === 'USER' && !activeMemberIds.has(target.memberId!)) {
        invalidPlan('Plan includes an inactive employee');
      }
    }

    const recipients = resolveTrainingRecipients(departments, members, targets);
    if (recipients.length === 0) invalidPlan('Plan has no eligible employees');

    await insertTrainingEnrollments(
      recipients.map((recipient) => ({
        organizationId,
        planId,
        memberId: recipient.memberId,
        matchedTargetIds: recipient.matchedTargetIds,
        planVersion: plan.version
      })),
      transaction
    );
    await insertGroupMembersOnConflictDoNothing(
      validCourses.flatMap((trainingCourse) =>
        recipients
          .filter((recipient) => recipient.profileId)
          .map((recipient) => ({
            groupId: trainingCourse.groupId,
            roleId: ROLE.STUDENT,
            profileId: recipient.profileId,
            email: undefined
          }))
      ),
      transaction
    );
    await publishTrainingPlanRecord(organizationId, planId, profileId, transaction);
  });

  return getTrainingPlanById(organizationId, profileId, planId);
}

export async function supplementTrainingPlan(
  organizationId: string,
  profileId: string,
  planId: string,
  memberIds: number[]
) {
  await requireTrainingManager(organizationId, profileId);

  await withTrainingPlanTransaction(async (transaction) => {
    const plan = await lockTrainingPlan(organizationId, planId, transaction);
    if (!plan) throw new AppError('Training plan not found', ErrorCodes.VALIDATION_ERROR, 404);
    if (plan.status !== 'PUBLISHED') invalidPlan('Only published plans accept additional employees');

    const [[courses], members] = await Promise.all([
      getPlanItems(planId, transaction),
      getEligibleTrainingMembers(organizationId, transaction)
    ]);
    const selectedIds = new Set(memberIds);
    const selectedMembers = members.filter((member) => selectedIds.has(member.id));
    if (selectedMembers.length !== selectedIds.size)
      invalidPlan('Selected employee is inactive or outside this organization');

    const validCourses = await getOrgTrainingCourses(
      organizationId,
      courses.map((item) => item.courseId),
      transaction
    );
    if (courses.length === 0 || validCourses.length !== courses.length)
      invalidPlan('Plan includes an unavailable course');

    const inserted = await insertTrainingEnrollments(
      selectedMembers.map((member) => ({
        organizationId,
        planId,
        memberId: member.id,
        matchedTargetIds: [],
        planVersion: plan.version
      })),
      transaction
    );
    const insertedIds = new Set(inserted.map((item) => item.memberId));
    await insertGroupMembersOnConflictDoNothing(
      validCourses.flatMap((trainingCourse) =>
        selectedMembers
          .filter((member) => member.profileId && insertedIds.has(member.id))
          .map((member) => ({
            groupId: trainingCourse.groupId,
            roleId: ROLE.STUDENT,
            profileId: member.profileId!,
            email: undefined
          }))
      ),
      transaction
    );
  });

  return getTrainingPlanById(organizationId, profileId, planId);
}
