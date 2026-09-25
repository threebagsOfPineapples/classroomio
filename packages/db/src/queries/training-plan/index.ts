import { db, type DbOrTxClient } from '@db/drizzle';
import {
  assessmentScore,
  assessmentItem,
  assessmentScheme,
  course,
  group,
  groupmember,
  exercise,
  lesson,
  learningActivityMinute,
  organizationmember,
  submission,
  trainingEnrollment,
  trainingEvaluation,
  trainingPlan,
  trainingPlanCourse,
  trainingPlanTarget
} from '@db/schema';
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, notExists, or, sql } from 'drizzle-orm';

export function withTrainingPlanTransaction<T>(callback: (transaction: DbOrTxClient) => Promise<T>) {
  return db.transaction(callback);
}

export function listTrainingPlans(organizationId: string) {
  return db
    .select()
    .from(trainingPlan)
    .where(eq(trainingPlan.organizationId, organizationId))
    .orderBy(asc(trainingPlan.startAt), asc(trainingPlan.name));
}

export async function getTrainingPlan(organizationId: string, planId: string, client: DbOrTxClient = db) {
  const [plan] = await client
    .select()
    .from(trainingPlan)
    .where(and(eq(trainingPlan.organizationId, organizationId), eq(trainingPlan.id, planId)))
    .limit(1);

  return plan ?? null;
}

export async function lockTrainingPlan(organizationId: string, planId: string, client: DbOrTxClient) {
  const [plan] = await client
    .select()
    .from(trainingPlan)
    .where(and(eq(trainingPlan.organizationId, organizationId), eq(trainingPlan.id, planId)))
    .for('update')
    .limit(1);

  return plan ?? null;
}

export async function getTrainingPlanDetail(organizationId: string, planId: string) {
  const plan = await getTrainingPlan(organizationId, planId);
  if (!plan) return null;

  const [courses, targets, enrollments] = await Promise.all([
    db
      .select({
        id: trainingPlanCourse.id,
        courseId: trainingPlanCourse.courseId,
        title: course.title,
        sort: trainingPlanCourse.sort
      })
      .from(trainingPlanCourse)
      .innerJoin(course, eq(trainingPlanCourse.courseId, course.id))
      .where(eq(trainingPlanCourse.planId, planId))
      .orderBy(asc(trainingPlanCourse.sort)),
    db.select().from(trainingPlanTarget).where(eq(trainingPlanTarget.planId, planId)),
    db
      .select({ memberId: trainingEnrollment.memberId })
      .from(trainingEnrollment)
      .where(eq(trainingEnrollment.planId, planId))
  ]);

  return {
    plan,
    courses,
    targets,
    enrollmentCount: enrollments.length,
    enrolledMemberIds: enrollments.map((item) => item.memberId)
  };
}

export function createTrainingPlan(values: typeof trainingPlan.$inferInsert, client: DbOrTxClient) {
  return client.insert(trainingPlan).values(values).returning();
}

export function updateTrainingPlanDraft(
  organizationId: string,
  planId: string,
  values: Partial<typeof trainingPlan.$inferInsert>,
  client: DbOrTxClient
) {
  return client
    .update(trainingPlan)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(trainingPlan.organizationId, organizationId),
        eq(trainingPlan.id, planId),
        eq(trainingPlan.status, 'DRAFT')
      )
    )
    .returning();
}

export async function replaceTrainingPlanItems(
  planId: string,
  courseIds: string[],
  targets: Array<typeof trainingPlanTarget.$inferInsert>,
  client: DbOrTxClient
) {
  await client.delete(trainingPlanCourse).where(eq(trainingPlanCourse.planId, planId));
  await client.delete(trainingPlanTarget).where(eq(trainingPlanTarget.planId, planId));
  await client.insert(trainingPlanCourse).values(courseIds.map((courseId, sort) => ({ planId, courseId, sort })));
  await client.insert(trainingPlanTarget).values(targets);
}

export function getPlanItems(planId: string, client: DbOrTxClient = db) {
  return Promise.all([
    client.select().from(trainingPlanCourse).where(eq(trainingPlanCourse.planId, planId)),
    client.select().from(trainingPlanTarget).where(eq(trainingPlanTarget.planId, planId))
  ]);
}

