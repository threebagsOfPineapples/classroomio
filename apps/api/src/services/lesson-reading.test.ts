import { describe, expect, it, vi, beforeEach } from 'vitest';
vi.mock('@cio/db/queries/lesson', () => ({
  getLessonById: vi.fn(),
  recordLessonReading: vi.fn(),
  upsertLessonCompletion: vi.fn()
}));
import { getLessonById, recordLessonReading, upsertLessonCompletion } from '@cio/db/queries/lesson';
import { recordLessonReadingProgress } from './lesson-reading';

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getLessonById).mockResolvedValue({
    courseId: 'course',
    completionPolicy: 'manual',
    lessonLanguages: [{ locale: 'zh', content: '阅读' }]
  } as any);
  vi.mocked(recordLessonReading).mockResolvedValue({
    readingSeconds: 60,
    readingResources: ['note'],
    isComplete: false
  } as any);
});
describe('reading completion service', () => {
  it('rejects a lesson outside the supplied course before writing progress', async () => {
    await expect(
      recordLessonReadingProgress('other', 'lesson', 'student', { active: true, resources: ['note'] })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(recordLessonReading).not.toHaveBeenCalled();
  });
  it('filters invented resource identifiers and writes completion from accumulated evidence', async () => {
    const result = await recordLessonReadingProgress('course', 'lesson', 'student', {
      active: true,
      resources: ['note', 'invented']
    });
    expect(recordLessonReading).toHaveBeenCalledWith('lesson', 'student', true, ['note']);
    expect(upsertLessonCompletion).toHaveBeenCalledWith({ lessonId: 'lesson', profileId: 'student', isComplete: true });
    expect(result.didJustComplete).toBe(true);
  });
  it('does not complete an unread or insufficiently timed lesson', async () => {
    vi.mocked(recordLessonReading).mockResolvedValue({
      readingSeconds: 5,
      readingResources: ['note'],
      isComplete: false
    } as any);
    const result = await recordLessonReadingProgress('course', 'lesson', 'student', {
      active: false,
      resources: ['note']
    });
    expect(recordLessonReading).toHaveBeenCalledWith('lesson', 'student', false, []);
    expect(upsertLessonCompletion).not.toHaveBeenCalled();
    expect(result.isComplete).toBe(false);
  });
});
