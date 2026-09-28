import { BaseApiWithErrors, classroomio } from '$lib/utils/services/api';
import type { GetExerciseRequest, GetQuestionBankRequest, QuestionBankEntries, Exercise } from '../utils/types';
import { appendQuestionBankQuestions } from '../utils/question-bank-utils';
import { questionnaire } from '../components/exercise/store';
import { snackbar } from '$features/ui/snackbar/store';

export class QuestionBankApi extends BaseApiWithErrors {
  entries = $state<QuestionBankEntries>([]);

  async load(courseId: string, search: string, page: number) {
    this.entries = [];
    await this.execute<GetQuestionBankRequest>({
      requestFn: () =>
        classroomio.course[':courseId'].exercise['question-bank'].$get({
          param: { courseId },
          query: { search, page: String(page) }
        }),
      logContext: 'loading question bank',
      onSuccess: (response) => {
        this.entries = response.data;
      },
      onError: () => snackbar.error('course.question_bank.failed')
    });
  }

  async importSelected(entries: QuestionBankEntries) {
    const exercises = new Map<string, Exercise>();
    const questions: NonNullable<Exercise['questions']> = [];
    for (const entry of entries) {
      let exercise = exercises.get(entry.exerciseId);
      if (!exercise) {
        const response = await this.execute<GetExerciseRequest>({
          requestFn: () =>
            classroomio.course[':courseId'].exercise[':exerciseId'].$get({
              param: { courseId: entry.courseId, exerciseId: entry.exerciseId }
            }),
          logContext: 'reading question bank source',
          onError: () => snackbar.error('course.question_bank.failed')
        });
        if (!response?.data) return false;

        exercise = response.data;
        exercises.set(entry.exerciseId, exercise);
      }

      const question = exercise.questions?.find((question) => Number(question.id) === entry.id);
      if (!question) {
        snackbar.error('course.question_bank.failed');
        return false;
      }

      questions.push(question);
    }

    questionnaire.update((state) => {
      const firstSection = state.sections.find((section) => !section.deletedAt);
      const questionsWithCopies = appendQuestionBankQuestions(questions, state.questions, firstSection?.id ?? null);
      return { ...state, questions: questionsWithCopies };
    });
    return true;
  }
}
