import { db, type DbOrTxClient } from '@db/drizzle';
import {
  course,
  group,
  organizationmember,
  trainingEnrollment,
  trainingPlan,
  trainingPlanCourse,
  trainingPlanTarget
} from '@db/schema';
import { and, asc, count, desc, eq, inArray, isNull, ne, or } from 'drizzle-orm';

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

  const [courses, targets, enrollmentCount] = await Promise.all([
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
    db.select({ count: count() }).from(trainingEnrollment).where(eq(trainingEnrollment.planId, planId))
  ]);

  return { plan, courses, targets, enrollmentCount: enrollmentCount[0]?.count ?? 0 };
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
      planId: trainingPlan.id,
      planName: trainingPlan.name,
      planCode: trainingPlan.code,
      planDescription: trainingPlan.description,
      planType: trainingPlan.planType,
      planStatus: trainingPlan.status,
      startAt: trainingPlan.startAt,
      endAt: trainingPlan.endAt,
      enrollmentStatus: trainingEnrollment.status,
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
