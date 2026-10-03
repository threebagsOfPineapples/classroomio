import type { MyTrainingAssignments } from '$features/enterprise/utils/types';
import type { ExamAccess, LMSExercises } from './types';
import { getExamState, getLatestSubmission } from './assessment-tasks';

export function getPendingTraining(assignments: MyTrainingAssignments) {
  return assignments
    .filter(
      (assignment) =>
        assignment.planStatus === 'PUBLISHED' &&
        !['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(assignment.enrollmentStatus)
    )
    .sort((left, right) => Date.parse(left.endAt) - Date.parse(right.endAt));
}

export function getHomeExams(
  assignments: MyTrainingAssignments,
  exercises: LMSExercises,
  access: ExamAccess,
  now: number
) {
  const exams = new Map(
    getPendingTraining(assignments)
      .flatMap((assignment) => assignment.exams)
      .map((exam) => [exam.id, exam])
  );
  return [...exams.values()]
    .map((exam) => {
      const exercise = exercises.find((item) => item.id === exam.id);
      const submission = getLatestSubmission(exercise?.submission ?? []);
      const window = { ...exam, ...exercise };
      const state = getExamState(window, submission, access[exam.id], now);
      const opensAt = window.opensAt ?? exam.opensAt;
      const closesAt = window.closesAt ?? exam.closesAt;

      return { ...exam, opensAt, closesAt, state };
    })
    .sort((left, right) => Date.parse(left.closesAt) - Date.parse(right.closesAt));
}
