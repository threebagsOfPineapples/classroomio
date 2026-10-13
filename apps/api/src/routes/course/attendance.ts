import { Hono } from '@api/utils/hono';
import { ZAttendanceUpsert } from '@cio/utils/validation/attendance';
import { authMiddleware } from '@api/middlewares/auth';
import { courseMemberMiddleware } from '@api/middlewares/course-member';
import { handleError } from '@api/utils/errors';
import { upsertAttendanceService } from '@api/services/attendance';
import { zValidator } from '@hono/zod-validator';

export const attendanceRouter = new Hono().post(
  '/',
  authMiddleware,
  courseMemberMiddleware,
  zValidator('json', ZAttendanceUpsert),
  async (c) => {
    try {
      const data = c.req.valid('json');
      const courseId = c.req.param('courseId')!;
      const profileId = c.get('user')!.id;
      const attendance = await upsertAttendanceService(courseId, profileId, data);

      return c.json({ success: true, data: attendance }, 201);
    } catch (error) {
      return handleError(c, error, 'Failed to upsert attendance');
    }
  }
);
