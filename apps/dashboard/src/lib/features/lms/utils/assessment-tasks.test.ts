import { describe, expect, it } from 'vitest';
import type { MyTrainingAssignments } from '$features/enterprise/utils/types';
import type { LMSExercise, LMSSubmission } from './types';
import {
  filterAssessmentTasks,
  getAssessmentTask,
  getAssessmentTasks,
  getExerciseAccessTargets
} from './assessment-tasks';
import { getHomeExams } from './home-model';

const now = Date.parse('2026-10-02T02:00:00Z');

function exercise(overrides: Partial<LMSExercise> = {}): LMSExercise {
  return {
    id: 'exam',
    title: 'Safety exam',
    updated_at: '2026-10-01T00:00:00Z',
    isExam: true,
    opensAt: '2026-10-02T01:00:00Z',
    closesAt: '2026-10-02T03:00:00Z',
    dueBy: null,
    durationMinutes: 30,
    maxAttempts: 1,
    allowMakeup: false,
    attemptCount: 0,
    activeAttemptExpiresAt: null,
    canAttempt: true,
    questions: [{ points: 10 }],
    submission: [],
    lesson: {
      id: 'lesson',
      title: 'Safety',
      order: 1,
      course: { id: 'course', title: 'Onboarding', group: [], groupmember: [] }
    },
    ...overrides
  };
}

function submission(status_id: number, updated_at = '2026-10-02T01:30:00Z'): LMSSubmission {
  return { status_id, updated_at, total: 8, groupmember: [] };
}

