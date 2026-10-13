import { db, type DbOrTxClient } from '@db/drizzle';
import {
  mentorshipCertification,
  mentorshipHandover,
  mentorshipRelation,
  mentorshipReview,
  mentorshipSubmission,
  mentorshipSupervisorReview,
  mentorshipTask
} from '../../schema-mentorship';
import {
  course,
  exercise,
  group,
  organizationmember,
  organizationMemberEnterpriseRole,
  option,
  profile,
  question,
  trainingPlan
} from '@db/schema';
import { alias } from 'drizzle-orm/pg-core';
import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { TMentorshipFilter } from '@cio/utils/validation/mentorship';
import { getTrainingHeadquartersMemberIds } from '../enterprise/access';

const learnerMember = alias(organizationmember, 'mentorship_learner');
const mentorMember = alias(organizationmember, 'mentorship_mentor');
const learnerProfile = alias(profile, 'mentorship_learner_profile');
const mentorProfile = alias(profile, 'mentorship_mentor_profile');

export function withMentorshipTransaction<T>(callback: (transaction: DbOrTxClient) => Promise<T>) {
  return db.transaction(callback);
}

export async function getMentorshipMember(
  organizationId: string,
  memberId: number,
  client: DbOrTxClient,
  lock = false
) {
  const query = client
    .select()
    .from(organizationmember)
    .where(and(eq(organizationmember.organizationId, organizationId), eq(organizationmember.id, memberId)))
    .limit(1);
  const [member] = await (lock ? query.for('update') : query);
  return member ?? null;
}

export async function getMentorshipMemberRoles(organizationId: string, memberId: number, client: DbOrTxClient) {
  return client
    .select({ role: organizationMemberEnterpriseRole.role })
    .from(organizationMemberEnterpriseRole)
    .where(
      and(
        eq(organizationMemberEnterpriseRole.organizationId, organizationId),
        eq(organizationMemberEnterpriseRole.memberId, memberId)
      )
    );
}

export async function listMentorshipMembers(organizationId: string, client: DbOrTxClient = db) {
  const headquartersMemberIds = await getTrainingHeadquartersMemberIds(organizationId, client);
  return client
    .select({
      id: organizationmember.id,
      fullname: profile.fullname,
      email: organizationmember.email,
      employeeNo: organizationmember.employeeNo,
      mentorQualified: sql<boolean>`exists (select 1 from ${organizationMemberEnterpriseRole} where ${organizationMemberEnterpriseRole.organizationId} = ${organizationmember.organizationId} and ${organizationMemberEnterpriseRole.memberId} = ${organizationmember.id} and ${organizationMemberEnterpriseRole.role} = 'MENTOR')`,
      supervisorQualified: sql<boolean>`exists (select 1 from ${organizationMemberEnterpriseRole} where ${organizationMemberEnterpriseRole.organizationId} = ${organizationmember.organizationId} and ${organizationMemberEnterpriseRole.memberId} = ${organizationmember.id} and ${organizationMemberEnterpriseRole.role} = 'DEPARTMENT_MANAGER')`
    })
    .from(organizationmember)
    .leftJoin(profile, eq(profile.id, organizationmember.profileId))
    .where(
      and(
        eq(organizationmember.organizationId, organizationId),
        eq(organizationmember.status, 'ACTIVE'),
        sql`${organizationmember.employmentStatus} IS DISTINCT FROM 'TERMINATED'`,
        headquartersMemberIds === null
          ? undefined
          : headquartersMemberIds.length
            ? inArray(organizationmember.id, headquartersMemberIds)
            : sql`false`
      )
    )
    .orderBy(asc(organizationmember.id));
}

export async function listMentorshipResources(organizationId: string, client: DbOrTxClient = db) {
  const plans = await client
    .select({ id: trainingPlan.id, name: trainingPlan.name })
    .from(trainingPlan)
    .where(eq(trainingPlan.organizationId, organizationId));
  const courses = await client
    .select({ id: course.id, title: course.title })
    .from(course)
    .innerJoin(group, eq(course.groupId, group.id))
    .where(eq(group.organizationId, organizationId));
  const exercises = await client
    .select({
      id: exercise.id,
      title: exercise.title,
      courseId: exercise.courseId,
      passThreshold: exercise.passThreshold
    })
    .from(exercise)
    .innerJoin(course, eq(exercise.courseId, course.id))
    .innerJoin(group, eq(course.groupId, group.id))
    .where(and(eq(group.organizationId, organizationId), eq(exercise.isExam, true)));
  return { plans, courses, exercises };
}

