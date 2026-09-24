import type { UserEnrolledCourses } from '$features/course/types';
import { getStudentCourseProgressPercent, isStudentCourseComplete } from '$features/course/utils/compliance-utils';
import type { MyTrainingAssignment } from './types';

type EnrolledCourse = UserEnrolledCourses[number];

export function getTrainingCourseProgress(course: EnrolledCourse | undefined) {
  if (!course) return null;
  if (isStudentCourseComplete(course)) return 100;

  const trackableCount = (course.lessonCount ?? 0) + (course.exerciseCount ?? 0);
  if (trackableCount === 0) return null;

  return getStudentCourseProgressPercent(course);
}

export function getTrainingPlanProgress(assignment: MyTrainingAssignment, enrolledCourses: UserEnrolledCourses) {
  if (assignment.courses.length === 0) return null;

  const enrolledById = new Map(enrolledCourses.map((course) => [course.id, course]));
  const percentages = assignment.courses.map((course) => getTrainingCourseProgress(enrolledById.get(course.id)));
  if (percentages.some((percentage) => percentage === null)) return null;

  const total = percentages.reduce<number>((sum, percentage) => sum + percentage!, 0);
  return Math.round(total / percentages.length);
}
