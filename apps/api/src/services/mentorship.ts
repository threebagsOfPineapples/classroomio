import { AppError, ErrorCodes } from '@api/utils/errors';
import { loadActiveTrainingActor, type TrainingActor } from './training-access';
import { getCourseMemberProgressSummaries } from './course/member-progress';
import { listCompletedAssessmentSubmissions } from '@cio/db/queries/assessment';
import {
  getBatchStudentCourseMembership,
  getCourseTrackableContentCounts
} from '@cio/db/queries/course/member-progress';
import {
  addTrainingOperationAudit,
  getEnterpriseMemberScopes,
  getTrainingHeadquartersMemberIds,
  getTrainingMemberDepartmentIds,
  listEnterpriseScopedMemberIds
} from '@cio/db/queries/enterprise/access';
import type { DbOrTxClient } from '@cio/db/drizzle';
import { ROLE } from '@cio/utils/constants';
import type {
  TMentorshipBulk,
  TMentorshipCertification,
  TMentorshipFilter,
  TMentorshipReview,
  TMentorshipSubmission,
  TMentorshipSupervisorReview,
  TMentorshipTask
} from '@cio/utils/validation/mentorship';
import {
  createMentorshipCertification,
  createMentorshipRelation,
  createMentorshipReview,
  createMentorshipSubmission,
  createMentorshipSupervisorReview,
  createMentorshipTask,
  endMentorshipRelation,
  getCurrentMentorshipRelation,
  getMentorshipExamConfiguration,
  getMentorshipEvidenceSource,
  getMentorshipHistory,
  getMentorshipMember,
  getMentorshipMemberRoles,
  getMentorshipRelation,
  getMentorshipTask,
  handoverMentorshipRelation,
  listMentorshipHandovers,
  listMentorshipMembers,
  listMentorshipRelations,
  listMentorshipResources,
  listMentorshipTasks,
  updateMentorshipTaskState,
  validateMentorshipResources,
  withMentorshipTransaction
} from '@cio/db/queries/mentorship';
import {
  canMentorshipActorReview,
  canMentorshipSupervisorReview,
  isCurrentMentorshipSubmission,
  isEffectiveMentorshipRelation,
  satisfiesMentorshipCertification
} from './mentorship-policy';
import { mentorshipExamBaseline } from './mentorship-exam';

function fail(message: string, status = 400): never {
  throw new AppError(message, ErrorCodes.VALIDATION_ERROR, status);
}

function requireAdministrator(actor: TrainingActor) {
  if (!actor.canManageTraining) fail('Training administrator access required', 403);
}

async function readScope(actor: TrainingActor, client?: DbOrTxClient) {
  const headquartersMemberIds = await getTrainingHeadquartersMemberIds(actor.organizationId, client);
  if (actor.canManageTraining) return headquartersMemberIds;
  if (!actor.roles.includes('DEPARTMENT_MANAGER')) {
    return headquartersMemberIds === null || headquartersMemberIds.includes(actor.memberId) ? [actor.memberId] : [];
  }

  const scopes = await getEnterpriseMemberScopes(actor.organizationId, actor.memberId, client);
  const members = await listEnterpriseScopedMemberIds(
    actor.organizationId,
    scopes.departmentIds,
    scopes.memberIds,
    client
  );
  const memberIds = [...new Set([actor.memberId, ...members.map((member) => member.id)])];
  return headquartersMemberIds === null
    ? memberIds
    : memberIds.filter((memberId) => headquartersMemberIds.includes(memberId));
}

async function activeMember(
  organizationId: string,
  memberId: number,
  client: DbOrTxClient,
  lock = false,
  headquartersRequired = true
) {
  const member = await getMentorshipMember(organizationId, memberId, client, lock);
  if (!member || member.status !== 'ACTIVE' || member.employmentStatus === 'TERMINATED')
    fail('Active training member required');

  if (headquartersRequired) {
    const headquartersMemberIds = await getTrainingHeadquartersMemberIds(organizationId, client);
    if (headquartersMemberIds !== null && !headquartersMemberIds.includes(memberId))
      fail('Headquarters training member required');
  }

  return member;
}

