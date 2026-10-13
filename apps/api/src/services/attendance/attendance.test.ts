import { beforeEach, describe, expect, it, vi } from 'vitest';

const queries = vi.hoisted(() => ({
  manager: vi.fn(),
  lesson: vi.fn(),
  student: vi.fn(),
  upsert: vi.fn()
}));

vi.mock('@cio/db/queries/group', () => ({ isCourseTeamMemberOrOrgAdmin: queries.manager }));
vi.mock('@cio/db/queries/lesson', () => ({ getLessonById: queries.lesson }));
vi.mock('@cio/db/queries/attendance', () => ({
  getActiveAttendanceStudent: queries.student,
  getAttendanceByCourseId: vi.fn(),
  upsertAttendance: queries.upsert
}));

import { AppError, ErrorCodes } from '@api/utils/errors';
import { upsertAttendanceService } from './attendance';

const attendance = {
  courseId: 'course-a',
  lessonId: 'lesson-a',
  studentId: 'student-a',
  isPresent: true
};

beforeEach(() => {
  vi.clearAllMocks();
  queries.manager.mockResolvedValue(true);
  queries.lesson.mockResolvedValue({ id: 'lesson-a', courseId: 'course-a' });
  queries.student.mockResolvedValue({ id: 'student-a' });
  queries.upsert.mockImplementation(async (data) => ({ id: 1, ...data }));
});

describe('manual attendance authorization', () => {
  it('rejects a body course that differs from the authenticated route scope', async () => {
    await expect(upsertAttendanceService('course-b', 'teacher-a', attendance)).rejects.toMatchObject({
      statusCode: 400,
      field: 'courseId'
    });
    expect(queries.manager).not.toHaveBeenCalled();
    expect(queries.upsert).not.toHaveBeenCalled();
  });

  it.each(['student-a', 'inactive-teacher', 'other-org-admin'])(
    'rejects %s without course management permission',
    async (profileId) => {
      queries.manager.mockResolvedValue(false);

      await expect(upsertAttendanceService('course-a', profileId, attendance)).rejects.toMatchObject({
        statusCode: 403
      });
      expect(queries.manager).toHaveBeenCalledWith('course-a', profileId);
      expect(queries.student).not.toHaveBeenCalled();
      expect(queries.upsert).not.toHaveBeenCalled();
    }
  );

  it.each([null, { id: 'lesson-a', courseId: 'course-b' }])('rejects a missing or foreign lesson', async (lesson) => {
    queries.lesson.mockResolvedValue(lesson);

    await expect(upsertAttendanceService('course-a', 'teacher-a', attendance)).rejects.toMatchObject({
      statusCode: 404,
      field: 'lessonId'
    });
    expect(queries.student).not.toHaveBeenCalled();
    expect(queries.upsert).not.toHaveBeenCalled();
  });

  it('rejects a student without an active student membership in the route course', async () => {
    queries.student.mockResolvedValue(null);

    await expect(upsertAttendanceService('course-a', 'teacher-a', attendance)).rejects.toMatchObject({
      statusCode: 404,
      field: 'studentId'
    });
    expect(queries.student).toHaveBeenCalledWith('course-a', 'student-a');
    expect(queries.upsert).not.toHaveBeenCalled();
  });

  it.each(['teacher-a', 'org-admin-a'])('lets an authorized %s set present and absent', async (profileId) => {
    for (const isPresent of [true, false]) {
      const data = { ...attendance, isPresent };
      const result = await upsertAttendanceService('course-a', profileId, data);

      expect(result).toMatchObject({ id: 1, ...data });
      expect(queries.upsert).toHaveBeenLastCalledWith(data);
    }
  });

  it('preserves application errors from query boundaries', async () => {
    const error = new AppError('Access revoked', ErrorCodes.UNAUTHORIZED, 403);
    queries.manager.mockRejectedValue(error);

    await expect(upsertAttendanceService('course-a', 'teacher-a', attendance)).rejects.toBe(error);
    expect(queries.upsert).not.toHaveBeenCalled();
  });

  it('wraps unexpected query failures as an internal error', async () => {
    queries.upsert.mockRejectedValue(new Error('Database unavailable'));

    await expect(upsertAttendanceService('course-a', 'teacher-a', attendance)).rejects.toMatchObject({
      statusCode: 500,
      code: ErrorCodes.INTERNAL_ERROR
    });
  });
});