export async function validateMentorshipResources(
  organizationId: string,
  planId: string | null,
  courseId: string | null,
  exerciseId: string | null,
  client: DbOrTxClient
) {
  if (planId) {
    const [plan] = await client
      .select({ id: trainingPlan.id })
      .from(trainingPlan)
      .where(and(eq(trainingPlan.id, planId), eq(trainingPlan.organizationId, organizationId)))
      .limit(1);
    if (!plan) return false;
  }
  if (courseId) {
    const [row] = await client
      .select({ id: course.id })
      .from(course)
      .innerJoin(group, eq(course.groupId, group.id))
      .where(and(eq(course.id, courseId), eq(group.organizationId, organizationId)))
      .limit(1);
    if (!row) return false;
  }
  if (exerciseId) {
    const [row] = await client
      .select({ id: exercise.id })
      .from(exercise)
      .where(and(eq(exercise.id, exerciseId), eq(exercise.courseId, courseId!), eq(exercise.isExam, true)))
      .limit(1);
    if (!row) return false;
  }
  return true;
}

export async function getMentorshipExamConfiguration(
  organizationId: string,
  courseId: string,
  exerciseId: string,
  client: DbOrTxClient
) {
  const source = await getMentorshipEvidenceSource(organizationId, courseId, exerciseId, client);
  if (!source.course || !source.exercise) return null;

  const [exam] = await client.select().from(exercise).where(eq(exercise.id, exerciseId)).for('share').limit(1);
  if (!exam) return null;

  const questions = await client
    .select()
    .from(question)
    .where(eq(question.exerciseId, exerciseId))
    .orderBy(asc(question.id))
    .for('share');
  const questionIds = questions.map((item) => item.id);
  const options = questionIds.length
    ? await client
        .select()
        .from(option)
        .where(inArray(option.questionId, questionIds))
        .orderBy(asc(option.id))
        .for('share')
    : [];
  return { exercise: exam, questions, options };
}

export async function getMentorshipRelation(
  organizationId: string,
  relationId: string,
  client: DbOrTxClient = db,
  lock = false
) {
  const query = client
    .select()
    .from(mentorshipRelation)
    .where(and(eq(mentorshipRelation.organizationId, organizationId), eq(mentorshipRelation.id, relationId)))
    .limit(1);
  const [relation] = await (lock ? query.for('update') : query);
  return relation ?? null;
}

export async function getCurrentMentorshipRelation(
  organizationId: string,
  learnerMemberId: number,
  planId: string | null,
  client: DbOrTxClient
) {
  const [relation] = await client
    .select()
    .from(mentorshipRelation)
    .where(
      and(
        eq(mentorshipRelation.organizationId, organizationId),
        eq(mentorshipRelation.learnerMemberId, learnerMemberId),
        eq(mentorshipRelation.status, 'ACTIVE'),
        planId ? eq(mentorshipRelation.planId, planId) : isNull(mentorshipRelation.planId)
      )
    )
    .for('update')
    .limit(1);
  return relation ?? null;
}

export async function createMentorshipRelation(values: typeof mentorshipRelation.$inferInsert, client: DbOrTxClient) {
  const [relation] = await client.insert(mentorshipRelation).values(values).returning();
  return relation;
}

export async function handoverMentorshipRelation(
  oldRelation: typeof mentorshipRelation.$inferSelect,
  newRelation: typeof mentorshipRelation.$inferSelect,
  reason: string,
  actorProfileId: string,
  client: DbOrTxClient
) {
  await client.update(mentorshipRelation).set({ status: 'ENDED' }).where(eq(mentorshipRelation.id, oldRelation.id));
  await client.insert(mentorshipHandover).values({
    organizationId: oldRelation.organizationId,
    oldRelationId: oldRelation.id,
    newRelationId: newRelation.id,
    reason,
    actorProfileId
  });
  await client
    .update(mentorshipTask)
    .set({
      relationId: newRelation.id,
      revision: sql`${mentorshipTask.revision} + 1`,
      updatedAt: new Date().toISOString()
    })
    .where(eq(mentorshipTask.relationId, oldRelation.id));
}

export async function endMentorshipRelation(relationId: string, client: DbOrTxClient) {
  await client.update(mentorshipRelation).set({ status: 'ENDED' }).where(eq(mentorshipRelation.id, relationId));
}