export function getEligibleTrainingMembers(organizationId: string, client: DbOrTxClient = db) {
  return client
    .select({
      id: organizationmember.id,
      profileId: organizationmember.profileId,
      email: organizationmember.email,
      departmentId: organizationmember.departmentId,
      position: organizationmember.position
    })
    .from(organizationmember)
    .where(
      and(
        eq(organizationmember.organizationId, organizationId),
        eq(organizationmember.status, 'ACTIVE'),
        or(isNull(organizationmember.employmentStatus), ne(organizationmember.employmentStatus, 'TERMINATED'))
      )
    );
}

export function getOrgTrainingCourses(organizationId: string, courseIds: string[], client: DbOrTxClient = db) {
  if (courseIds.length === 0) return Promise.resolve([]);

  return client
    .select({ id: course.id, groupId: group.id })
    .from(course)
    .innerJoin(group, eq(course.groupId, group.id))
    .where(
      and(
        eq(group.organizationId, organizationId),
        inArray(course.id, courseIds),
        eq(course.status, 'ACTIVE'),
        eq(course.isPublished, true)
      )
    );
}

export function listAvailableTrainingCourses(organizationId: string) {
  return db
    .select({ id: course.id, title: course.title })
    .from(course)
    .innerJoin(group, eq(course.groupId, group.id))
    .where(and(eq(group.organizationId, organizationId), eq(course.status, 'ACTIVE'), eq(course.isPublished, true)))
    .orderBy(asc(course.title));
}

export function listAssignedTrainingCoursesForProfile(organizationId: string, profileId: string, client: DbOrTxClient) {
  return client
    .selectDistinct({ courseId: course.id, groupId: group.id })
    .from(trainingEnrollment)
    .innerJoin(organizationmember, eq(trainingEnrollment.memberId, organizationmember.id))
    .innerJoin(trainingPlanCourse, eq(trainingEnrollment.planId, trainingPlanCourse.planId))
    .innerJoin(course, eq(trainingPlanCourse.courseId, course.id))
    .innerJoin(group, eq(course.groupId, group.id))
    .where(
      and(
        eq(trainingEnrollment.organizationId, organizationId),
        eq(organizationmember.organizationId, organizationId),
        eq(organizationmember.profileId, profileId),
        eq(group.organizationId, organizationId)
      )
    );
}

export function listMyTrainingAssignments(organizationId: string, profileId: string) {
  return db
    .select({
      enrollmentId: trainingEnrollment.id,
      planId: trainingPlan.id,
      planName: trainingPlan.name,
      planCode: trainingPlan.code,
      planDescription: trainingPlan.description,
      planType: trainingPlan.planType,
      planStatus: trainingPlan.status,
      startAt: trainingPlan.startAt,
      endAt: trainingPlan.endAt,
      enrollmentStatus: trainingEnrollment.status,
      result: trainingEnrollment.result,
      finalScore: trainingEnrollment.finalScore,
      scoreCalculatedAt: assessmentScore.calculatedAt,
      progressPercent: trainingEnrollment.progressPercent,
      evaluatedAt: trainingEvaluation.createdAt,
      assignedAt: trainingEnrollment.assignedAt,
      courseId: course.id,
      courseTitle: course.title,
      courseSort: trainingPlanCourse.sort,
      courseRequired: trainingPlanCourse.required,
      courseDueAt: trainingPlanCourse.dueAt
    })
    .from(trainingEnrollment)
    .innerJoin(organizationmember, eq(trainingEnrollment.memberId, organizationmember.id))
    .innerJoin(trainingPlan, eq(trainingEnrollment.planId, trainingPlan.id))
    .innerJoin(trainingPlanCourse, eq(trainingPlan.id, trainingPlanCourse.planId))
    .innerJoin(course, eq(trainingPlanCourse.courseId, course.id))
    .leftJoin(assessmentScore, eq(assessmentScore.enrollmentId, trainingEnrollment.id))
    .leftJoin(trainingEvaluation, eq(trainingEvaluation.enrollmentId, trainingEnrollment.id))
    .where(
      and(
        eq(trainingEnrollment.organizationId, organizationId),
        eq(organizationmember.organizationId, organizationId),
        eq(organizationmember.profileId, profileId),
        eq(organizationmember.status, 'ACTIVE'),
        or(isNull(organizationmember.employmentStatus), ne(organizationmember.employmentStatus, 'TERMINATED')),
        eq(trainingPlan.organizationId, organizationId)
      )
    )
    .orderBy(desc(trainingEnrollment.assignedAt), asc(trainingPlanCourse.sort));
}

