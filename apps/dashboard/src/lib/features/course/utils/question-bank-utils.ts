import type { Question } from '../types';
import type { Exercise } from './types';
import { getQuestionTypeOptionById } from '../components/exercise/question-type-utils';

export function appendQuestionBankQuestions(
  questions: NonNullable<Exercise['questions']>,
  currentQuestions: Question[],
  exerciseSectionId: string | null
): Question[] {
  const onlyQuestion = currentQuestions.length === 1 ? currentQuestions[0] : null;
  const replaceEmptyDraft = onlyQuestion?.id === '1-form' && !onlyQuestion.isDirty && !onlyQuestion.title?.trim();
  const existingQuestions = replaceEmptyDraft ? [] : currentQuestions;
  const firstOrder = existingQuestions.reduce((highest, question) => Math.max(highest, question.order), -1) + 1;
  const copies = questions.map((question, index) => {
    const copied = structuredClone(question);
    const id = `${crypto.randomUUID()}-form`;
    const questionType = getQuestionTypeOptionById(copied.questionTypeId);
    const options = copied.options.map((option, optionIndex) => ({ ...option, id: `${optionIndex + 1}-form` }));
    return {
      ...copied,
      id,
      name: id,
      order: firstOrder + index,
      exerciseSectionId,
      questionType,
      options,
      isDirty: true
    };
  });
  return [...existingQuestions, ...copies];
}
