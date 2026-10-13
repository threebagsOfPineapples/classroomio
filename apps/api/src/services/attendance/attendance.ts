import { AppError, ErrorCodes } from '@api/utils/errors';
import { getActiveAttendanceStudent, getAttendanceByCourseId, upsertAttendance } from '@cio/db/queries/attendance';
import { isCourseTeamMemberOrOrgAdmin } from '@cio/db/queries/group';
import { getLessonById } from '@cio/db/queries/lesson';
import type { TGroupAttendance, TNewGroupAttendance } from '@cio/db/types';
import type { TAttendanceUpsert } from '@cio/utils/validation/attendance';

/**
 * Lists attendance records for a course
 * @param courseId Course ID
 * @param lessonId Optional lesson ID filter
 * @returns Array of attendance records
 */
export async function listAttendance(courseId: string, lessonId?: string): Promise<TGroupAttendance[]> {
  try {
    return await getAttendanceByCourseId(courseId, lessonId);
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Failed to list attendance',
      ErrorCodes.INTERNAL_ERROR,
      500
    );
  }
}

export async function upsertAttendanceService(
  courseId: string,
  profileId: string,
  data: TAttendanceUpsert
): Promise<TGroupAttendance> {
  try {
    if (data.courseId !== courseId) {
      throw new AppError('Attendance course must match the route course', ErrorCodes.VALIDATION_ERROR, 400, 'courseId');
    }

    const canManageAttendance = await isCourseTeamMemberOrOrgAdmin(courseId, profileId);
    if (!canManageAttendance) {
      throw new AppError(
        'Only course team members or organization admins can manage attendance',
        ErrorCodes.UNAUTHORIZED,
        403
      );
    }

    const lesson = await getLessonById(data.lessonId);
    if (!lesson || lesson.courseId !== courseId) {
      throw new AppError('Lesson not found in this course', ErrorCodes.NOT_FOUND, 404, 'lessonId');
    }

    const student = await getActiveAttendanceStudent(courseId, data.studentId);
    if (!student) {
      throw new AppError('Active student not found in this course', ErrorCodes.NOT_FOUND, 404, 'studentId');
    }

    const attendanceData: TNewGroupAttendance = {
      courseId,
      lessonId: data.lessonId,
      studentId: data.studentId,
      isPresent: data.isPresent
    };

    return await upsertAttendance(attendanceData);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      error instanceof Error ? error.message : 'Failed to upsert attendance',
      ErrorCodes.INTERNAL_ERROR,
      500
    );
  }
}
