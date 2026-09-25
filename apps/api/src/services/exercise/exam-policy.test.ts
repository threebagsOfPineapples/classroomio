import { describe, expect, it } from 'vitest';
import { assertExamOpen, redactExamAnswers } from './exam-policy';

describe('exam access', () => {
  const window = {
    isExam: true,
    opensAt: '2026-09-25T09:00:00.000Z',
    closesAt: '2026-09-25T10:00:00.000Z'
  };

  it('allows the opening instant and rejects times outside the window', () => {
    expect(() => assertExamOpen(window, new Date(window.opensAt))).not.toThrow();
    expect(() => assertExamOpen(window, new Date('2026-09-25T08:59:59.999Z'))).toThrow('Exam has not opened');
    expect(() => assertExamOpen(window, new Date(window.closesAt))).toThrow('Exam has closed');
  });

  it('removes answer keys from both question projections', () => {
    const question = {
      settings: { correctValue: true },
      options: [{ isCorrect: true, settings: { answer: 'yes' } }]
    };
    const exam = {
      ...window,
      questions: [question],
      sections: [{ questions: [question] }]
    } as unknown as Parameters<typeof redactExamAnswers>[0];

    const learnerExam = redactExamAnswers(exam);
    expect(learnerExam.questions?.[0].settings).toEqual({});
    expect(learnerExam.questions?.[0].options[0]).toMatchObject({ isCorrect: false, settings: {} });
    expect(learnerExam.sections?.[0].questions[0].options[0]).toMatchObject({ isCorrect: false, settings: {} });
  });
});
