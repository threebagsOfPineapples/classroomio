import { describe, expect, it } from 'vitest';
import { assertExamOpen, getLearnerExam, redactExamAnswers } from './exam-policy';
import { canCreateExamAttempt, getExamExpiresAt } from '@cio/db/queries/exercise';
import { QUESTION_TYPE_IDS } from '@cio/question-types';

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

  it('ends an attempt at the earlier of its duration and the exam close', () => {
    const startedAt = '2026-09-25T09:00:00.000Z';
    const closesAt = '2026-09-25T10:00:00.000Z';

    expect(getExamExpiresAt(startedAt, closesAt, 30)).toBe('2026-09-25T09:30:00.000Z');
    expect(getExamExpiresAt(startedAt, closesAt, 90)).toBe(closesAt);
    expect(getExamExpiresAt(startedAt, closesAt, null)).toBe(closesAt);
  });

  it('keeps take controls and candidate words without exposing answer keys or expected ordering', () => {
    const questions = [
      {
        questionTypeId: QUESTION_TYPE_IDS.WORD_BANK,
        settings: { template: '[] []', correctAnswers: ['乙', '甲'], distractors: ['丙'], acceptedAnswers: 'secret' },
        options: []
      },
      {
        questionTypeId: QUESTION_TYPE_IDS.ORDERING,
        settings: { items: ['Z', 'A'] },
        options: []
      },
      {
        questionTypeId: QUESTION_TYPE_IDS.TEXTAREA,
        settings: { instructions: '请填写', minCharacters: 10, maxCharacters: 100, correctValue: 'secret' },
        options: [{ label: '带图选项', isCorrect: true, settings: { imageUrl: '/image.png', answer: 'secret' } }]
      }
    ];
    const exam = { ...window, questions, sections: [{ questions }] } as unknown as Parameters<
      typeof redactExamAnswers
    >[0];
    const learner = redactExamAnswers(exam);
    const expectedSettings = [
      { template: '[] []', distractors: ['丙', '乙', '甲'].sort() },
      { items: ['A', 'Z'] },
      { instructions: '请填写', minCharacters: 10, maxCharacters: 100 }
    ];
    expect(learner.questions?.map((question) => question.settings)).toEqual(expectedSettings);
    expect(learner.sections?.[0].questions.map((question) => question.settings)).toEqual(expectedSettings);
    expect(learner.questions?.[2].options[0]).toMatchObject({ isCorrect: false, settings: { imageUrl: '/image.png' } });
    expect(exam.questions?.[0].settings?.correctAnswers).toEqual(['乙', '甲']);
  });

  it('requires the makeup switch and respects the attempt limit', () => {
    expect(canCreateExamAttempt(0, 2, false)).toBe(true);
    expect(canCreateExamAttempt(1, 2, false)).toBe(false);
    expect(canCreateExamAttempt(1, 2, true)).toBe(true);
    expect(canCreateExamAttempt(2, 2, true)).toBe(false);
  });

  it('reveals answers only after closing to a learner with a submission when enabled', () => {
    const exam = {
      ...window,
      isComplete: true,
      showAnswers: true,
      questions: [{ settings: { correctValue: true }, options: [{ isCorrect: true, settings: {} }] }],
      sections: []
    } as unknown as Parameters<typeof getLearnerExam>[0];
    const closed = new Date(window.closesAt);

    expect(getLearnerExam(exam, closed).questions?.[0].options[0].isCorrect).toBe(true);
    expect(getLearnerExam(exam, closed).answersVisible).toBe(true);
    expect(getLearnerExam({ ...exam, showAnswers: false }, closed).questions?.[0].options[0].isCorrect).toBe(false);
    expect(getLearnerExam({ ...exam, showAnswers: false }, closed).answersVisible).toBe(false);
    expect(() => getLearnerExam({ ...exam, isComplete: false }, closed)).toThrow('Exam has closed');
    expect(getLearnerExam(exam, new Date(window.opensAt)).questions?.[0].options[0].isCorrect).toBe(false);
    expect(getLearnerExam(exam, new Date(window.opensAt)).answersVisible).toBe(false);
  });
});
