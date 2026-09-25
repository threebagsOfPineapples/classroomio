import { randomUUID } from 'node:crypto';
import {
  fromApiPayload,
  getQuestionTypeById,
  requiresManualGrading,
  scoreSubmissionAnswers,
  QUESTION_TYPE_ID_TO_KEY,
  type AnswerData
} from '@cio/question-types';
import {
  createExpiredExamSubmission,
  getExamCourseId,
  getExerciseWithRelationsOptimized,
  listExpiredExamAttempts
} from '@cio/db/queries/exercise';
import { createAssetUsage, getAssetById } from '@cio/db/queries/assets';
import type { TNewQuestionAnswer, TNewSubmission } from '@cio/db/types';

export async function finalizeExpiredExams(limit = 100) {
  const attempts = await listExpiredExamAttempts(limit);
  let finalized = 0;
  const affectedLearners: Array<{ courseId: string; groupMemberId: string }> = [];

  for (const attempt of attempts) {
    const exercise = await getExerciseWithRelationsOptimized(attempt.exerciseId);
    const courseId = await getExamCourseId(attempt.exerciseId);
    if (!courseId) throw new Error(`Exam has no course: ${attempt.exerciseId}`);
    const questions = exercise.questions.filter(
      (question): question is typeof question & { id: number } => question.id != null
    );
    const questionById = new Map(questions.map((question) => [question.id, question]));
    const answerByQuestionId = new Map<number, AnswerData>();

    for (const draftAnswer of attempt.draftAnswers) {
      const question = questionById.get(draftAnswer.questionId);
      if (!question) continue;

      const questionType = QUESTION_TYPE_ID_TO_KEY[question.questionTypeId];
      if (!questionType) continue;

      const model = {
        id: question.id,
        title: String(question.title ?? ''),
        questionType,
        points: Number(question.points ?? 0),
        settings:
          question.settings && typeof question.settings === 'object' && !Array.isArray(question.settings)
            ? (question.settings as Record<string, unknown>)
            : {},
        options: question.options.map((option) => ({
          id: option.id,
          label: option.label ?? '',
          value: option.value ?? undefined,
          isCorrect: option.isCorrect
        }))
      };

      try {
        const answer = fromApiPayload(questionType, draftAnswer, model);
        if (answer) answerByQuestionId.set(question.id, answer);
      } catch {
        continue;
      }
    }

    const hasManualQuestion = questions.some((question) => {
      const questionType = getQuestionTypeById(question.questionTypeId);
      return !questionType || requiresManualGrading(questionType.key);
    });
    const hasAutoQuestion = questions.some((question) => {
      const questionType = getQuestionTypeById(question.questionTypeId);
      return questionType && !requiresManualGrading(questionType.key);
    });
    const overallStatus = hasManualQuestion ? (hasAutoQuestion ? 'hybrid' : 'manual_required') : 'auto_graded';
    const shouldAutoGrade = overallStatus === 'auto_graded' && questions.length > 0;
    const scoringQuestions = questions.map((question) => ({
      id: question.id,
      title: question.title,
      questionTypeId: question.questionTypeId,
      points: Number(question.points ?? 0),
      settings: (question.settings as Record<string, unknown>) ?? {},
      options: question.options
    }));
    const graded = shouldAutoGrade ? scoreSubmissionAnswers(scoringQuestions, answerByQuestionId) : null;
    const pointsByQuestionId = new Map(graded?.scores.map((score) => [score.questionId, score.points]) ?? []);
    const submissionId = randomUUID();
    const submissionData: TNewSubmission & { exerciseId: string; submittedBy: string } = {
      id: submissionId,
      courseId,
      exerciseId: attempt.exerciseId,
      submittedBy: attempt.groupMemberId,
      statusId: graded ? 3 : hasManualQuestion ? 2 : 1,
      gradingState: graded ? 'completed' : hasManualQuestion ? 'awaiting_manual' : 'queued',
      overallStatus,
      total: graded?.total ?? 0
    };
    const answerRows: TNewQuestionAnswer[] = questions.flatMap((question) => {
      const answerData = answerByQuestionId.get(question.id);
      if (!answerData && !shouldAutoGrade) return [];

      return [
        {
          submissionId,
          questionId: question.id,
          groupMemberId: attempt.groupMemberId,
          answerData: answerData ?? null,
          point: pointsByQuestionId.get(question.id) ?? null
        }
      ];
    });

    const result = await createExpiredExamSubmission(attempt.id, submissionData, answerRows);
    if (!result) continue;

    for (const answer of result.insertedAnswers) {
      const answerData = answer.answerData;
      if (!answerData || typeof answerData !== 'object' || !('type' in answerData)) continue;
      if (answerData.type !== 'VIDEO_RECORDING') continue;

      const asset = await getAssetById(answerData.assetId);
      if (!asset) continue;

      await createAssetUsage({
        organizationId: asset.organizationId,
        assetId: answerData.assetId,
        targetType: 'submission_answer',
        targetId: String(answer.id),
        slotType: 'video_recording_answer',
        slotKey: String(answer.questionId),
        createdByProfileId: null
      });
    }

    finalized += 1;
    affectedLearners.push({ courseId, groupMemberId: attempt.groupMemberId });
  }

  return { finalized, inspected: attempts.length, affectedLearners };
}
