import type { UserEnrolledCourses } from '../types';
import { getStudentCourseProgressPercent, isStudentCourseComplete } from './compliance-utils';
import { getStudentCourseContinuePath } from './student-course-navigation';

export function getCourseLearningState(course: UserEnrolledCourses[number]) {
  if (isStudentCourseComplete(course)) return 'completed';

  return (course.progressRate ?? 0) > 0 || (course.exercisesCompleted ?? 0) > 0 ? 'in_progress' : 'not_started';
}

export function getCourseLearningAction(course: UserEnrolledCourses[number]) {
  const state = getCourseLearningState(course);
  if (state === 'completed') return { key: 'enterprise.ui_v2.review_course', href: `/courses/${course.id}/lessons` };

  if (getStudentCourseProgressPercent(course) >= 100) {
    return { key: 'enterprise.ui_v2.view_assessment', href: `/courses/${course.id}/exercises` };
  }

  const key = state === 'in_progress' ? 'enterprise.ui_v2.continue_course' : 'enterprise.ui_v2.start_course';
  const href = getStudentCourseContinuePath(course.id);
  return { key, href };
}

export function filterLearningCourses(courses: UserEnrolledCourses, filter: string, search = '') {
  const query = search.trim().toLocaleLowerCase();
  return courses
    .filter((course) => {
      const state = getCourseLearningState(course);
      const matchesState = filter === 'all' || (filter === 'pending' ? state !== 'completed' : state === filter);
      return matchesState && course.title.toLocaleLowerCase().includes(query);
    })
    .sort((left, right) => {
      const priority = { in_progress: 0, not_started: 1, completed: 2 };
      return priority[getCourseLearningState(left)] - priority[getCourseLearningState(right)];
    });
}
