import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ upsert: vi.fn(), authenticated: true }));

vi.mock('@api/middlewares/course-member', () => ({
  courseMemberMiddleware: async (_context: unknown, next: () => Promise<void>) => next()
}));
vi.mock('@api/services/attendance', () => ({ upsertAttendanceService: state.upsert }));

import { AppError, ErrorCodes } from '@api/utils/errors';
import { attendanceRouter } from './attendance';

const app = new Hono<{ Variables: { user: { id: string }; session: { id: string } } }>()
  .use('*', async (context, next) => {
    if (state.authenticated) {
      context.set('user', { id: 'authenticated-teacher' });
      context.set('session', { id: 'session-a' });
    }

    await next();
  })
  .route('/course/:courseId/attendance', attendanceRouter);

const attendance = { courseId: 'course-a', lessonId: 'lesson-a', studentId: 'student-a', isPresent: true };

function request(body: unknown = attendance) {
  return app.request('/course/course-a/attendance', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.authenticated = true;
  state.upsert.mockResolvedValue({ id: 1, ...attendance });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('manual attendance route', () => {
  it('passes the authenticated actor and route course to the service', async () => {
    const response = await request();

    expect(response.status).toBe(201);
    expect(state.upsert).toHaveBeenCalledWith('course-a', 'authenticated-teacher', attendance);
    await expect(response.json()).resolves.toMatchObject({ success: true, data: { id: 1, isPresent: true } });
  });

  it('does not trust an actor supplied in the body', async () => {
    const response = await request({ ...attendance, profileId: 'forged-admin' });

    expect(response.status).toBe(201);
    expect(state.upsert).toHaveBeenCalledWith('course-a', 'authenticated-teacher', attendance);
  });

  it.each([400, 403, 404])('preserves a service application error with status %s', async (statusCode) => {
    state.upsert.mockRejectedValue(new AppError('Attendance rejected', ErrorCodes.VALIDATION_ERROR, statusCode));
    const response = await request();

    expect(response.status).toBe(statusCode);
    await expect(response.json()).resolves.toMatchObject({ success: false, error: 'Attendance rejected' });
  });

  it('requires authentication before attendance writes', async () => {
    state.authenticated = false;
    const response = await request();

    expect(response.status).toBe(401);
    expect(state.upsert).not.toHaveBeenCalled();
  });

  it('rejects an invalid present flag before attendance writes', async () => {
    const response = await request({ ...attendance, isPresent: 'true' });

    expect(response.status).toBe(400);
    expect(state.upsert).not.toHaveBeenCalled();
  });
});
