import { db, type DbOrTxClient } from '@db/drizzle';
import {
  assessmentAdjustment,
  assessmentInput,
  assessmentItem,
  assessmentScheme,
  assessmentScore,
  assessmentScoreDetail,
  course,
  courseCertificateIssue,
  exercise,
  group,
  groupmember,
  lesson,
  organizationmember,
  question,
  submission,
  trainingEnrollment,
  trainingEvaluation,
  trainingPlan,
  trainingPlanCourse
} from '@db/schema';
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';

export function withAssessmentTransaction<T>(callback: (transaction: DbOrTxClient) => Promise<T>) {
  return db.transaction(callback);
}

export async function getAssessmentScheme(organizationId: string, planId: string, client: DbOrTxClient = db) {
  const [scheme] = await client
    .select({ scheme: assessmentScheme })
    .from(assessmentScheme)
    .innerJoin(trainingPlan, eq(assessmentScheme.planId, trainingPlan.id))
    .where(and(eq(trainingPlan.organizationId, organizationId), eq(trainingPlan.id, planId)))
    .limit(1);
  if (!scheme) return null;

  const items = await client
    .select()
    .from(assessmentItem)
    .where(eq(assessmentItem.schemeId, scheme.scheme.id))
    .orderBy(asc(assessmentItem.sort));
  return { ...scheme.scheme, items };
}

export function createAssessmentScheme(values: typeof assessmentScheme.$inferInsert, client: DbOrTxClient) {
  return client.insert(assessmentScheme).values(values).returning();
}

export function updateAssessmentScheme(
  schemeId: string,
  values: Partial<typeof assessmentScheme.$inferInsert>,
  client: DbOrTxClient
) {
  return client.update(assessmentScheme).set(values).where(eq(assessmentScheme.id, schemeId)).returning();
}

export async function replaceAssessmentItems(
  schemeId: string,
  values: Array<typeof assessmentItem.$inferInsert>,
  client: DbOrTxClient
) {
  await client.delete(assessmentItem).where(eq(assessmentItem.schemeId, schemeId));
  await client.insert(assessmentItem).values(values);
}

export function publishAssessmentScheme(schemeId: string, client: DbOrTxClient) {
  return client
    .update(assessmentScheme)
    .set({ status: 'PUBLISHED', publishedAt: new Date().toISOString() })
    .where(and(eq(assessmentScheme.id, schemeId), eq(assessmentScheme.status, 'DRAFT')))
    .returning();
}

export async function getAssessmentEnrollment(
  organizationId: string,
  enrollmentId: string,
  client: DbOrTxClient = db,
  lock = false
) {
  const query = client
    .select({ enrollment: trainingEnrollment, plan: trainingPlan, member: organizationmember })
    .from(trainingEnrollment)
    .innerJoin(trainingPlan, eq(trainingEnrollment.planId, trainingPlan.id))
    .innerJoin(organizationmember, eq(trainingEnrollment.memberId, organizationmember.id))
    .where(
      and(
        eq(trainingEnrollment.id, enrollmentId),
        eq(trainingEnrollment.organizationId, organizationId),
        eq(trainingPlan.organizationId, organizationId),
        eq(organizationmember.organizationId, organizationId)
      )
    )
    .limit(1);
  const [row] = lock ? await query.for('update', { of: trainingEnrollment }) : await query;
  return row ?? null;
}

