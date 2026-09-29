import type { Context, Next } from 'hono';
import { getLessonById } from '@cio/db/queries/lesson';
import { handleError } from '@api/utils/errors';
import { z } from 'zod';

const lessonPath = z.object({ lessonId: z.uuid(), courseId: z.uuid() });

export async function lessonCourseMiddleware(c: Context, next: Next) {
  try {
    const lessonId = c.req.param('lessonId');
    const courseId = c.req.param('courseId');
    if (!lessonPath.safeParse({ lessonId, courseId }).success) {
      return c.json({ success: false, error: '课程或课时编号无效', code: 'INVALID_PARAMS' }, 400);
    }

    const lesson = await getLessonById(lessonId!);
    if (!lesson || lesson.courseId !== courseId) {
      return c.json({ success: false, error: '当前课程中不存在该课时', code: 'LESSON_NOT_FOUND' }, 404);
    }

    return next();
  } catch (error) {
    return handleError(c, error, '无法验证课时所属课程');
  }
}