async function refreshActor(actor: TrainingActor, client: DbOrTxClient) {
  const member = await activeMember(actor.organizationId, actor.memberId, client, true, false);
  if (member.profileId !== actor.profileId) fail('Active training actor required', 403);

  const roleRows = await getMentorshipMemberRoles(actor.organizationId, member.id, client);
  const roles = roleRows.map((row) => row.role);
  const canGrantPermissions = member.roleId === ROLE.ADMIN || roles.includes('SUPER_ADMIN');
  const canManageTraining = canGrantPermissions || roles.includes('TRAINING_ADMIN');
  return { ...actor, roles, canManageTraining, canGrantPermissions };
}

async function eligibleMentor(organizationId: string, memberId: number, client: DbOrTxClient) {
  await activeMember(organizationId, memberId, client, true);
  const roles = await getMentorshipMemberRoles(organizationId, memberId, client);
  if (!roles.some((role) => role.role === 'MENTOR')) fail('Mentor qualification required');
}

async function supervisorCovers(
  organizationId: string,
  reviewerMemberId: number,
  learnerMemberId: number,
  client: DbOrTxClient
) {
  const reviewer = await getMentorshipMember(organizationId, reviewerMemberId, client, true);
  if (!reviewer || reviewer.status !== 'ACTIVE' || reviewer.employmentStatus === 'TERMINATED') return false;

  const roles = await getMentorshipMemberRoles(organizationId, reviewerMemberId, client);
  if (!roles.some((role) => role.role === 'DEPARTMENT_MANAGER')) return false;

  const learner = await getMentorshipMember(organizationId, learnerMemberId, client);
  if (!learner || learner.status !== 'ACTIVE' || learner.employmentStatus === 'TERMINATED') return false;

  const headquartersMemberIds = await getTrainingHeadquartersMemberIds(organizationId, client);
  if (
    headquartersMemberIds !== null &&
    (!headquartersMemberIds.includes(learnerMemberId) || !headquartersMemberIds.includes(reviewerMemberId))
  )
    return false;

  const scopes = await getEnterpriseMemberScopes(organizationId, reviewerMemberId, client);
  const learnerDepartments = await getTrainingMemberDepartmentIds(organizationId, learnerMemberId, client);
  return (
    scopes.memberIds.includes(learnerMemberId) ||
    learnerDepartments.some((departmentId) => scopes.departmentIds.includes(departmentId))
  );
}

async function audit(
  actor: TrainingActor,
  resourceId: string,
  action: string,
  targetMemberId: number | null,
  reason: string | null,
  client: DbOrTxClient
) {
  await addTrainingOperationAudit(
    {
      organizationId: actor.organizationId,
      actorProfileId: actor.profileId,
      resourceType: 'MENTORSHIP',
      resourceId,
      action,
      targetMemberId,
      reason
    },
    client
  );
}

async function taskContext(actor: TrainingActor, taskId: string, client: DbOrTxClient, lock = false) {
  const firstTask = await getMentorshipTask(actor.organizationId, taskId, client);
  if (!firstTask) fail('Mentorship task not found', 404);

  const relation = await getMentorshipRelation(actor.organizationId, firstTask.relationId, client, lock);
  if (!relation) fail('Mentorship relationship not found', 404);

  const headquartersMemberIds = await getTrainingHeadquartersMemberIds(actor.organizationId, client);
  if (headquartersMemberIds !== null && !headquartersMemberIds.includes(relation.learnerMemberId))
    fail('Mentorship task not found', 404);

  const task = lock ? await getMentorshipTask(actor.organizationId, taskId, client, true) : firstTask;
  if (!task || task.relationId !== relation.id) fail('Relationship changed; reload task', 409);

  const learner = await getMentorshipMember(actor.organizationId, relation.learnerMemberId, client);
  const mentor = await getMentorshipMember(actor.organizationId, relation.mentorMemberId, client);
  const mentorRoles = await getMentorshipMemberRoles(actor.organizationId, relation.mentorMemberId, client);
  const mentorQualified =
    mentorRoles.some((role) => role.role === 'MENTOR') &&
    (headquartersMemberIds === null || headquartersMemberIds.includes(relation.mentorMemberId));
  const effectiveRelation =
    isEffectiveMentorshipRelation(relation) &&
    mentorQualified &&
    mentor?.status === 'ACTIVE' &&
    mentor.employmentStatus !== 'TERMINATED' &&
    learner?.status === 'ACTIVE' &&
    learner.employmentStatus !== 'TERMINATED';
  const isMentor =
    actor.roles.includes('MENTOR') &&
    canMentorshipActorReview(actor.memberId, relation.mentorMemberId, Boolean(effectiveRelation));
  const learnerSelf = actor.memberId === relation.learnerMemberId;
  const memberIds = await readScope(actor, client);
  if (!isMentor && !learnerSelf && memberIds !== null && !memberIds.includes(relation.learnerMemberId))
    fail('Mentorship task not found', 404);

  const history = await getMentorshipHistory(task.id, client);
  return { task, relation, learner, effectiveRelation: Boolean(effectiveRelation), isMentor, learnerSelf, history };
}

