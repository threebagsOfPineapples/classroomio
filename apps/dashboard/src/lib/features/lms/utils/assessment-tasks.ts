import type { MyTrainingAssignments } from '$features/enterprise/utils/types';
import type {
  AssessmentTask,
  AssessmentTaskAction,
  AssessmentTaskFilter,
  AssessmentTaskState,
  ExamAccess,
  ExamWindow,
  LMSExercise,
  LMSExercises,
  LMSSubmission
} from './types';

export function getLatestSubmission(submissions: LMSExercise['submission']) {
  return [...submissions].sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at))[0];
}

export function getExamState(
  exam: ExamWindow,
  submission: LMSSubmission | undefined,
  access: ExamAccess[string] | undefined,
  now: number
): AssessmentTaskState {
  const hasActiveAttempt = !!exam.activeAttemptExpiresAt && Date.parse(exam.activeAttemptExpiresAt) > now;
  const canRetake = exam.canAttempt === true || hasActiveAttempt;
  if (!canRetake && submission?.status_id === 3) return 'graded';
  if (!canRetake && (submission?.status_id === 1 || submission?.status_id === 2)) return 'submitted';

  const opensAt = exam.opensAt ? Date.parse(exam.opensAt) : NaN;
  const closesAt = exam.closesAt ? Date.parse(exam.closesAt) : NaN;
  if (!Number.isFinite(opensAt) || !Number.isFinite(closesAt)) return 'unknown';
  if (closesAt <= now) return 'ended';
  if (opensAt > now) return 'upcoming';
  if (exam.canAttempt === false && !hasActiveAttempt) return 'unavailable';
  if (access === 'allowed') return hasActiveAttempt ? 'in_progress' : 'open';
  if (access === 'denied') return 'unavailable';

  return 'unknown';
}

export function getAssessmentTask(
  exercise: LMSExercise,
  access: ExamAccess[string] | undefined,
  now: number
): AssessmentTask {
  const submission = getLatestSubmission(exercise.submission);
  const submissionState =
    submission?.status_id === 3
      ? 'graded'
      : submission?.status_id === 1
        ? 'submitted'
        : submission?.status_id === 2
          ? 'grading'
          : 'not_submitted';
  const hasSubmission = submissionState !== 'not_submitted';
  const state: AssessmentTaskState = exercise.isExam
    ? getExamState(exercise, submission, access, now)
    : hasSubmission
      ? submissionState === 'graded'
        ? 'graded'
        : 'submitted'
      : access === 'denied'
        ? 'unavailable'
        : access === 'allowed'
          ? 'open'
          : 'unknown';
  let action: AssessmentTaskAction | null = null;
  if (access === 'allowed') {
    if (state === 'in_progress') action = 'continue';
    else if (state === 'open') action = hasSubmission ? 'retake' : 'start';
    else if (hasSubmission) action = 'result';
  }

  const href = `/courses/${exercise.lesson.course.id}/exercises/${exercise.id}`;
  const totalPoints = exercise.questions.reduce((total, question) => total + question.points, 0);
  const accessState = access ?? 'unknown';
  return { exercise, submission, state, submissionState, action, access: accessState, href, totalPoints };
}

export function getAssessmentTasks(exercises: LMSExercises, access: ExamAccess, now: number) {
  const priority: Record<AssessmentTaskState, number> = {
    in_progress: 0,
    open: 1,
    unknown: 2,
    unavailable: 3,
    upcoming: 4,
    submitted: 5,
    graded: 6,
    ended: 7
  };
  return exercises
    .map((exercise) => getAssessmentTask(exercise, access[exercise.id], now))
    .sort((left, right) => {
      const statusDifference = priority[left.state] - priority[right.state];
      if (statusDifference) return statusDifference;

      const leftDue = left.exercise.closesAt ?? left.exercise.dueBy;
      const rightDue = right.exercise.closesAt ?? right.exercise.dueBy;
      return (leftDue ? Date.parse(leftDue) : Infinity) - (rightDue ? Date.parse(rightDue) : Infinity);
    });
}

export function filterAssessmentTasks(tasks: AssessmentTask[], filter: AssessmentTaskFilter, search = '') {
  const query = search.trim().toLocaleLowerCase();
  return tasks.filter((task) => {
    const matchesSearch =
      !query || `${task.exercise.title} ${task.exercise.lesson.course.title}`.toLocaleLowerCase().includes(query);
    const matchesState =
      filter === 'all' ||
      (filter === 'pending' && ['open', 'in_progress', 'unknown', 'unavailable'].includes(task.state)) ||
      (filter === 'upcoming' && task.state === 'upcoming') ||
      (filter === 'submitted' && ['submitted', 'grading'].includes(task.submissionState)) ||
      (filter === 'graded' && task.submissionState === 'graded');
    return matchesSearch && matchesState;
  });
}

export function getExerciseAccessTargets(exercises: LMSExercises, assignments: MyTrainingAssignments, now: number) {
  const candidates = new Map(
    assignments
      .flatMap((assignment) => assignment.exams)
      .filter((exam) => Date.parse(exam.opensAt) <= now && Date.parse(exam.closesAt) > now)
      .map((exam) => [exam.id, { id: exam.id, courseId: exam.courseId }])
  );
  for (const exercise of exercises) {
    const submission = getLatestSubmission(exercise.submission);
    const hasSubmission = !!submission && [1, 2, 3].includes(submission.status_id);
    const isOpen =
      !!exercise.opensAt &&
      !!exercise.closesAt &&
      Date.parse(exercise.opensAt) <= now &&
      Date.parse(exercise.closesAt) > now;
    if (!exercise.isExam || isOpen || hasSubmission) {
      candidates.set(exercise.id, { id: exercise.id, courseId: exercise.lesson.course.id });
    }
  }

  return [...candidates.values()];
}
