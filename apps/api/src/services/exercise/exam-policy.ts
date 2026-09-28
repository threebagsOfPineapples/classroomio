import { AppError, ErrorCodes } from '@api/utils/errors';
import type { getExercise } from '@cio/core/services/exercise/exercise';
import {
  getExamCourseId,
  getExerciseWithRelationsOptimized,
  saveExamDraft,
  startExamAttempt
} from '@cio/db/queries/exercise';
import type { TExamDraftSave } from '@cio/utils/validation/exercise';
import { QUESTION_TYPE_ID_TO_KEY, QUESTION_TYPE_KEY } from '@cio/question-types';

type Exam = Awaited<ReturnType<typeof getExercise>>;

export async function startExamAttemptService(courseId: string, exerciseId: string, groupMemberId: string) {
  await assertExamCourse(courseId, exerciseId);
  const attempt = await startExamAttempt(exerciseId, groupMemberId);
  if (!attempt) {
    throw new AppError('Exam is unavailable or the attempt limit has been reached', ErrorCodes.VALIDATION_ERROR, 403);
  }

  return {
    id: attempt.id,
    attemptNumber: attempt.attemptNumber,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    draftAnswers: attempt.draftAnswers
  };
}

export async function saveExamDraftService(
  courseId: string,
  exerciseId: string,
  groupMemberId: string,
  { examAttemptId, answers }: TExamDraftSave
) {
  await assertExamCourse(courseId, exerciseId);
  const exercise = await getExerciseWithRelationsOptimized(exerciseId);
  if (!exercise.exercise.isExam) {
    throw new AppError('This exercise is not an exam', ErrorCodes.VALIDATION_ERROR, 400);
  }

  const questionIds = new Set(exercise.questions.map((question) => question.id));
  if (answers.some((answer) => !questionIds.has(answer.questionId))) {
    throw new AppError('Draft contains an invalid question', ErrorCodes.VALIDATION_ERROR, 400);
  }

  const saved = await saveExamDraft(exerciseId, groupMemberId, examAttemptId, answers);
  if (!saved) {
    throw new AppError('Exam attempt has expired or was already submitted', ErrorCodes.VALIDATION_ERROR, 403);
  }

  return { saved: true };
}

export async function assertExamCourse(courseId: string, exerciseId: string) {
  const actualCourseId = await getExamCourseId(exerciseId);
  if (actualCourseId !== courseId) {
    throw new AppError('Exam does not belong to this course', ErrorCodes.VALIDATION_ERROR, 403);
  }
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

export function getLearnerExam(exercise: Exam, now = new Date()) {
  const closed = exercise.closesAt && now.getTime() >= Date.parse(exercise.closesAt);
  if (closed && exercise.isComplete) {
    const answersVisible = !!exercise.showAnswers;
    const learnerExercise = answersVisible ? exercise : redactExamAnswers(exercise);
    return { ...learnerExercise, answersVisible };
  }

  assertExamOpen(exercise, now);
  const learnerExercise = redactExamAnswers(exercise);
  return { ...learnerExercise, answersVisible: false };
}

export function redactExamAnswers(exercise: Exam): Exam {
  const redactQuestion = (question: NonNullable<Exam['questions']>[number]) => {
    const settings = getExamTakeSettings(question.settings);
    const questionType = QUESTION_TYPE_ID_TO_KEY[question.questionTypeId];
    const options = question.options.map((option) => ({
      ...option,
      isCorrect: false,
      settings: getExamTakeSettings(option.settings)
    }));

    if (questionType === QUESTION_TYPE_KEY.WORD_BANK) {
      const correctAnswers = Array.isArray(question.settings?.correctAnswers) ? question.settings.correctAnswers : [];
      const distractors = Array.isArray(question.settings?.distractors) ? question.settings.distractors : [];
      settings.distractors = [...correctAnswers, ...distractors].map(String).sort();
    }

    if (questionType === QUESTION_TYPE_KEY.ORDERING) {
      options.sort((first, second) => String(first.label).localeCompare(String(second.label)));
      if (!options.length && Array.isArray(question.settings?.items)) {
        settings.items = question.settings.items.map(String).sort();
      }
    }

    return { ...question, settings, options };
  };

  return {
    ...exercise,
    questions: exercise.questions?.map(redactQuestion),
    sections: exercise.sections?.map((section) => ({
      ...section,
      questions: section.questions.map(redactQuestion)
    }))
  };
}

function getExamTakeSettings(settings: Record<string, unknown> = {}) {
  const allowedKeys = [
    'instructions',
    'template',
    'minCharacters',
    'maxCharacters',
    'maxStars',
    'acceptedTypes',
    'maxSizeMb',
    'maxDurationSeconds',
    'imageUrl'
  ];
  return Object.fromEntries(Object.entries(settings).filter(([key]) => allowedKeys.includes(key)));
}