export function listAssessmentEnrollments(organizationId: string, planId?: string, memberIds?: number[]) {
  return db
    .select({
      enrollment: trainingEnrollment,
      plan: trainingPlan,
      member: {
        id: organizationmember.id,
        profileId: organizationmember.profileId,
        departmentId: organizationmember.departmentId,
        email: organizationmember.email
      },
      score: assessmentScore,
      evaluation: trainingEvaluation
    })
    .from(trainingEnrollment)
    .innerJoin(trainingPlan, eq(trainingEnrollment.planId, trainingPlan.id))
    .innerJoin(organizationmember, eq(trainingEnrollment.memberId, organizationmember.id))
    .leftJoin(assessmentScore, eq(assessmentScore.enrollmentId, trainingEnrollment.id))
    .leftJoin(trainingEvaluation, eq(trainingEvaluation.enrollmentId, trainingEnrollment.id))
    .where(
      and(
        eq(trainingEnrollment.organizationId, organizationId),
        eq(trainingPlan.organizationId, organizationId),
        eq(organizationmember.organizationId, organizationId),
        planId ? eq(trainingEnrollment.planId, planId) : undefined,
        memberIds ? (memberIds.length ? inArray(trainingEnrollment.memberId, memberIds) : sql`false`) : undefined
      )
    )
    .orderBy(desc(trainingEnrollment.assignedAt));
}

export function listAssessmentPlanCourses(organizationId: string, planId: string) {
  return db
    .select({ courseId: course.id, groupId: group.id })
    .from(trainingPlanCourse)
    .innerJoin(course, eq(trainingPlanCourse.courseId, course.id))
    .innerJoin(group, eq(course.groupId, group.id))
    .where(and(eq(trainingPlanCourse.planId, planId), eq(group.organizationId, organizationId)));
}

export function listArchiveCourseEvidence(organizationId: string, planId?: string, memberIds?: number[]) {
  return db
    .select({
      enrollmentId: trainingEnrollment.id,
      courseId: course.id,
      courseTitle: course.title,
      certificateEarnedAt: groupmember.certificateEarnedAt,
      certificateIssuedAt: courseCertificateIssue.issuedAt,
      certificateExpiresAt: courseCertificateIssue.expiresAt,
      certificateStatus: courseCertificateIssue.status
    })
    .from(trainingEnrollment)
    .innerJoin(organizationmember, eq(trainingEnrollment.memberId, organizationmember.id))
    .innerJoin(trainingPlanCourse, eq(trainingEnrollment.planId, trainingPlanCourse.planId))
    .innerJoin(course, eq(trainingPlanCourse.courseId, course.id))
    .innerJoin(group, eq(course.groupId, group.id))
    .leftJoin(
      groupmember,
      and(eq(groupmember.groupId, group.id), eq(groupmember.profileId, organizationmember.profileId))
    )
    .leftJoin(
      courseCertificateIssue,
      and(
        eq(courseCertificateIssue.courseId, course.id),
        eq(courseCertificateIssue.profileId, organizationmember.profileId)
      )
    )
    .where(
      and(
        eq(trainingEnrollment.organizationId, organizationId),
        planId ? eq(trainingEnrollment.planId, planId) : undefined,
        eq(organizationmember.organizationId, organizationId),
        eq(group.organizationId, organizationId),
        memberIds ? (memberIds.length ? inArray(trainingEnrollment.memberId, memberIds) : sql`false`) : undefined
      )
    );
}

export async function getAssessmentExercise(exerciseId: string) {
  const [row] = await db
    .select({ id: exercise.id, isExam: exercise.isExam })
    .from(exercise)
    .where(eq(exercise.id, exerciseId))
    .limit(1);
  return row ?? null;
}

export function listAssessmentExercises(courseIds: string[]) {
  if (courseIds.length === 0) return Promise.resolve([]);

  return db
    .select({
      id: exercise.id,
      title: exercise.title,
      isExam: exercise.isExam,
      courseId: sql<string>`coalesce(${exercise.courseId}, ${lesson.courseId})`,
      maxPoints: sql<number>`coalesce(sum(${question.points}), 0)::float`
    })
    .from(exercise)
    .leftJoin(lesson, eq(exercise.lessonId, lesson.id))
    .leftJoin(question, eq(question.exerciseId, exercise.id))
    .where(or(inArray(exercise.courseId, courseIds), inArray(lesson.courseId, courseIds)))
    .groupBy(exercise.id, lesson.courseId)
    .orderBy(asc(exercise.title));
}

