import { expect, it, vi } from 'vitest';
import { getExercise } from '@cio/core/services/exercise/exercise';
import { ZExerciseUpdate } from '@cio/utils/validation/exercise';

vi.mock('@cio/db/queries/exercise', async (importOriginal) => {
  const original = await importOriginal<typeof import('@cio/db/queries/exercise')>();
  return {
    ...original,
    getExerciseWithRelationsOptimized: vi.fn(async () => ({
      exercise: {
        isExam: true,
        opensAt: '2026-09-27 01:53:51.909468+00',
        closesAt: '2026-09-29 01:53:51.909468+00'
      },
      questions: []
    })),
    getExerciseSectionsByExerciseId: vi.fn(async () => [])
  };
});

it('returns exam dates that can be saved unchanged through the update validator', async () => {
  const exercise = await getExercise('88888888-8888-4888-8888-888888888888');
  expect(exercise.opensAt).toBe('2026-09-27T01:53:51.909Z');
  expect(exercise.closesAt).toBe('2026-09-29T01:53:51.909Z');
  expect(
    ZExerciseUpdate.safeParse({
      isExam: true,
      opensAt: exercise.opensAt,
      closesAt: exercise.closesAt,
      allowMakeup: true
    }).success
  ).toBe(true);
});
