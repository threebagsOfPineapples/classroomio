import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/utils/services/api/types';
import type { MyTrainingAssignments } from '$features/enterprise/utils/types';

const fetchExercise = vi.hoisted(() => vi.fn());
vi.mock('$lib/utils/services/api', async () => {
  const { BaseApiWithErrors } = await import('$lib/utils/services/api/base.svelte');
  const classroomio = { course: { ':courseId': { exercise: { ':exerciseId': { $get: fetchExercise } } } } };
  return { BaseApiWithErrors, classroomio };
});
vi.mock('$lib/utils/functions/translations', () => ({ t: { get: (key: string) => key } }));

import { LMSExercisesApi } from './exercises.svelte';

const assignments = [
  { exams: [{ id: 'exam', courseId: 'course', opensAt: '2000-01-01', closesAt: '2100-01-01' }] }
] as MyTrainingAssignments;

describe('learner task access failures', () => {
  beforeEach(() => {
    fetchExercise.mockReset();
  });

  it.each([403, 404])('treats an ApiError with status %s as denied access', async (status) => {
    fetchExercise.mockRejectedValueOnce(new ApiError('Restricted', status));
    const api = new LMSExercisesApi();
    await api.fetchExamAccess(assignments);
    expect(api.examAccess).toEqual({ exam: 'denied' });
    expect(api.accessLoading).toBe(false);
  });

  it('keeps transient failures retryable and restores allowed access after recovery', async () => {
    fetchExercise.mockRejectedValueOnce(new ApiError('Unavailable', 500));
    const api = new LMSExercisesApi();
    await api.fetchExamAccess(assignments);
    expect(api.examAccess).toEqual({ exam: 'unknown' });
    fetchExercise.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: {} }), { status: 200 }));
    await api.fetchExamAccess(assignments);
    expect(api.examAccess).toEqual({ exam: 'allowed' });
    expect(api.accessLoading).toBe(false);
  });
});