export async function getMentorshipOptions(organizationId: string, profileId: string) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  return withMentorshipTransaction(async (transaction) => {
    const currentActor = await refreshActor(actor, transaction);
    const canManage = currentActor.canManageTraining;
    const resources = canManage
      ? await listMentorshipResources(organizationId, transaction)
      : { plans: [], courses: [], exercises: [] };
    const members = canManage ? await listMentorshipMembers(organizationId, transaction) : [];
    return { actorMemberId: currentActor.memberId, canManage, members, ...resources };
  });
}

export async function getMentorshipRelations(organizationId: string, profileId: string) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  return withMentorshipTransaction(async (transaction) => {
    const currentActor = await refreshActor(actor, transaction);
    const scope = await readScope(currentActor, transaction);
    return listMentorshipRelations(organizationId, scope, currentActor.memberId, transaction);
  });
}

export async function getMentorships(organizationId: string, profileId: string, filter: TMentorshipFilter) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  return withMentorshipTransaction(async (transaction) => {
    const currentActor = await refreshActor(actor, transaction);
    const scope = await readScope(currentActor, transaction);
    const rows = await listMentorshipTasks(organizationId, scope, currentActor.memberId, filter, transaction);
    return rows.map((row) => {
      const overdue = row.task.state !== 'CERTIFIED' && Date.parse(row.task.dueAt) < Date.now();
      const relationshipEffective =
        isEffectiveMentorshipRelation(row.relation) &&
        row.mentorActive === 'ACTIVE' &&
        row.mentorEmploymentStatus !== 'TERMINATED';
      return { ...row, overdue, relationshipEffective };
    });
  });
}

export async function bindMentorships(organizationId: string, profileId: string, values: TMentorshipBulk) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  requireAdministrator(actor);
  return withMentorshipTransaction(async (transaction) => {
    const currentActor = await refreshActor(actor, transaction);
    requireAdministrator(currentActor);
    await eligibleMentor(organizationId, values.mentorMemberId, transaction);
    const validResources = await validateMentorshipResources(organizationId, values.planId, null, null, transaction);
    if (!validResources) fail('Training plan not found');

    const relations = [];
    for (const learnerMemberId of [...values.learnerMemberIds].sort((first, second) => first - second)) {
      await activeMember(organizationId, learnerMemberId, transaction, true);
      const current = await getCurrentMentorshipRelation(organizationId, learnerMemberId, values.planId, transaction);
      if (current && Date.parse(current.endsAt) > Date.now()) fail('Learner already has a current mentor');
      if (current) await endMentorshipRelation(current.id, transaction);

      const relation = await createMentorshipRelation(
        {
          organizationId,
          learnerMemberId,
          mentorMemberId: values.mentorMemberId,
          planId: values.planId,
          startsAt: values.startsAt,
          endsAt: values.endsAt,
          createdByProfileId: profileId
        },
        transaction
      );
      await audit(currentActor, relation.id, 'BIND', learnerMemberId, null, transaction);
      relations.push(relation);
    }
    return relations;
  });
}

