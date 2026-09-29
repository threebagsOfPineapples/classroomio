import { getActiveMakeupPolicy } from '@cio/utils/functions/exam-makeup';
import * as schema from '@db/schema';
import { and, asc, db, desc, eq, gt, isNull, lte, sql } from '@db/drizzle';
import type { DbOrTxClient } from '@db/drizzle';
import type { TNewQuestionAnswer, TNewSubmission } from '@db/types';

export function getExamExpiresAt(startedAt: string, closesAt: string, durationMinutes: number | null) {
  const durationDeadline = durationMinutes ? Date.parse(startedAt) + durationMinutes * 60_000 : Infinity;
  return new Date(Math.min(Date.parse(closesAt), durationDeadline)).toISOString();
}

export function canCreateExamAttempt(attemptCount: number, maxAttempts: number, allowMakeup: boolean) {
  return attemptCount < maxAttempts && (attemptCount === 0 || allowMakeup);
}

export async function getExamCourseId(exerciseId: string) {
  const [row] = await db
    .select({ exerciseCourseId: schema.exercise.courseId, lessonCourseId: schema.lesson.courseId })
    .from(schema.exercise)
    .leftJoin(schema.lesson, eq(schema.exercise.lessonId, schema.lesson.id))
    .where(eq(schema.exercise.id, exerciseId));

  return row?.exerciseCourseId ?? row?.lessonCourseId ?? null;
}