export function listMyTrainingExams(organizationId: string, profileId: string) {
  const submitted = db
    .select({ id: submission.id })
    .from(submission)
    .innerJoin(groupmember, eq(submission.submittedBy, groupmember.id))
    .where(and(eq(submission.exerciseId, exercise.id), eq(groupmember.profileId, profileId)));

  return db
    .select({
      enrollmentId: trainingEnrollment.id,
      exerciseId: exercise.id,
      courseId: trainingPlanCourse.courseId,
      title: exercise.title,
      opensAt: exercise.opensAt,
      closesAt: exercise.closesAt
    })
    .from(trainingEnrollment)
    .innerJoin(organizationmember, eq(trainingEnrollment.memberId, organizationmember.id))
    .innerJoin(trainingPlan, eq(trainingEnrollment.planId, trainingPlan.id))
    .innerJoin(
      assessmentScheme,
      and(eq(assessmentScheme.planId, trainingPlan.id), eq(assessmentScheme.status, 'PUBLISHED'))
    )
    .innerJoin(assessmentItem, and(eq(assessmentItem.schemeId, assessmentScheme.id), eq(assessmentItem.type, 'EXAM')))
    .innerJoin(exercise, eq(assessmentItem.exerciseId, exercise.id))
    .leftJoin(lesson, eq(exercise.lessonId, lesson.id))
    .innerJoin(
      trainingPlanCourse,
      and(
        eq(trainingPlanCourse.planId, trainingPlan.id),
        or(eq(exercise.courseId, trainingPlanCourse.courseId), eq(lesson.courseId, trainingPlanCourse.courseId))
      )
    )
    .where(
      and(
        eq(trainingEnrollment.organizationId, organizationId),
        eq(organizationmember.organizationId, organizationId),
        eq(organizationmember.profileId, profileId),
        eq(organizationmember.status, 'ACTIVE'),
        or(isNull(organizationmember.employmentStatus), ne(organizationmember.employmentStatus, 'TERMINATED')),
        eq(trainingPlan.organizationId, organizationId),
        eq(trainingPlan.status, 'PUBLISHED'),
        ne(trainingEnrollment.status, 'COMPLETED'),
        ne(trainingEnrollment.status, 'CANCELLED'),
        ne(trainingEnrollment.status, 'EXPIRED'),
        eq(exercise.isExam, true),
        isNotNull(exercise.opensAt),
        isNotNull(exercise.closesAt),
        notExists(submitted)
      )
    );
}

export function recordLearningMinute(organizationId: string, profileId: string, courseId: string) {
  return db
    .insert(learningActivityMinute)
    .values({
      organizationId,
      profileId,
      courseId,
      minuteAt: sql`date_trunc('minute', now())`
    })
    .onConflictDoNothing();
}

export async function countLearningMinutesForMembers(
  organizationId: string,
  memberIds: number[],
  courseIds?: string[],
  from?: string,
  to?: string
) {
  if (memberIds.length === 0 || courseIds?.length === 0) return 0;

  const conditions = [
    eq(learningActivityMinute.organizationId, organizationId),
    inArray(organizationmember.id, memberIds)
  ];
  if (courseIds) conditions.push(inArray(learningActivityMinute.courseId, courseIds));
  if (from) conditions.push(gte(learningActivityMinute.minuteAt, from));
  if (to) conditions.push(lt(learningActivityMinute.minuteAt, to));

  const [result] = await db
    .select({ minutes: count() })
    .from(learningActivityMinute)
    .innerJoin(
      organizationmember,
      and(
        eq(organizationmember.organizationId, learningActivityMinute.organizationId),
        eq(organizationmember.profileId, learningActivityMinute.profileId)
      )
    )
    .where(and(...conditions));

  return result?.minutes ?? 0;
}

export function insertTrainingEnrollments(values: Array<typeof trainingEnrollment.$inferInsert>, client: DbOrTxClient) {
  return client.insert(trainingEnrollment).values(values).onConflictDoNothing().returning();
}

export function publishTrainingPlanRecord(
  organizationId: string,
  planId: string,
  profileId: string,
  client: DbOrTxClient
) {
  return client
    .update(trainingPlan)
    .set({
      status: 'PUBLISHED',
      publishedAt: new Date().toISOString(),
      publishedByProfileId: profileId,
      updatedAt: new Date().toISOString()
    })
    .where(
      and(
        eq(trainingPlan.organizationId, organizationId),
        eq(trainingPlan.id, planId),
        eq(trainingPlan.status, 'DRAFT')
      )
    )
    .returning();
}
