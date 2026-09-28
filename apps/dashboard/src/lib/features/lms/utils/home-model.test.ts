import { describe, expect, it } from 'vitest';
import type { UserEnrolledCourses } from '$features/course/types';
import type {
  EnterpriseGradingQueue,
  MyTrainingAssignments,
  TrainingArchive,
  TrainingPlans
} from '$features/enterprise/utils/types';
import type { LMSExercises } from './types';
import {
  filterLearningCourses,
  getCourseLearningAction,
  getCourseLearningState
} from '$features/course/utils/course-learning';
import { getStudentCourseProgressPercent } from '$features/course/utils/compliance-utils';
import {
  getGradingWorkbenchQueue,
  getPlanCompletion,
  getTrainingWorkbenchPlans
} from '$features/enterprise/utils/training-workbench';
import { getHomeExams, getPendingTraining } from './home-model';

const courses = [
  {
    id: 'new',
    title: 'New course',
    type: 'SELF_PACED',
    lessonCount: 5,
    progressRate: 0,
    exerciseCount: 0,
    exercisesCompleted: 0
  },
  {
    id: 'started',
    title: 'Started course',
    type: 'SELF_PACED',
    lessonCount: 5,
    progressRate: 2,
    exerciseCount: 0,
    exercisesCompleted: 0
  },
  {
    id: 'done',
    title: 'Completed course',
    type: 'SELF_PACED',
    lessonCount: 5,
    progressRate: 5,
    exerciseCount: 0,
    exercisesCompleted: 0
  },
  {
    id: 'compliance',
    title: 'Compliance course',
    type: 'COMPLIANCE',
    complianceStatus: 'in_progress',
    lessonCount: 5,
    progressRate: 5,
    exerciseCount: 0,
    exercisesCompleted: 0
  },
  {
    id: 'empty',
    title: 'Empty course',
    type: 'SELF_PACED',
    lessonCount: 0,
    progressRate: 0,
    exerciseCount: 0,
    exercisesCompleted: 0
  }
] as UserEnrolledCourses;

const now = Date.parse('2026-09-28T12:00:00Z');
const assignments = [
  {
    enrollmentId: 'active',
    planStatus: 'PUBLISHED',
    enrollmentStatus: 'IN_PROGRESS',
    endAt: '2026-09-29',
    exams: [
      { id: 'open', courseId: 'course', title: 'Open', opensAt: '2026-09-27', closesAt: '2026-09-29' },
      { id: 'future', courseId: 'course', title: 'Future', opensAt: '2026-09-29', closesAt: '2026-09-30' },
      { id: 'closed', courseId: 'course', title: 'Closed', opensAt: '2026-09-26', closesAt: '2026-09-27' }
    ]
  },
  { enrollmentId: 'expired', planStatus: 'PUBLISHED', enrollmentStatus: 'EXPIRED', endAt: '2026-09-27', exams: [] },
  { enrollmentId: 'draft', planStatus: 'DRAFT', enrollmentStatus: 'NOT_STARTED', endAt: '2026-09-29', exams: [] }
] as MyTrainingAssignments;

function submissions(statuses: number[]) {
  const submission = statuses.map((status_id, index) => ({
    status_id,
    updated_at: '2026-09-28T' + (10 + index) + ':00:00Z'
  }));
  return [{ id: 'open', submission }] as LMSExercises;
}

describe('enterprise home display models', () => {
  it('separates not started, started and complete without treating compliance content as compliance completion', () => {
    expect(courses.map(getCourseLearningState)).toEqual([
      'not_started',
      'in_progress',
      'completed',
      'in_progress',
      'not_started'
    ]);
    expect(getStudentCourseProgressPercent(courses[1])).toBe(40);
    expect(filterLearningCourses(courses, 'pending').map((course) => course.id)).toEqual([
      'started',
      'compliance',
      'new',
      'empty'
    ]);
    expect(filterLearningCourses(courses, 'all', '  completed  ')).toEqual([courses[2]]);
    expect(filterLearningCourses(courses, 'all', 'missing')).toEqual([]);
    expect(courses.slice(0, 4).map((course) => getCourseLearningAction(course).key)).toEqual([
      'enterprise.ui_v2.start_course',
      'enterprise.ui_v2.continue_course',
      'enterprise.ui_v2.review_course',
      'enterprise.ui_v2.view_assessment'
    ]);
    expect(getCourseLearningAction(courses[2]).href).toBe('/courses/done/lessons');
    expect(getCourseLearningAction(courses[3]).href).toBe('/courses/compliance/exercises');
  });

  it('uses one pending-plan rule and distinguishes exam windows, access and latest submission', () => {
    expect(getPendingTraining(assignments).map((assignment) => assignment.enrollmentId)).toEqual(['active']);
    const display = getHomeExams(assignments, [], { open: 'allowed' }, now);
    expect(display.find((exam) => exam.id === 'open')?.state).toBe('open');
    expect(display.find((exam) => exam.id === 'future')?.state).toBe('upcoming');
    expect(display.find((exam) => exam.id === 'closed')?.state).toBe('ended');
    expect(
      getHomeExams(assignments, submissions([3, 2]), { open: 'allowed' }, now).find((exam) => exam.id === 'open')?.state
    ).toBe('in_progress');
    expect(
      getHomeExams(assignments, submissions([2, 1]), { open: 'allowed' }, now).find((exam) => exam.id === 'open')?.state
    ).toBe('submitted');
    expect(getHomeExams(assignments, submissions([3]), {}, now).find((exam) => exam.id === 'open')?.state).toBe(
      'graded'
    );
    expect(getHomeExams(assignments, [], { open: 'denied' }, now).find((exam) => exam.id === 'open')?.state).toBe(
      'unavailable'
    );
    expect(getHomeExams(assignments, [], {}, now).find((exam) => exam.id === 'open')?.state).toBe('unknown');
  });

  it('deduplicates overlapping grading categories and reports actual plan completion bases', () => {
    const overlapping = { id: 'submission-1', isExam: false, hasWrittenQuestion: true, submittedAt: '2026-09-28' };
    const queue = getGradingWorkbenchQueue([
      overlapping,
      overlapping,
      { id: 'submission-2', isExam: true, hasWrittenQuestion: true, submittedAt: '2026-09-27' }
    ] as EnterpriseGradingQueue);
    expect(queue.all.length).toBe(2);
    expect(queue.assignments.length).toBe(1);
    expect(queue.written.length).toBe(2);
    const missingTime = { ...queue.all[0], id: 'missing-time', submittedAt: null };
    const sorted = getGradingWorkbenchQueue([...queue.all, missingTime]);
    expect(sorted.all.at(-1)?.id).toBe('missing-time');
    const archive = [
      { planId: 'plan', status: 'COMPLETED' },
      { planId: 'plan', status: 'IN_PROGRESS' }
    ] as TrainingArchive;
    expect(getPlanCompletion(archive, 'plan')).toEqual({ assigned: 2, completed: 1, percent: 50 });
    expect(getPlanCompletion(archive, 'unknown')).toEqual({ assigned: 0, completed: 0, percent: null });
    const plans = Array.from({ length: 5 }, (_, index) => ({
      id: String(index),
      status: 'PUBLISHED',
      startAt: '2026-09-27',
      endAt: '2026-09-29'
    })) as TrainingPlans;
    expect(getTrainingWorkbenchPlans(plans, now).active.length).toBe(5);
  });
});
