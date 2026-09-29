import { getLessonsByCourseId, getLessonLanguagesByLessonIds } from '@cio/db/queries/lesson';
import { db, type DbOrTxClient } from '@cio/db/drizzle';
import { AppError, ErrorCodes } from '@cio/utils/errors';
import { getReadingRequirements } from '@cio/utils/functions/lesson-reading';
import { resolveWatchEnforcedAssetIds } from '../../utils/lesson-watch-enforcement';

export async function assertCourseCompletionReady(courseId: string, client: DbOrTxClient = db): Promise<void> {
  const lessons = await getLessonsByCourseId(courseId, client);
  const languages = await getLessonLanguagesByLessonIds(
    lessons.map((lesson) => lesson.id),
    client
  );
  for (const lesson of lessons) {
    if (lesson.completionPolicy === 'none') continue;

    if (lesson.completionPolicy === 'video_watch') {
      if (resolveWatchEnforcedAssetIds(lesson.videos, lesson.completionPolicy).length > 0) continue;

      throw new AppError(
        `课时“${lesson.title}”无法判定观看完成：请上传可追踪的视频并配置观看要求后再发布。`,
        ErrorCodes.VALIDATION_ERROR,
        400
      );
    }

    const lessonLanguages = languages.filter((language) => language.lessonId === lesson.id);
    const requirements = getReadingRequirements({ ...lesson, lessonLanguages });
    if (requirements.supported) continue;

    throw new AppError(
      `课时“${lesson.title}”无法判定阅读完成：请补充正文或 PDF；视频课时请设置视频观看判定，其他课件请转换为 PDF 或拆分课时后再发布。`,
      ErrorCodes.VALIDATION_ERROR,
      400
    );
  }
}
