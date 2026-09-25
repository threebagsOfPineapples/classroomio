import { AppError, ErrorCodes } from '@api/utils/errors';
import type { getExercise } from '@cio/core/services/exercise/exercise';
import { startExamAttempt } from '@cio/db/queries/exercise';

type Exam = Awaited<ReturnType<typeof getExercise>>;

export async function startExamAttemptService(exerciseId: string, groupMemberId: string) {
  const attempt = await startExamAttempt(exerciseId, groupMemberId);
  if (!attempt) {
    throw new AppError('Exam is unavailable or the attempt limit has been reached', ErrorCodes.VALIDATION_ERROR, 403);
  }

  return {
    id: attempt.id,
    attemptNumber: attempt.attemptNumber,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt
  };
}

export function assertExamOpen(exercise: Pick<Exam, 'isExam' | 'opensAt' | 'closesAt'>, now = new Date()) {
  if (!exercise.isExam) return;

  if (!exercise.opensAt || now.getTime() < Date.parse(exercise.opensAt)) {
    throw new AppError('Exam has not opened', ErrorCodes.VALIDATION_ERROR, 403);
  }

  if (!exercise.closesAt || now.getTime() >= Date.parse(exercise.closesAt)) {
    throw new AppError('Exam has closed', ErrorCodes.VALIDATION_ERROR, 403);
  }
}

export function redactExamAnswers(exercise: Exam): Exam {
  const redactQuestion = (question: NonNullable<Exam['questions']>[number]) => ({
    ...question,
    settings: {},
    options: question.options.map((option) => ({ ...option, isCorrect: false, settings: {} }))
  });

  return {
    ...exercise,
    questions: exercise.questions?.map(redactQuestion),
    sections: exercise.sections?.map((section) => ({
      ...section,
      questions: section.questions.map(redactQuestion)
    }))
  };
}