function relationVisibility(
  memberIds: number[] | null,
  mentorMemberId: number,
  headquartersMemberIds: number[] | null
) {
  if (memberIds === null) return undefined;

  const learnerVisibility = memberIds.length ? inArray(mentorshipRelation.learnerMemberId, memberIds) : sql`false`;
  const mentorVisibility = and(
    eq(mentorshipRelation.mentorMemberId, mentorMemberId),
    sql`exists (select 1 from ${organizationMemberEnterpriseRole} where ${organizationMemberEnterpriseRole.organizationId} = ${mentorshipRelation.organizationId} and ${organizationMemberEnterpriseRole.memberId} = ${mentorshipRelation.mentorMemberId} and ${organizationMemberEnterpriseRole.role} = 'MENTOR')`,
    headquartersMemberIds === null
      ? undefined
      : headquartersMemberIds.length
        ? inArray(mentorshipRelation.mentorMemberId, headquartersMemberIds)
        : sql`false`,
    eq(mentorshipRelation.status, 'ACTIVE'),
    lte(mentorshipRelation.startsAt, sql`now()`),
    sql`${mentorshipRelation.endsAt} > now()`,
    eq(mentorMember.status, 'ACTIVE'),
    sql`${mentorMember.employmentStatus} IS DISTINCT FROM 'TERMINATED'`,
    eq(learnerMember.status, 'ACTIVE'),
    sql`${learnerMember.employmentStatus} IS DISTINCT FROM 'TERMINATED'`
  );
  return or(learnerVisibility, mentorVisibility);
}

function relationListQuery(client: DbOrTxClient = db) {
  return client
    .select({
      relation: mentorshipRelation,
      learnerName: learnerProfile.fullname,
      mentorName: mentorProfile.fullname,
      learnerProfileId: learnerMember.profileId,
      learnerEmployeeNo: learnerMember.employeeNo,
      mentorActive: mentorMember.status,
      mentorEmploymentStatus: mentorMember.employmentStatus
    })
    .from(mentorshipRelation)
    .innerJoin(learnerMember, eq(learnerMember.id, mentorshipRelation.learnerMemberId))
    .innerJoin(mentorMember, eq(mentorMember.id, mentorshipRelation.mentorMemberId))
    .leftJoin(learnerProfile, eq(learnerProfile.id, learnerMember.profileId))
    .leftJoin(mentorProfile, eq(mentorProfile.id, mentorMember.profileId));
}

export async function listMentorshipRelations(
  organizationId: string,
  memberIds: number[] | null,
  actorMemberId: number,
  client: DbOrTxClient = db
) {
  const headquartersMemberIds = await getTrainingHeadquartersMemberIds(organizationId, client);
  return relationListQuery(client)
    .where(
      and(
        eq(mentorshipRelation.organizationId, organizationId),
        headquartersMemberIds === null
          ? undefined
          : headquartersMemberIds.length
            ? inArray(mentorshipRelation.learnerMemberId, headquartersMemberIds)
            : sql`false`,
        relationVisibility(memberIds, actorMemberId, headquartersMemberIds)
      )
    )
    .orderBy(desc(mentorshipRelation.createdAt));
}

export async function listMentorshipTasks(
  organizationId: string,
  memberIds: number[] | null,
  actorMemberId: number,
  filter: TMentorshipFilter,
  client: DbOrTxClient = db
) {
  const headquartersMemberIds = await getTrainingHeadquartersMemberIds(organizationId, client);
  return client
    .select({
      task: mentorshipTask,
      relation: mentorshipRelation,
      learnerName: learnerProfile.fullname,
      mentorName: mentorProfile.fullname,
      learnerEmployeeNo: learnerMember.employeeNo,
      mentorActive: mentorMember.status,
      mentorEmploymentStatus: mentorMember.employmentStatus
    })
    .from(mentorshipTask)
    .innerJoin(mentorshipRelation, eq(mentorshipTask.relationId, mentorshipRelation.id))
    .innerJoin(learnerMember, eq(learnerMember.id, mentorshipRelation.learnerMemberId))
    .innerJoin(mentorMember, eq(mentorMember.id, mentorshipRelation.mentorMemberId))
    .leftJoin(learnerProfile, eq(learnerProfile.id, learnerMember.profileId))
    .leftJoin(mentorProfile, eq(mentorProfile.id, mentorMember.profileId))
    .where(
      and(
        eq(mentorshipTask.organizationId, organizationId),
        headquartersMemberIds === null
          ? undefined
          : headquartersMemberIds.length
            ? inArray(mentorshipRelation.learnerMemberId, headquartersMemberIds)
            : sql`false`,
        relationVisibility(memberIds, actorMemberId, headquartersMemberIds),
        filter.state ? eq(mentorshipTask.state, filter.state) : undefined,
        filter.dueBefore ? lte(mentorshipTask.dueAt, filter.dueBefore) : undefined
      )
    )
    .orderBy(asc(mentorshipTask.dueAt), asc(mentorshipTask.id));
}

