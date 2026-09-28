import { expect, it, vi } from 'vitest';
import { assertExamCourse } from './exam-policy';
import { getExamCourseId } from '@cio/db/queries/exercise';

vi.mock('@cio/db/queries/exercise', () => ({
  getExamCourseId: vi.fn(),
  getExerciseWithRelationsOptimized: vi.fn(),
  saveExamDraft: vi.fn(),
  startExamAttempt: vi.fn()
}));

it('rejects a foreign or missing exercise before reading its answer keys', async () => {
  vi.mocked(getExamCourseId).mockResolvedValue('source-course');
  await expect(assertExamCourse('source-course', 'exercise')).resolves.toBeUndefined();
  await expect(assertExamCourse('other-course', 'exercise')).rejects.toMatchObject({ statusCode: 403 });
  vi.mocked(getExamCourseId).mockResolvedValue(null);
  await expect(assertExamCourse('source-course', 'missing')).rejects.toMatchObject({ statusCode: 403 });
});
