import { describe, expect, it } from 'vitest';

import type { Question } from '$features/course/types';
import { mapZodErrorsToQuestionErrors } from './store';
import { appendQuestionBankQuestions } from '$features/course/utils/question-bank-utils';
import { transformQuestionsToApiFormat } from './functions';

function makeQuestion(overrides: Partial<Question>): Question {
  return {
    id: overrides.id ?? 'question-1',
    title: overrides.title ?? 'Question',
    points: overrides.points ?? 1,
    questionTypeId: overrides.questionTypeId ?? 1,
    questionType: overrides.questionType,
    options: overrides.options ?? [],
    ...overrides
  } as Question;
}

describe('mapZodErrorsToQuestionErrors', () => {
  it('maps Zod question errors to the correct active question when deleted questions are present', () => {
    const questions = [
      makeQuestion({ id: 'question-1', title: 'Saved question 1' }),
      makeQuestion({ id: 'question-2', title: 'Deleted question', deletedAt: '2026-01-01T00:00:00.000Z' }),
      makeQuestion({ id: 'question-3', title: '' }),
      makeQuestion({ id: 'question-4', title: 'Saved question 4' })
    ];

    const zodErrors = {
      'questions.1.question': 'Question text is required',
      'questions.1.options.0.label': 'Option label is required'
    };

    const result = mapZodErrorsToQuestionErrors(zodErrors, questions);

    expect(result).toEqual({
      'question-3': {
        title: 'Question text is required',
        option: 'Option label is required'
      }
    });
  });
});

it('copies bank questions into independent new rows without changing the source or its section', () => {
  const original = makeQuestion({
    id: 11,
    exerciseSectionId: 'source-section',
    settings: { instructions: '原始说明' },
    options: [{ id: 22, label: '正确选项', value: null, isCorrect: true, settings: { imageUrl: '/original.png' } }]
  });
  const blankDraft = makeQuestion({ id: '1-form', title: '', order: 0 });
  const [copy] = appendQuestionBankQuestions([original], [blankDraft], 'target-section');
  const payload = transformQuestionsToApiFormat([copy]);
  expect(payload?.[0].id).toBeUndefined();
  expect(payload?.[0].options?.[0].id).toBeUndefined();
  expect(copy).toMatchObject({ order: 0, exerciseSectionId: 'target-section', isDirty: true });
  expect(appendQuestionBankQuestions([original], [{ ...blankDraft, isDirty: true }], null)).toHaveLength(2);
  copy.options[0].settings!.imageUrl = '/copy.png';
  original.settings!.instructions = '原题后续修改';
  expect(original.options[0].settings?.imageUrl).toBe('/original.png');
  expect(copy.settings?.instructions).toBe('原始说明');
});
