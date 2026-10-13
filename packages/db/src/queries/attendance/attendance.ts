import * as schema from '@db/schema';

import type { TGroupAttendance, TNewGroupAttendance } from '@db/types';
import { and, db, eq, isNotNull, isNull, or, sql } from '@db/drizzle';
import { ROLE } from '@cio/utils/constants';

export async function getActiveAttendanceStudent(courseId: string, studentId: string) {
  try {
    const [student] = await db
      .select({ id: schema.groupmember.id })
      .from(schema.course)
      .innerJoin(schema.group, eq(schema.course.groupId, schema.group.id))
      .innerJoin(schema.groupmember, eq(schema.groupmember.groupId, schema.group.id))
      .leftJoin(
        schema.organizationmember,
        and(
          eq(schema.organizationmember.organizationId, schema.group.organizationId),
          eq(schema.organizationmember.profileId, schema.groupmember.profileId),
          eq(schema.organizationmember.status, 'ACTIVE'),
          sql`${schema.organizationmember.employmentStatus} IS DISTINCT FROM 'TERMINATED'`
        )
      )
      .where(
        and(
          eq(schema.course.id, courseId),
          eq(schema.groupmember.id, studentId),
          eq(schema.groupmember.roleId, ROLE.STUDENT),
          isNotNull(schema.groupmember.profileId),
          or(isNull(schema.group.organizationId), isNotNull(schema.organizationmember.id))
        )
      )
      .limit(1);

    return student ?? null;
  } catch (error) {
    console.error('getActiveAttendanceStudent error:', error);
    throw new Error(
      `Failed to get active attendance student: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Gets attendance records by course ID
 * @param courseId Course ID
 * @param lessonId Optional lesson ID filter
 * @returns Array of attendance records
 */
export async function getAttendanceByCourseId(courseId: string, lessonId?: string): Promise<TGroupAttendance[]> {
  try {
    if (lessonId) {
      return db
        .select()
        .from(schema.groupAttendance)
        .where(and(eq(schema.groupAttendance.courseId, courseId), eq(schema.groupAttendance.lessonId, lessonId)));
    }
    return db.select().from(schema.groupAttendance).where(eq(schema.groupAttendance.courseId, courseId));
  } catch (error) {
    console.error('getAttendanceByCourseId error:', error);
    throw new Error(
      `Failed to get attendance by course ID "${courseId}": ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Gets attendance record for a specific student and lesson
 * @param courseId Course ID
 * @param lessonId Lesson ID
 * @param studentId Student (group member) ID
 * @returns Attendance record or null
 */
export async function getAttendanceByStudentAndLesson(
  courseId: string,
  lessonId: string,
  studentId: string
): Promise<TGroupAttendance | null> {
  try {
    const [attendance] = await db
      .select()
      .from(schema.groupAttendance)
      .where(
        and(
          eq(schema.groupAttendance.courseId, courseId),
          eq(schema.groupAttendance.lessonId, lessonId),
          eq(schema.groupAttendance.studentId, studentId)
        )
      )
      .limit(1);
    return attendance || null;
  } catch (error) {
    console.error('getAttendanceByStudentAndLesson error:', error);
    throw new Error(`Failed to get attendance: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Creates or updates an attendance record
 * @param data Attendance data
 * @returns Created or updated attendance record
 */
export async function upsertAttendance(data: TNewGroupAttendance): Promise<TGroupAttendance> {
  try {
    // Check if record exists
    const existing = await getAttendanceByStudentAndLesson(data.courseId!, data.lessonId, data.studentId!);

    if (existing) {
      // Update existing record
      const [updated] = await db
        .update(schema.groupAttendance)
        .set({
          isPresent: data.isPresent,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.groupAttendance.id, existing.id))
        .returning();
      if (!updated) {
        throw new Error('Failed to update attendance');
      }
      return updated;
    } else {
      // Create new record
      const [created] = await db.insert(schema.groupAttendance).values(data).returning();
      if (!created) {
        throw new Error('Failed to create attendance');
      }
      return created;
    }
  } catch (error) {
    console.error('upsertAttendance error:', error);
    throw new Error(`Failed to upsert attendance: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
