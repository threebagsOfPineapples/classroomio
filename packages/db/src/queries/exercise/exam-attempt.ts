import * as schema from '@db/schema';
import { and, asc, db, desc, eq, gt, isNull, lte, sql } from '@db/drizzle';
import type { TNewQuestionAnswer, TNewSubmission } from '@db/types';

export function getExamExpiresAt(startedAt: string, closesAt: string, durationMinutes: number | null) {
  const durationDeadline = durationMinutes ? Date.parse(startedAt) + durationMinutes * 60_000 : Infinity;
  return new Date(Math.min(Date.parse(closesAt), durationDeadline)).toISOString();
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
        currentTime: sql<string>`clock_timestamp()::text`
      })
      .from(schema.exercise)
      .where(eq(schema.exercise.id, exerciseId));

    if (!exercise?.isExam || !exercise.opensAt || !exercise.closesAt) return null;

    const now = Date.parse(exercise.currentTime);
    if (now < Date.parse(exercise.opensAt) || now >= Date.parse(exercise.closesAt)) return null;

    const attempts = await tx
      .select()
      .from(schema.examAttempt)
      .where(and(eq(schema.examAttempt.exerciseId, exerciseId), eq(schema.examAttempt.groupMemberId, groupMemberId)))
      .orderBy(desc(schema.examAttempt.attemptNumber));
    const activeAttempt = attempts.find((attempt) => !attempt.submittedAt && Date.parse(attempt.expiresAt) > now);
    if (activeAttempt) return activeAttempt;

    if (attempts.length >= exercise.maxAttempts) return null;

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
        sql`EXISTS (SELECT 1 FROM exercise WHERE exercise.id = ${exerciseId} AND exercise.is_exam AND exercise.opens_at <= clock_timestamp() AND exercise.closes_at > clock_timestamp())`
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
            sql`EXISTS (SELECT 1 FROM exercise WHERE exercise.id = ${submissionData.exerciseId} AND exercise.is_exam AND exercise.opens_at <= clock_timestamp() AND exercise.closes_at > clock_timestamp())`
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
