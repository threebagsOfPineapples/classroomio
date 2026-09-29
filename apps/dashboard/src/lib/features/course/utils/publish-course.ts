import { courseApi } from '$features/course/api';
import type { Course } from '$features/course/utils/types';
import { isCourseMissingComplianceDeadline } from './compliance-deadline';

export type PublishCourseResult = { ok: true } | { ok: false; reason: 'missing_deadline' | 'failed' };

export async function publishCourse(course: Pick<Course, 'id' | 'type' | 'certificate'>): Promise<PublishCourseResult> {
  if (!course?.id) {
    return { ok: false, reason: 'failed' };
  }

  if (isCourseMissingComplianceDeadline(course)) {
    return { ok: false, reason: 'missing_deadline' };
  }

  const result = await courseApi.update(course.id, { isPublished: true }, { showSuccessToast: true });
  if (!result) {
    if (courseApi.errors['certificate.deadline']) {
      return { ok: false, reason: 'missing_deadline' };
    }

    return { ok: false, reason: 'failed' };
  }

  return { ok: true };
}