describe('learner assessment tasks', () => {
  it('separates exam time, permission and attempt availability at exact boundaries', () => {
    const openExam = exercise();
    expect(getAssessmentTask(openExam, 'allowed', Date.parse(openExam.opensAt!))).toMatchObject({
      state: 'open',
      action: 'start'
    });
    expect(getAssessmentTask(openExam, 'allowed', Date.parse(openExam.closesAt!))).toMatchObject({
      state: 'ended',
      action: null
    });
    expect(getAssessmentTask(openExam, 'allowed', Date.parse(openExam.opensAt!) - 1)).toMatchObject({
      state: 'upcoming',
      action: null
    });
    expect(getAssessmentTask(openExam, 'denied', now)).toMatchObject({ state: 'unavailable', action: null });
    expect(getAssessmentTask(openExam, undefined, now)).toMatchObject({ state: 'unknown', action: null });
    expect(getAssessmentTask(exercise({ canAttempt: false }), 'allowed', now)).toMatchObject({
      state: 'unavailable',
      action: null
    });
  });

  it('keeps a current attempt resumable and uses the latest submission', () => {
    const inProgress = exercise({
      canAttempt: false,
      activeAttemptExpiresAt: '2026-10-02T02:30:00Z',
      submission: [submission(2, '2026-10-02T01:50:00Z'), submission(3)]
    });
    expect(getAssessmentTask(inProgress, 'allowed', now)).toMatchObject({
      state: 'in_progress',
      action: 'continue',
      submissionState: 'grading'
    });
    expect(
      getAssessmentTask(exercise({ submission: [submission(1)], canAttempt: false }), 'allowed', now)
    ).toMatchObject({ state: 'submitted', action: 'result' });
    expect(
      getAssessmentTask(exercise({ submission: [submission(3)], canAttempt: true }), 'allowed', now)
    ).toMatchObject({ state: 'open', action: 'retake', submissionState: 'graded', totalPoints: 10 });
    expect(
      getAssessmentTask(exercise({ submission: [submission(3)], canAttempt: false }), 'denied', now)
    ).toMatchObject({ state: 'graded', action: null });
  });

  it('treats status 2 written-answer submissions as awaiting grading instead of resumable drafts', () => {
    const awaitingGrading = exercise({ canAttempt: false, submission: [submission(2)] });
    expect(getAssessmentTask(awaitingGrading, 'allowed', now)).toMatchObject({
      state: 'submitted',
      action: 'result',
      submissionState: 'grading'
    });
    expect(getAssessmentTask({ ...awaitingGrading, isExam: false }, 'allowed', now)).toMatchObject({
      state: 'submitted',
      action: 'result'
    });
    const tasks = getAssessmentTasks([awaitingGrading], { exam: 'allowed' }, now);
    expect(filterAssessmentTasks(tasks, 'pending')).toEqual([]);
    expect(filterAssessmentTasks(tasks, 'submitted')).toHaveLength(1);
    const closed = exercise({ closesAt: '2026-10-01T00:00:00Z', canAttempt: false, submission: [submission(2)] });
    expect(getExerciseAccessTargets([closed], [], now)).toEqual([{ id: 'exam', courseId: 'course' }]);
  });

  it('keeps assignments usable without an exam window and filters submission history separately from retakes', () => {
    const tasks = getAssessmentTasks(
      [
        exercise({
          id: 'assignment',
          title: 'Reflection',
          isExam: false,
          opensAt: null,
          closesAt: null,
          dueBy: '2026-10-03T00:00:00Z',
          canAttempt: false
        }),
        exercise({ id: 'retake', submission: [submission(3)] }),
        exercise({ id: 'future', opensAt: '2026-10-03T00:00:00Z', closesAt: '2026-10-04T00:00:00Z', canAttempt: false })
      ],
      { assignment: 'allowed', retake: 'allowed' },
      now
    );
    expect(tasks.find((task) => task.exercise.id === 'assignment')).toMatchObject({ state: 'open', action: 'start' });
    expect(filterAssessmentTasks(tasks, 'pending')).toHaveLength(2);
    expect(filterAssessmentTasks(tasks, 'graded').map((task) => task.exercise.id)).toEqual(['retake']);
    expect(filterAssessmentTasks(tasks, 'upcoming').map((task) => task.exercise.id)).toEqual(['future']);
    expect(filterAssessmentTasks(tasks, 'all', ' reflection ').map((task) => task.exercise.id)).toEqual(['assignment']);
    expect(filterAssessmentTasks(tasks, 'all', 'ONBOARDING')).toHaveLength(3);
  });

  it('checks completed exams for result links and deduplicates plan and exercise access probes', () => {
    const assignments = [
      {
        exams: [
          { id: 'exam', courseId: 'course', opensAt: '2026-10-02T01:00:00Z', closesAt: '2026-10-02T03:00:00Z' },
          { id: 'plan-only', courseId: 'course', opensAt: '2026-10-02T01:00:00Z', closesAt: '2026-10-02T03:00:00Z' }
        ]
      }
    ] as MyTrainingAssignments;
    const targets = getExerciseAccessTargets(
      [
        exercise(),
        exercise({ id: 'closed', closesAt: '2026-10-01T02:00:00Z', submission: [submission(3)] }),
        exercise({ id: 'future', opensAt: '2026-10-03T00:00:00Z' }),
        exercise({ id: 'assignment', isExam: false, opensAt: null, closesAt: null })
      ],
      assignments,
      now
    );
    expect(targets.map((target) => target.id)).toEqual(['exam', 'plan-only', 'closed', 'assignment']);
  });

  it('uses the learner makeup window in home cards', () => {
    const assignments = [
      {
        planStatus: 'PUBLISHED',
        enrollmentStatus: 'IN_PROGRESS',
        endAt: '2026-10-10',
        exams: [
          {
            id: 'exam',
            courseId: 'course',
            title: 'Safety exam',
            opensAt: '2026-10-01T01:00:00Z',
            closesAt: '2026-10-01T03:00:00Z'
          }
        ]
      }
    ] as MyTrainingAssignments;
    const cards = getHomeExams(assignments, [exercise()], { exam: 'allowed' }, now);
    expect(cards[0]).toMatchObject({ state: 'open', closesAt: '2026-10-02T03:00:00Z' });
  });
});