export async function changeMentorshipMentor(
  organizationId: string,
  profileId: string,
  relationId: string,
  values: { mentorMemberId: number; reason: string }
) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  requireAdministrator(actor);
  return withMentorshipTransaction(async (transaction) => {
    const currentActor = await refreshActor(actor, transaction);
    requireAdministrator(currentActor);
    const oldRelation = await getMentorshipRelation(organizationId, relationId, transaction, true);
    if (!oldRelation || oldRelation.status !== 'ACTIVE') fail('Current relationship required', 409);
    if (oldRelation.learnerMemberId === values.mentorMemberId || oldRelation.mentorMemberId === values.mentorMemberId)
      fail('A different mentor is required');
    if (Date.parse(oldRelation.endsAt) <= Date.now()) fail('Relationship has expired');

    await eligibleMentor(organizationId, values.mentorMemberId, transaction);
    await activeMember(organizationId, oldRelation.learnerMemberId, transaction, true);
    await endMentorshipRelation(oldRelation.id, transaction);
    const startsAt = new Date(Math.max(Date.now(), Date.parse(oldRelation.startsAt))).toISOString();
    const newRelation = await createMentorshipRelation(
      {
        organizationId,
        learnerMemberId: oldRelation.learnerMemberId,
        mentorMemberId: values.mentorMemberId,
        planId: oldRelation.planId,
        startsAt,
        endsAt: oldRelation.endsAt,
        createdByProfileId: profileId
      },
      transaction
    );
    await handoverMentorshipRelation(oldRelation, newRelation, values.reason, profileId, transaction);
    await audit(currentActor, newRelation.id, 'CHANGE_MENTOR', oldRelation.learnerMemberId, values.reason, transaction);
    return newRelation;
  });
}

export async function assignMentorshipTasks(organizationId: string, profileId: string, values: TMentorshipTask) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  requireAdministrator(actor);
  return withMentorshipTransaction(async (transaction) => {
    const currentActor = await refreshActor(actor, transaction);
    requireAdministrator(currentActor);
    const validResources = await validateMentorshipResources(
      organizationId,
      null,
      values.courseId,
      values.exerciseId,
      transaction
    );
    if (!validResources) fail('Course or exam not found in this organization');

    let examMaxScore: number | null = null;
    let examPassThreshold: number | null = null;
    let examScoringFingerprint: string | null = null;
    if (values.exerciseId && values.courseId) {
      const configuration = await getMentorshipExamConfiguration(
        organizationId,
        values.courseId,
        values.exerciseId,
        transaction
      );
      if (!configuration) fail('Exam not found in this organization');

      const baseline = mentorshipExamBaseline(configuration);
      if (baseline.examPassThreshold === null || baseline.examPassThreshold < 0 || baseline.examPassThreshold > 100)
        throw new AppError(
          'Exam passing threshold must be configured before assigning mentorship tasks',
          ErrorCodes.VALIDATION_ERROR,
          400,
          'examPassThreshold'
        );
      if (!Number.isFinite(baseline.examMaxScore) || baseline.examMaxScore <= 0)
        throw new AppError(
          'Exam needs a positive maximum score before assigning mentorship tasks',
          ErrorCodes.VALIDATION_ERROR,
          400,
          'examMaxScore'
        );

      examMaxScore = baseline.examMaxScore;
      examPassThreshold = baseline.examPassThreshold;
      examScoringFingerprint = baseline.examScoringFingerprint;
    }

    const tasks = [];
    for (const relationId of [...new Set(values.relationIds)].sort()) {
      const relation = await getMentorshipRelation(organizationId, relationId, transaction, true);
      if (!relation || relation.status !== 'ACTIVE' || Date.parse(relation.endsAt) <= Date.now())
        fail('Current relationship required');
      if (
        Date.parse(values.dueAt) > Date.parse(relation.endsAt) ||
        Date.parse(values.dueAt) < Date.parse(relation.startsAt)
      )
        fail('Task deadline must be within relationship dates');

      await activeMember(organizationId, relation.learnerMemberId, transaction);
      await eligibleMentor(organizationId, relation.mentorMemberId, transaction);
      if (values.requiresSupervisorReview) {
        const coversLearner = await supervisorCovers(
          organizationId,
          values.reviewerMemberId!,
          relation.learnerMemberId,
          transaction
        );
        if (!coversLearner || values.reviewerMemberId === relation.learnerMemberId)
          fail('Configured reviewer must supervise this learner');
      }
      const { relationIds, ...taskValues } = values;
      const task = await createMentorshipTask(
        {
          ...taskValues,
          organizationId,
          relationId,
          createdByProfileId: profileId,
          examMaxScore,
          examPassThreshold,
          examScoringFingerprint
        },
        transaction
      );
      await audit(currentActor, task.id, 'ASSIGN_TASK', relation.learnerMemberId, null, transaction);
      tasks.push(task);
    }
    return tasks;
  });
}

