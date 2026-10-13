import { expect, it } from 'vitest';
import { mentorshipExamBaseline } from './mentorship-exam';

const configuration = {
  exercise: { id: 'exam-1', passThreshold: 60, updatedAt: '2025-01-01T00:00:00Z' },
  questions: [
    {
      id: 2,
      questionTypeId: 1,
      points: 50,
      settings: { partialCredit: false, expected: 'answer' },
      updatedAt: '2025-01-01T00:00:00Z'
    },
    { id: 1, questionTypeId: 1, points: 50, settings: {}, updatedAt: '2025-01-01T00:00:00Z' }
  ],
  options: [
    { id: 2, questionId: 2, label: 'Wrong', value: 'option-2', isCorrect: false, updatedAt: '2025-01-01T00:00:00Z' },
    { id: 1, questionId: 1, label: 'Right', value: 'option-1', isCorrect: true, updatedAt: '2025-01-01T00:00:00Z' }
  ]
};

it('sorts question and option identities and recursively normalizes settings keys', () => {
  const reordered = structuredClone(configuration);
  reordered.questions.reverse();
  reordered.options.reverse();
  reordered.questions[1].settings = { expected: 'answer', partialCredit: false };
  expect(mentorshipExamBaseline(reordered)).toEqual(mentorshipExamBaseline(configuration));
});

it.each([
  'question-type',
  'points',
  'settings',
  'option-label',
  'option-value',
  'correct-answer',
  'pass-threshold',
  'timestamp'
])('includes actual scoring input %s in the frozen basis', (change) => {
  const changed = structuredClone(configuration);
  if (change === 'question-type') changed.questions[0].questionTypeId = 2;
  if (change === 'points') changed.questions[0].points = 40;
  if (change === 'settings') changed.questions[0].settings.partialCredit = true;
  if (change === 'option-label') changed.options[0].label = 'Changed answer';
  if (change === 'option-value') changed.options[0].value = 'changed-value';
  if (change === 'correct-answer') changed.options[0].isCorrect = true;
  if (change === 'pass-threshold') changed.exercise.passThreshold = 50;
  if (change === 'timestamp') changed.questions[0].updatedAt = '2025-01-02T00:00:00Z';
  expect(mentorshipExamBaseline(changed).examScoringFingerprint).not.toBe(
    mentorshipExamBaseline(configuration).examScoringFingerprint
  );
});
