import { AppError, ErrorCodes } from '@api/utils/errors';
import type { getExercise } from '@cio/core/services/exercise/exercise';

type Exam = Awaited<ReturnType<typeof getExercise>>;

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