async function readEvidence(
  context: Awaited<ReturnType<typeof taskContext>>,
  organizationId: string,
  client: DbOrTxClient
) {
  const task = context.task;
  let courseProgress: number | null = null;
  let examScore: number | null = null;
  let examMaxScore: number | null = null;
  let examPassThreshold: number | null = null;
  let examSubmissionId: string | null = null;
  let examConfigurationUnchanged = !task.exerciseId;
  if (task.courseId && context.learner?.profileId) {
    const profileId = context.learner.profileId;
    const counts = await getCourseTrackableContentCounts(task.courseId);
    const memberships = await getBatchStudentCourseMembership(task.courseId, [profileId]);
    if (memberships.has(profileId) && counts.lessonsCount + counts.exercisesCount > 0) {
      const summaries = await getCourseMemberProgressSummaries(task.courseId, [
        { profileId, roleId: ROLE.STUDENT, createdAt: null }
      ]);
      courseProgress = summaries.get(profileId)?.progressPercent ?? null;
    }
    if (task.exerciseId) {
      examMaxScore = task.examMaxScore ?? null;
      examPassThreshold = task.examPassThreshold ?? null;
      const configuration = await getMentorshipExamConfiguration(
        organizationId,
        task.courseId,
        task.exerciseId,
        client
      );
      const currentBaseline = configuration ? mentorshipExamBaseline(configuration) : null;
      examConfigurationUnchanged =
        currentBaseline !== null &&
        task.examScoringFingerprint !== null &&
        currentBaseline.examScoringFingerprint === task.examScoringFingerprint;
      const source = await getMentorshipEvidenceSource(organizationId, task.courseId, task.exerciseId, client);
      if (examConfigurationUnchanged && source.course?.groupId && source.exercise) {
        const submissions = await listCompletedAssessmentSubmissions(profileId, task.exerciseId, [
          source.course.groupId
        ]);
        const best = submissions.find(
          (submission) => submission.createdAt !== null && Date.parse(submission.createdAt) > Date.parse(task.createdAt)
        );
        examScore = best?.total === null || best === undefined ? null : Number(best.total);
        examSubmissionId = best?.id ?? null;
      }
    }
  }
  const courseComplete = !task.courseId || courseProgress === 100;
  const examPassed =
    !task.exerciseId ||
    (examScore !== null &&
      examMaxScore !== null &&
      examMaxScore > 0 &&
      examPassThreshold !== null &&
      (examScore * 100) / examMaxScore >= examPassThreshold);
  return {
    courseProgress,
    examScore,
    examMaxScore,
    examPassThreshold,
    examSubmissionId,
    examConfigurationUnchanged,
    courseComplete,
    examPassed
  };
}

async function readHandovers(organizationId: string, relationId: string, client: DbOrTxClient) {
  const relationIds = new Set([relationId]);
  let handovers = await listMentorshipHandovers(organizationId, [...relationIds], client);
  while (
    handovers.some((handover) => !relationIds.has(handover.oldRelationId) || !relationIds.has(handover.newRelationId))
  ) {
    for (const handover of handovers) {
      relationIds.add(handover.oldRelationId);
      relationIds.add(handover.newRelationId);
    }
    handovers = await listMentorshipHandovers(organizationId, [...relationIds], client);
  }
  return handovers;
}