export async function startExamAttempt(exerciseId: string, groupMemberId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${exerciseId}), hashtext(${groupMemberId}))`);

    const [exercise] = await tx
      .select({
        isExam: schema.exercise.isExam,
        opensAt: schema.exercise.opensAt,
        closesAt: schema.exercise.closesAt,
        maxAttempts: schema.exercise.maxAttempts,
        durationMinutes: schema.exercise.durationMinutes,
        allowMakeup: schema.exercise.allowMakeup,
        currentTime: sql<string>`clock_timestamp()::text`
      })
      .from(schema.exercise)
      .where(eq(schema.exercise.id, exerciseId));

    if (!exercise?.isExam) return null;

    const makeup = await getExamMakeup(exerciseId, groupMemberId, tx);
    const policy = getActiveMakeupPolicy(makeup, Date.parse(exercise.currentTime));
    if (policy) Object.assign(exercise, policy);

    if (!exercise.opensAt || !exercise.closesAt) return null;

    const now = Date.parse(exercise.currentTime);
    if (now < Date.parse(exercise.opensAt) || now >= Date.parse(exercise.closesAt)) return null;

    const attempts = await tx
      .select()
      .from(schema.examAttempt)
      .where(and(eq(schema.examAttempt.exerciseId, exerciseId), eq(schema.examAttempt.groupMemberId, groupMemberId)))
      .orderBy(desc(schema.examAttempt.attemptNumber));
    const activeAttempt = attempts.find((attempt) => !attempt.submittedAt && Date.parse(attempt.expiresAt) > now);
    if (activeAttempt) return activeAttempt;

    if (!canCreateExamAttempt(attempts.length, exercise.maxAttempts, exercise.allowMakeup)) return null;

    const expiresAt = getExamExpiresAt(exercise.currentTime, exercise.closesAt, exercise.durationMinutes);
    const [attempt] = await tx
      .insert(schema.examAttempt)
      .values({
        exerciseId,
        groupMemberId,
        attemptNumber: attempts.length + 1,
        startedAt: exercise.currentTime,
        expiresAt
      })
      .returning();

    return attempt;
  });
}

export type ExamDraftAnswer = { questionId: number; optionId?: number; answer?: string };

export async function saveExamDraft(
  exerciseId: string,
  groupMemberId: string,
  examAttemptId: string,
  answers: ExamDraftAnswer[]
) {
  const [attempt] = await db
    .update(schema.examAttempt)
    .set({ draftAnswers: answers })
    .where(
      and(
        eq(schema.examAttempt.id, examAttemptId),
        eq(schema.examAttempt.exerciseId, exerciseId),
        eq(schema.examAttempt.groupMemberId, groupMemberId),
        isNull(schema.examAttempt.submittedAt),
        gt(schema.examAttempt.expiresAt, sql`clock_timestamp()`),
        sql`(EXISTS (SELECT 1 FROM exercise WHERE exercise.id = ${exerciseId} AND exercise.is_exam AND exercise.opens_at <= clock_timestamp() AND exercise.closes_at > clock_timestamp()) OR EXISTS (SELECT 1 FROM exam_makeup WHERE exam_makeup.exercise_id = ${exerciseId} AND exam_makeup.group_member_id = ${groupMemberId} AND exam_makeup.opens_at <= clock_timestamp() AND exam_makeup.closes_at > clock_timestamp()))`
      )
    )
    .returning({ id: schema.examAttempt.id });

  return attempt ?? null;
}

export async function listExpiredExamAttempts(limit: number) {
  return db
    .select()
    .from(schema.examAttempt)
    .where(and(isNull(schema.examAttempt.submittedAt), lte(schema.examAttempt.expiresAt, sql`clock_timestamp()`)))
    .orderBy(asc(schema.examAttempt.expiresAt))
    .limit(limit);
}

export async function createExpiredExamSubmission(
  examAttemptId: string,
  submissionData: TNewSubmission & { exerciseId: string; submittedBy: string },
  answerRows: TNewQuestionAnswer[]
) {
  try {
    return await db.transaction(async (tx) => {
      const [submission] = await tx.insert(schema.submission).values(submissionData).returning();
      if (!submission) throw new Error('Failed to create expired exam submission');

      const [attempt] = await tx
        .update(schema.examAttempt)
        .set({ submissionId: submission.id, submittedAt: sql`clock_timestamp()` })
        .where(
          and(
            eq(schema.examAttempt.id, examAttemptId),
            eq(schema.examAttempt.exerciseId, submissionData.exerciseId),
            eq(schema.examAttempt.groupMemberId, submissionData.submittedBy),
            isNull(schema.examAttempt.submittedAt),
            lte(schema.examAttempt.expiresAt, sql`clock_timestamp()`)
          )
        )
        .returning({ id: schema.examAttempt.id });
      if (!attempt) throw new InvalidExamAttempt();

      const insertedAnswers =
        answerRows.length > 0 ? await tx.insert(schema.questionAnswer).values(answerRows).returning() : [];
      return { submission, insertedAnswers };
    });
  } catch (error) {
    if (error instanceof InvalidExamAttempt) return null;

    throw error;
  }
}

class InvalidExamAttempt extends Error {}

export async function createExamSubmission(
  examAttemptId: string,
  submissionData: TNewSubmission & { exerciseId: string; submittedBy: string },
  answerRows: TNewQuestionAnswer[]
) {
  try {
    return await db.transaction(async (tx) => {
      const [submission] = await tx.insert(schema.submission).values(submissionData).returning();
      if (!submission) throw new Error('Failed to create exam submission');

      const [attempt] = await tx
        .update(schema.examAttempt)
        .set({ submissionId: submission.id, submittedAt: sql`clock_timestamp()` })
        .where(
          and(
            eq(schema.examAttempt.id, examAttemptId),
            eq(schema.examAttempt.exerciseId, submissionData.exerciseId),
            eq(schema.examAttempt.groupMemberId, submissionData.submittedBy),
            isNull(schema.examAttempt.submittedAt),
            gt(schema.examAttempt.expiresAt, sql`clock_timestamp()`),
            sql`(EXISTS (SELECT 1 FROM exercise WHERE exercise.id = ${submissionData.exerciseId} AND exercise.is_exam AND exercise.opens_at <= clock_timestamp() AND exercise.closes_at > clock_timestamp()) OR EXISTS (SELECT 1 FROM exam_makeup WHERE exam_makeup.exercise_id = ${submissionData.exerciseId} AND exam_makeup.group_member_id = ${submissionData.submittedBy} AND exam_makeup.opens_at <= clock_timestamp() AND exam_makeup.closes_at > clock_timestamp()))`
          )
        )
        .returning({ id: schema.examAttempt.id });
      if (!attempt) throw new InvalidExamAttempt();

      const insertedAnswers =
        answerRows.length > 0 ? await tx.insert(schema.questionAnswer).values(answerRows).returning() : [];

      return { submission, insertedAnswers };
    });
  } catch (error) {
    if (error instanceof InvalidExamAttempt) return null;

    throw error;
  }
}

export async function getExamMakeup(exerciseId: string, groupMemberId: string, client: DbOrTxClient = db) {
  const [makeup] = await client
    .select()
    .from(schema.examMakeup)
    .where(and(eq(schema.examMakeup.exerciseId, exerciseId), eq(schema.examMakeup.groupMemberId, groupMemberId)));
  return makeup ?? null;
}

export async function grantExamMakeup(
  exerciseId: string,
  groupMemberId: string,
  opensAt: string,
  closesAt: string,
  grantedBy: string,
  client: DbOrTxClient
) {
  await client.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${exerciseId}), hashtext(${groupMemberId}))`);
  const attempts = await client
    .select({
      id: schema.examAttempt.id,
      submittedAt: schema.examAttempt.submittedAt,
      expiresAt: schema.examAttempt.expiresAt
    })
    .from(schema.examAttempt)
    .where(and(eq(schema.examAttempt.exerciseId, exerciseId), eq(schema.examAttempt.groupMemberId, groupMemberId)));
  if (attempts.some((attempt) => !attempt.submittedAt && Date.parse(attempt.expiresAt) > Date.now())) return false;

  const maxAttempts = attempts.length + 1;
  const grantedAt = new Date().toISOString();
  await client
    .insert(schema.examMakeup)
    .values({ exerciseId, groupMemberId, opensAt, closesAt, maxAttempts, grantedBy, grantedAt })
    .onConflictDoUpdate({
      target: [schema.examMakeup.exerciseId, schema.examMakeup.groupMemberId],
      set: { opensAt, closesAt, maxAttempts, grantedBy, grantedAt }
    });
  return true;
}