export function listAssessmentInputs(enrollmentId: string, client: DbOrTxClient = db) {
  return client
    .select()
    .from(assessmentInput)
    .where(eq(assessmentInput.enrollmentId, enrollmentId))
    .orderBy(desc(assessmentInput.enteredAt), desc(assessmentInput.id));
}

export function addAssessmentInput(values: typeof assessmentInput.$inferInsert, client: DbOrTxClient = db) {
  return client.insert(assessmentInput).values(values).returning();
}

export function listCompletedAssessmentSubmissions(profileId: string, exerciseId: string, groupIds: string[]) {
  if (groupIds.length === 0) return Promise.resolve([]);

  return db
    .select({ id: submission.id, total: submission.total, createdAt: submission.createdAt })
    .from(submission)
    .innerJoin(groupmember, eq(submission.submittedBy, groupmember.id))
    .where(
      and(
        eq(submission.exerciseId, exerciseId),
        eq(submission.gradingState, 'completed'),
        eq(groupmember.profileId, profileId),
        inArray(groupmember.groupId, groupIds)
      )
    )
    .orderBy(desc(submission.total), desc(submission.createdAt));
}

export async function getAssessmentExercisePoints(exerciseId: string) {
  const [row] = await db
    .select({ points: sql<number>`coalesce(sum(${question.points}), 0)::float` })
    .from(question)
    .where(eq(question.exerciseId, exerciseId));
  return Number(row?.points ?? 0);
}

export async function getAssessmentScore(enrollmentId: string, client: DbOrTxClient = db) {
  const [score] = await client
    .select()
    .from(assessmentScore)
    .where(eq(assessmentScore.enrollmentId, enrollmentId))
    .limit(1);
  if (!score) return null;

  const [details, adjustments] = await Promise.all([
    client.select().from(assessmentScoreDetail).where(eq(assessmentScoreDetail.scoreId, score.id)),
    client
      .select()
      .from(assessmentAdjustment)
      .where(eq(assessmentAdjustment.scoreId, score.id))
      .orderBy(asc(assessmentAdjustment.adjustedAt))
  ]);
  return { ...score, details, adjustments };
}

export async function saveAssessmentScore(
  enrollmentId: string,
  values: Omit<typeof assessmentScore.$inferInsert, 'enrollmentId'>,
  details: Array<Omit<typeof assessmentScoreDetail.$inferInsert, 'scoreId'>>,
  client: DbOrTxClient
) {
  const [score] = await client
    .insert(assessmentScore)
    .values({ enrollmentId, ...values })
    .onConflictDoUpdate({ target: assessmentScore.enrollmentId, set: values })
    .returning();
  await client.delete(assessmentScoreDetail).where(eq(assessmentScoreDetail.scoreId, score.id));
  await client.insert(assessmentScoreDetail).values(details.map((detail) => ({ scoreId: score.id, ...detail })));
  return score;
}

export function addAssessmentAdjustment(values: typeof assessmentAdjustment.$inferInsert, client: DbOrTxClient) {
  return client.insert(assessmentAdjustment).values(values).returning();
}

export function updateAssessmentEnrollment(
  enrollmentId: string,
  values: Partial<typeof trainingEnrollment.$inferInsert>,
  client: DbOrTxClient
) {
  return client
    .update(trainingEnrollment)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(trainingEnrollment.id, enrollmentId))
    .returning();
}

export function getTrainingEvaluation(enrollmentId: string) {
  return db.select().from(trainingEvaluation).where(eq(trainingEvaluation.enrollmentId, enrollmentId)).limit(1);
}

export function createTrainingEvaluation(values: typeof trainingEvaluation.$inferInsert) {
  return db.insert(trainingEvaluation).values(values).onConflictDoNothing().returning();
}