export async function getMentorshipDetail(organizationId: string, profileId: string, taskId: string) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  return withMentorshipTransaction(async (transaction) => {
    const currentActor = await refreshActor(actor, transaction);
    const context = await taskContext(currentActor, taskId, transaction, true);
    const reviewerAllowed =
      context.task.requiresSupervisorReview && context.task.reviewerMemberId === currentActor.memberId
        ? await supervisorCovers(organizationId, currentActor.memberId, context.relation.learnerMemberId, transaction)
        : false;
    const evidence = await readEvidence(context, organizationId, transaction);
    const handovers = await readHandovers(organizationId, context.relation.id, transaction);
    return {
      task: context.task,
      relation: context.relation,
      history: context.history,
      handovers,
      evidence,
      permissions: {
        submit: context.learnerSelf && context.effectiveRelation,
        review: context.isMentor,
        supervisorReview: reviewerAllowed,
        certify: context.effectiveRelation && (context.task.certifier === 'MENTOR' ? context.isMentor : reviewerAllowed)
      }
    };
  });
}

async function mutateTask(
  organizationId: string,
  profileId: string,
  taskId: string,
  callback: (
    actor: TrainingActor,
    context: Awaited<ReturnType<typeof taskContext>>,
    transaction: DbOrTxClient
  ) => Promise<unknown>
) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  return withMentorshipTransaction(async (transaction) => {
    const currentActor = await refreshActor(actor, transaction);
    const context = await taskContext(currentActor, taskId, transaction, true);
    if (!context.effectiveRelation) fail('Active mentorship relationship required', 403);

    await callback(currentActor, context, transaction);
    return getMentorshipTask(organizationId, taskId, transaction);
  });
}

export function submitMentorshipTask(
  organizationId: string,
  profileId: string,
  taskId: string,
  values: TMentorshipSubmission
) {
  return mutateTask(organizationId, profileId, taskId, async (actor, context, transaction) => {
    if (!context.learnerSelf) fail('Only the learner can submit this task', 403);
    if (
      values.expectedRevision !== context.task.revision ||
      !['LEARNER_PENDING', 'RETURNED'].includes(context.task.state)
    )
      fail('Task changed; reload before submitting', 409);
    if (context.task.submissionType === 'TEXT' && !values.content.trim()) fail('Practical submission text is required');

    const round = (context.history.submissions[0]?.round ?? 0) + 1;
    await createMentorshipSubmission(
      { organizationId, taskId, round, content: values.content, confirmed: true, submittedByMemberId: actor.memberId },
      transaction
    );
    await updateMentorshipTaskState(taskId, 'MENTOR_PENDING', transaction);
    await audit(actor, taskId, 'SUBMIT', context.relation.learnerMemberId, null, transaction);
  });
}

export function reviewMentorshipTask(
  organizationId: string,
  profileId: string,
  taskId: string,
  values: TMentorshipReview
) {
  return mutateTask(organizationId, profileId, taskId, async (actor, context, transaction) => {
    if (!context.isMentor) fail('Only the current mentor can review this task', 403);
    if (
      context.task.state !== 'MENTOR_PENDING' ||
      !isCurrentMentorshipSubmission(
        values.expectedRevision,
        context.task.revision,
        values.submissionId,
        context.history.submissions[0]?.id
      )
    )
      fail('Submission changed; reload before reviewing', 409);
    if (values.score !== null && values.score > context.task.maxScore) fail('Score exceeds task maximum');
    if (values.decision === 'PASS' && (values.score === null || values.score < context.task.passScore))
      fail('Passing review requires a passing score');

    await createMentorshipReview(
      {
        submissionId: values.submissionId,
        mentorMemberId: actor.memberId,
        decision: values.decision,
        score: values.score,
        content: values.content,
        observedAt: values.observedAt
      },
      transaction
    );
    const state =
      values.decision === 'RETURN'
        ? 'RETURNED'
        : context.task.requiresSupervisorReview
          ? 'SUPERVISOR_PENDING'
          : 'READY_TO_CERTIFY';
    await updateMentorshipTaskState(taskId, state, transaction);
    await audit(actor, taskId, 'MENTOR_REVIEW', context.relation.learnerMemberId, values.content, transaction);
  });
}

