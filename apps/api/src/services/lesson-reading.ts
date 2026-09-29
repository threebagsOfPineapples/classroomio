import { getLessonById, recordLessonReading, upsertLessonCompletion } from '@cio/db/queries/lesson';
import { AppError, ErrorCodes } from '@api/utils/errors';
import { getReadingRequirements, isReadingComplete } from './lesson-reading-rules';

export async function recordLessonReadingProgress(
  courseId: string,
  lessonId: string,
  profileId: string,
  input: { active: boolean; resources: string[] }
) {
  const lesson = await getLessonById(lessonId);
  if (!lesson || lesson.courseId !== courseId) {
    throw new AppError('课时不存在', ErrorCodes.LESSON_NOT_FOUND, 404);
  }

  const requirements = getReadingRequirements(lesson);
  const resources = input.active ? input.resources.filter((resource) => requirements.resources.includes(resource)) : [];
  const progress = await recordLessonReading(lessonId, profileId, input.active && requirements.supported, resources);
  const complete = isReadingComplete(requirements, progress.readingSeconds, progress.readingResources);
  const didJustComplete = complete && !progress.isComplete;
  if (didJustComplete) {
    await upsertLessonCompletion({ lessonId, profileId, isComplete: true });
  }

  return {
    seconds: progress.readingSeconds,
    requiredSeconds: requirements.requiredSeconds,
    reachedEnd:
      requirements.resources.length > 0 &&
      requirements.resources.every((resource) => progress.readingResources.includes(resource)),
    supported: requirements.supported,
    isComplete: Boolean(progress.isComplete || complete),
    didJustComplete
  };
}
