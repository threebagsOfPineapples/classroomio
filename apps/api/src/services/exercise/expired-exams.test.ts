import { beforeEach, expect, it, vi } from 'vitest';

const queries = vi.hoisted(() => ({
  listExpiredExamAttempts: vi.fn(),
  getExerciseWithRelationsOptimized: vi.fn(),
  getExamCourseId: vi.fn(),
  createExpiredExamSubmission: vi.fn()
}));

vi.mock('@cio/db/queries/exercise', () => queries);
vi.mock('@cio/db/queries/assets', () => ({ createAssetUsage: vi.fn(), getAssetById: vi.fn() }));

import { finalizeExpiredExams } from '@cio/core/services/exercise/expired-exams';

beforeEach(() => {
  vi.clearAllMocks();
  queries.getExamCourseId.mockResolvedValue('course-1');
  queries.createExpiredExamSubmission.mockResolvedValue({ submission: { id: 'submission-1' }, insertedAnswers: [] });
});

it('finalizes a saved objective answer once with its score and course', async () => {
  queries.listExpiredExamAttempts
    .mockResolvedValueOnce([
      {
        id: 'attempt-1',
        exerciseId: 'exercise-1',
        groupMemberId: 'member-1',
        draftAnswers: [{ questionId: 2, answer: JSON.stringify({ type: 'CHECKBOX', optionIds: [6] }) }]
      }
    ])
    .mockResolvedValueOnce([]);
  queries.getExerciseWithRelationsOptimized.mockResolvedValue({
    exercise: { id: 'exercise-1' },
    questions: [
      {
        id: 2,
        title: 'Choose one',
        questionTypeId: 2,
        points: 10,
        settings: {},
        options: [{ id: 6, label: 'Correct', isCorrect: true }]
      }
    ]
  });

  expect(await finalizeExpiredExams()).toEqual({
    finalized: 1,
    inspected: 1,
    affectedLearners: [{ courseId: 'course-1', groupMemberId: 'member-1' }]
  });
  expect((await finalizeExpiredExams()).finalized).toBe(0);
  expect(queries.createExpiredExamSubmission).toHaveBeenCalledTimes(1);
  expect(queries.createExpiredExamSubmission).toHaveBeenCalledWith(
    'attempt-1',
    expect.objectContaining({ courseId: 'course-1', total: 10, gradingState: 'completed' }),
    [expect.objectContaining({ questionId: 2, point: 10 })]
  );
});

it('records an unanswered expired attempt with zero points', async () => {
  queries.listExpiredExamAttempts.mockResolvedValue([
    { id: 'attempt-2', exerciseId: 'exercise-1', groupMemberId: 'member-1', draftAnswers: [] }
  ]);
  queries.getExerciseWithRelationsOptimized.mockResolvedValue({
    exercise: { id: 'exercise-1' },
    questions: [
      {
        id: 2,
        title: 'Choose one',
        questionTypeId: 2,
        points: 10,
        settings: {},
        options: [{ id: 6, label: 'Correct', isCorrect: true }]
      }
    ]
  });

  expect((await finalizeExpiredExams()).finalized).toBe(1);
  expect(queries.createExpiredExamSubmission).toHaveBeenCalledWith(
    'attempt-2',
    expect.objectContaining({ total: 0, gradingState: 'completed' }),
    [expect.objectContaining({ questionId: 2, answerData: null, point: 0 })]
  );
});