export async function getMentorshipTask(
  organizationId: string,
  taskId: string,
  client: DbOrTxClient = db,
  lock = false
) {
  const query = client
    .select()
    .from(mentorshipTask)
    .where(and(eq(mentorshipTask.organizationId, organizationId), eq(mentorshipTask.id, taskId)))
    .limit(1);
  const [task] = await (lock ? query.for('update') : query);
  return task ?? null;
}

export async function createMentorshipTask(values: typeof mentorshipTask.$inferInsert, client: DbOrTxClient) {
  const createdAt = sql`clock_timestamp()`;
  const [task] = await client
    .insert(mentorshipTask)
    .values({ ...values, createdAt })
    .returning();
  return task;
}

export async function updateMentorshipTaskState(
  taskId: string,
  state: (typeof mentorshipTask.$inferSelect)['state'],
  client: DbOrTxClient
) {
  const [task] = await client
    .update(mentorshipTask)
    .set({ state, revision: sql`${mentorshipTask.revision} + 1`, updatedAt: new Date().toISOString() })
    .where(eq(mentorshipTask.id, taskId))
    .returning();
  return task;
}

export async function getMentorshipEvidenceSource(
  organizationId: string,
  courseId: string,
  exerciseId: string | null,
  client: DbOrTxClient = db
) {
  const [courseRow] = await client
    .select({ id: course.id, groupId: course.groupId, title: course.title })
    .from(course)
    .innerJoin(group, eq(course.groupId, group.id))
    .where(and(eq(course.id, courseId), eq(group.organizationId, organizationId)))
    .limit(1);
  const [exerciseRow] = exerciseId
    ? await client
        .select({ id: exercise.id, title: exercise.title, passThreshold: exercise.passThreshold })
        .from(exercise)
        .where(and(eq(exercise.id, exerciseId), eq(exercise.courseId, courseId), eq(exercise.isExam, true)))
        .limit(1)
    : [];
  return { course: courseRow ?? null, exercise: exerciseRow ?? null };
}

export async function getMentorshipHistory(taskId: string, client: DbOrTxClient = db) {
  const submissions = await client
    .select()
    .from(mentorshipSubmission)
    .where(eq(mentorshipSubmission.taskId, taskId))
    .orderBy(desc(mentorshipSubmission.round));
  const submissionIds = submissions.map((submission) => submission.id);
  const reviews = submissionIds.length
    ? await client
        .select()
        .from(mentorshipReview)
        .where(inArray(mentorshipReview.submissionId, submissionIds))
        .orderBy(desc(mentorshipReview.createdAt))
    : [];
  const reviewIds = reviews.map((review) => review.id);
  const supervisorReviews = reviewIds.length
    ? await client
        .select()
        .from(mentorshipSupervisorReview)
        .where(inArray(mentorshipSupervisorReview.reviewId, reviewIds))
        .orderBy(desc(mentorshipSupervisorReview.createdAt))
    : [];
  const certifications = await client
    .select()
    .from(mentorshipCertification)
    .where(eq(mentorshipCertification.taskId, taskId));
  return { submissions, reviews, supervisorReviews, certifications };
}

export async function createMentorshipSubmission(
  values: typeof mentorshipSubmission.$inferInsert,
  client: DbOrTxClient
) {
  const [submission] = await client.insert(mentorshipSubmission).values(values).returning();
  return submission;
}

export async function createMentorshipReview(values: typeof mentorshipReview.$inferInsert, client: DbOrTxClient) {
  const [review] = await client.insert(mentorshipReview).values(values).returning();
  return review;
}

export async function createMentorshipSupervisorReview(
  values: typeof mentorshipSupervisorReview.$inferInsert,
  client: DbOrTxClient
) {
  const [review] = await client.insert(mentorshipSupervisorReview).values(values).returning();
  return review;
}

export async function createMentorshipCertification(
  values: typeof mentorshipCertification.$inferInsert,
  client: DbOrTxClient
) {
  const [certification] = await client.insert(mentorshipCertification).values(values).returning();
  return certification;
}

export function listMentorshipHandovers(organizationId: string, relationIds: string[], client: DbOrTxClient = db) {
  return client
    .select()
    .from(mentorshipHandover)
    .where(
      and(
        eq(mentorshipHandover.organizationId, organizationId),
        relationIds.length
          ? or(
              inArray(mentorshipHandover.oldRelationId, relationIds),
              inArray(mentorshipHandover.newRelationId, relationIds)
            )
          : sql`false`
      )
    )
    .orderBy(asc(mentorshipHandover.createdAt));
}