export function supervisorReviewMentorshipTask(
  organizationId: string,
  profileId: string,
  taskId: string,
  values: TMentorshipSupervisorReview
) {
  return mutateTask(organizationId, profileId, taskId, async (actor, context, transaction) => {
    const learnerInScope = await supervisorCovers(
      organizationId,
      actor.memberId,
      context.relation.learnerMemberId,
      transaction
    );
    const allowed = canMentorshipSupervisorReview({
      actorMemberId: actor.memberId,
      reviewerMemberId: context.task.reviewerMemberId,
      requiresSupervisorReview: context.task.requiresSupervisorReview,
      isSupervisor: actor.roles.includes('DEPARTMENT_MANAGER'),
      learnerInScope
    });
    if (!allowed) fail('Configured supervisor with current learner scope required', 403);

    const review = context.history.reviews.find((review) => review.submissionId === values.submissionId);
    if (
      context.task.state !== 'SUPERVISOR_PENDING' ||
      !isCurrentMentorshipSubmission(
        values.expectedRevision,
        context.task.revision,
        values.submissionId,
        context.history.submissions[0]?.id
      ) ||
      review?.id !== values.reviewId ||
      review.decision !== 'PASS'
    )
      fail('Review changed; reload before supervisor review', 409);

    await createMentorshipSupervisorReview(
      {
        reviewId: values.reviewId,
        reviewerMemberId: actor.memberId,
        decision: values.decision,
        content: values.content
      },
      transaction
    );
    await updateMentorshipTaskState(taskId, values.decision === 'PASS' ? 'READY_TO_CERTIFY' : 'RETURNED', transaction);
    await audit(actor, taskId, 'SUPERVISOR_REVIEW', context.relation.learnerMemberId, values.content, transaction);
  });
}

export function certifyMentorshipTask(
  organizationId: string,
  profileId: string,
  taskId: string,
  values: TMentorshipCertification
) {
  return mutateTask(organizationId, profileId, taskId, async (actor, context, transaction) => {
    const allowed =
      context.task.certifier === 'MENTOR'
        ? context.isMentor
        : context.task.reviewerMemberId === actor.memberId &&
          (await supervisorCovers(organizationId, actor.memberId, context.relation.learnerMemberId, transaction));
    if (!allowed) fail('Configured certification owner required', 403);
    if (
      !isCurrentMentorshipSubmission(
        values.expectedRevision,
        context.task.revision,
        values.submissionId,
        context.history.submissions[0]?.id
      )
    )
      fail('Submission changed; reload before certifying', 409);

    const review = context.history.reviews.find((review) => review.submissionId === values.submissionId);
    if (!review || review.id !== values.reviewId) fail('Review changed; reload before certifying', 409);

    const supervisor = context.history.supervisorReviews.find((supervisor) => supervisor.reviewId === review.id);
    const evidence = await readEvidence(context, organizationId, transaction);
    const satisfied = satisfiesMentorshipCertification({
      state: context.task.state,
      reviewPassed: review.decision === 'PASS',
      score: review.score,
      passScore: context.task.passScore,
      requiresSupervisorReview: context.task.requiresSupervisorReview,
      supervisorPassed: supervisor?.decision === 'PASS',
      courseComplete: evidence.courseComplete,
      examPassed: evidence.examPassed
    });
    if (!satisfied) fail('Learning, exam and configured review conditions must be satisfied before certification');

    await createMentorshipCertification(
      {
        taskId,
        submissionId: values.submissionId,
        reviewId: review.id,
        supervisorReviewId: supervisor?.id ?? null,
        certifierMemberId: actor.memberId,
        content: values.content
      },
      transaction
    );
    await updateMentorshipTaskState(taskId, 'CERTIFIED', transaction);
    await audit(actor, taskId, 'CERTIFY', context.relation.learnerMemberId, values.content, transaction);
  });
}

