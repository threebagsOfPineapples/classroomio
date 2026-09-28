import { describe, expect, it } from 'vitest';
import type { Question } from '../types';
import { arrangeExamQuestions } from './exam-order';

describe('exam order', () => {
  it('keeps the same order on refresh and never changes question or option IDs', () => {
    const questions = [1, 2, 3, 4, 5, 6].map((id) => ({
      id,
      order: id,
      options: [1, 2, 3, 4].map((optionId) => ({ id: id * 10 + optionId }))
    })) as Question[];
    const first = arrangeExamQuestions(questions, 'attempt-one', true, true);
    const refreshed = arrangeExamQuestions([...questions].reverse(), 'attempt-one', true, true);

    expect(first.map((question) => question.id)).toEqual(refreshed.map((question) => question.id));
    expect(first.map((question) => question.id).sort()).toEqual(questions.map((question) => question.id).sort());
    expect(first[0].options.map((option) => option.id)).toEqual(refreshed[0].options.map((option) => option.id));
    expect(first.map((question) => question.order)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
