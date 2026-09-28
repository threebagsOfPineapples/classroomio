import type { MyTrainingAssignments } from '$features/enterprise/utils/types';
import type { ExamAccess, LMSExercises } from './types';

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
      const submission = [...(exercise?.submission ?? [])].sort(
        (left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at)
      )[0];
      let state = 'unknown';
      if (submission?.status_id === 3) state = 'graded';
      else if (submission?.status_id === 1) state = 'submitted';
      else if (Date.parse(exam.closesAt) <= now) state = 'ended';
      else if (Date.parse(exam.opensAt) > now) state = 'upcoming';
      else if (access[exam.id] === 'allowed') state = submission?.status_id === 2 ? 'in_progress' : 'open';
      else if (access[exam.id] === 'denied') state = 'unavailable';

      return { ...exam, state };
    })
    .sort((left, right) => Date.parse(left.closesAt) - Date.parse(right.closesAt));
}