export async function exportMentorships(organizationId: string, profileId: string, filter: TMentorshipFilter) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  return withMentorshipTransaction(async (transaction) => {
    const currentActor = await refreshActor(actor, transaction);
    const scope = await readScope(currentActor, transaction);
    const rows = await listMentorshipTasks(organizationId, scope, currentActor.memberId, filter, transaction);
    const exportedAt = new Date().toISOString();
    const values: unknown[][] = [
      [
        'task_id',
        'title',
        'learner_member_id',
        'learner',
        'employee_no',
        'mentor_member_id',
        'mentor',
        'plan_id',
        'state',
        'due_at',
        'overdue',
        'supervisor_review',
        'reviewer_member_id',
        'certifier',
        'revision',
        'course_id',
        'exam_id',
        'maximum_score',
        'passing_score',
        'exported_at',
        'record_kind',
        'round',
        'submission_id',
        'review_id',
        'score',
        'decision',
        'content',
        'observed_at',
        'occurred_at',
        'actor_member_id',
        'actor_profile_id',
        'old_relation_id',
        'new_relation_id'
      ]
    ];
    for (const row of rows) {
      const context = await taskContext(currentActor, row.task.id, transaction, true);
      const task = context.task;
      const relation = context.relation;
      const overdue = task.state !== 'CERTIFIED' && Date.parse(task.dueAt) < Date.now();
      const base = [
        task.id,
        task.title,
        relation.learnerMemberId,
        row.learnerName ?? '',
        row.learnerEmployeeNo ?? '',
        relation.mentorMemberId,
        row.mentorName ?? '',
        relation.planId ?? '',
        task.state,
        task.dueAt,
        overdue,
        task.requiresSupervisorReview,
        task.reviewerMemberId ?? '',
        task.certifier,
        task.revision,
        task.courseId ?? '',
        task.exerciseId ?? '',
        task.maxScore,
        task.passScore,
        exportedAt
      ];
      values.push([...base, 'TASK', '', '', '', '', '', task.objective, '', task.createdAt, '']);
      values.push([...base, 'SCORING_CRITERIA', '', '', '', '', '', task.scoringCriteria, '', task.createdAt, '']);
      for (const submission of context.history.submissions) {
        values.push([
          ...base,
          'SUBMISSION',
          submission.round,
          submission.id,
          '',
          '',
          '',
          submission.content,
          '',
          submission.submittedAt,
          submission.submittedByMemberId
        ]);
        for (const review of context.history.reviews.filter((review) => review.submissionId === submission.id)) {
          values.push([
            ...base,
            'MENTOR_REVIEW',
            submission.round,
            submission.id,
            review.id,
            review.score,
            review.decision,
            review.content,
            review.observedAt,
            review.createdAt,
            review.mentorMemberId
          ]);
          for (const supervisor of context.history.supervisorReviews.filter(
            (supervisor) => supervisor.reviewId === review.id
          )) {
            values.push([
              ...base,
              'SUPERVISOR_REVIEW',
              submission.round,
              submission.id,
              review.id,
              '',
              supervisor.decision,
              supervisor.content,
              '',
              supervisor.createdAt,
              supervisor.reviewerMemberId
            ]);
          }
        }
        for (const certification of context.history.certifications.filter(
          (certification) => certification.submissionId === submission.id
        )) {
          values.push([
            ...base,
            'CERTIFICATION',
            submission.round,
            submission.id,
            certification.reviewId,
            '',
            'CERTIFIED',
            certification.content,
            '',
            certification.createdAt,
            certification.certifierMemberId
          ]);
        }
      }
      const handovers = await readHandovers(organizationId, relation.id, transaction);
      for (const handover of handovers) {
        values.push([
          ...base,
          'HANDOVER',
          '',
          '',
          '',
          '',
          '',
          handover.reason,
          '',
          handover.createdAt,
          '',
          handover.actorProfileId,
          handover.oldRelationId,
          handover.newRelationId
        ]);
      }
    }
    await audit(currentActor, 'export', 'EXPORT', null, JSON.stringify(filter), transaction);
    const escapeCell = (value: unknown) => {
      const cell = String(value ?? '');
      const safeCell = /^\s*[=+@\-]|^[\t\r]/.test(cell) ? `'${cell}` : cell;
      return `"${safeCell.replaceAll('"', '""')}"`;
    };
    const columnCount = values[0].length;
    return `\uFEFF${values.map((row) => Array.from({ length: columnCount }, (_, columnIndex) => escapeCell(row[columnIndex])).join(',')).join('\r\n')}`;
  });
}
