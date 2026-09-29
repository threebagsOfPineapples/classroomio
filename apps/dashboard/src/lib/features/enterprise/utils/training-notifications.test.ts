import { describe, expect, it } from 'vitest';
import {
  toCertificateNotifications,
  toCourseDeadlineNotifications,
  toExamNotifications,
  toTrainingNotifications
} from './training-notifications';

describe('training notifications', () => {
  it('uses plan assignments and respects read state', () => {
    const assignments = [
      {
        enrollmentId: 'first',
        name: '新人培训',
        assignedAt: '2026-09-25T00:00:00.000Z',
        startAt: '2026-09-01T00:00:00.000Z',
        endAt: '2026-12-01T00:00:00.000Z',
        enrollmentStatus: 'NOT_STARTED' as const,
        planStatus: 'PUBLISHED' as const,
        finalScore: null,
        result: 'PENDING' as const,
        scoreCalculatedAt: null
      },
      {
        enrollmentId: 'second',
        name: '合规培训',
        assignedAt: '2026-09-24T00:00:00.000Z',
        startAt: '2026-09-01T00:00:00.000Z',
        endAt: '2026-12-01T00:00:00.000Z',
        enrollmentStatus: 'NOT_STARTED' as const,
        planStatus: 'PUBLISHED' as const,
        finalScore: null,
        result: 'PENDING' as const,
        scoreCalculatedAt: null
      }
    ];

    const notifications = toTrainingNotifications(assignments, new Set(['first']), Date.parse('2026-09-25T00:00:00Z'));

    expect(notifications.map((item) => [item.sourceId, item.unread])).toEqual([
      ['first', false],
      ['second', true]
    ]);
    expect(notifications[0].body.params).toEqual({ planName: '新人培训' });
  });

  it('reminds unfinished learners within three days and keeps deadline read state separate', () => {
    const assignment = {
      enrollmentId: 'first',
      name: '新人培训',
      assignedAt: '2026-09-24T00:00:00.000Z',
      startAt: '2026-09-01T00:00:00.000Z',
      endAt: '2026-09-27T00:00:00.000Z',
      enrollmentStatus: 'IN_PROGRESS' as const,
      planStatus: 'PUBLISHED' as const,
      finalScore: null,
      result: 'PENDING' as const,
      scoreCalculatedAt: null
    };
    const now = Date.parse('2026-09-25T00:00:00.000Z');
    const notifications = toTrainingNotifications([assignment], new Set(['first']), now);

    expect(notifications).toHaveLength(2);
    expect(notifications[1]).toMatchObject({
      kind: 'training_deadline',
      unread: true,
      sourceId: 'first',
      body: { key: 'notifications.training_deadline.body', params: { planName: '新人培训' } }
    });
    expect(toTrainingNotifications([assignment], new Set([notifications[1].id]), now)[1].unread).toBe(false);
    expect(toTrainingNotifications([{ ...assignment, enrollmentStatus: 'COMPLETED' }], new Set(), now)).toHaveLength(1);
  });

  it('reminds a learner shortly before a published plan starts', () => {
    const assignment = {
      enrollmentId: 'first',
      name: '新人培训',
      assignedAt: '2026-09-24T00:00:00.000Z',
      startAt: '2026-09-27T00:00:00.000Z',
      endAt: '2026-10-01T00:00:00.000Z',
      enrollmentStatus: 'NOT_STARTED' as const,
      planStatus: 'PUBLISHED' as const,
      finalScore: null,
      result: 'PENDING' as const,
      scoreCalculatedAt: null
    };
    const now = Date.parse('2026-09-25T00:00:00.000Z');
    const notifications = toTrainingNotifications([assignment], new Set(), now);

    expect(notifications[1]).toMatchObject({
      kind: 'training_start',
      unread: true,
      body: { key: 'notifications.training_start.body', params: { planName: '新人培训' } }
    });
    expect(toTrainingNotifications([assignment], new Set([notifications[1].id]), now)[1].unread).toBe(false);
    expect(toTrainingNotifications([{ ...assignment, planStatus: 'CANCELLED' }], new Set(), now)).toHaveLength(1);
  });

  it('shows a published assessment result once and keeps its read state', () => {
    const assignment = {
      enrollmentId: 'first',
      name: '新人培训',
      assignedAt: '2026-09-01T00:00:00.000Z',
      startAt: '2026-09-02T00:00:00.000Z',
      endAt: '2026-09-20T00:00:00.000Z',
      enrollmentStatus: 'COMPLETED' as const,
      planStatus: 'PUBLISHED' as const,
      finalScore: 92,
      result: 'PASS' as const,
      scoreCalculatedAt: '2026-09-19T00:00:00.000Z'
    };
    const now = Date.parse('2026-09-25T00:00:00.000Z');
    const notifications = toTrainingNotifications([assignment], new Set(), now);

    expect(notifications[1]).toMatchObject({
      kind: 'training_score',
      createdAt: assignment.scoreCalculatedAt,
      body: { key: 'notifications.training_score.body', params: { planName: '新人培训', score: '92' } }
    });
    expect(toTrainingNotifications([assignment], new Set([notifications[1].id]), now)[1].unread).toBe(false);
    expect(toTrainingNotifications([{ ...assignment, finalScore: null }], new Set(), now)).toHaveLength(1);
  });

  it('shows issued certificates without repeating read notifications', () => {
    const records = [
      {
        enrollmentId: 'first',
        courses: [
          { id: 'course-1', title: '安全培训', certificateAt: '2026-09-24T00:00:00.000Z' },
          { id: 'course-2', title: '操作培训', certificateAt: null }
        ]
      },
      {
        enrollmentId: 'second',
        courses: [{ id: 'course-1', title: '安全培训', certificateAt: '2026-09-24T00:00:00.000Z' }]
      }
    ] as never;
    const notifications = toCertificateNotifications(records, new Set());

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      kind: 'training_certificate',
      sourceId: 'first',
      createdAt: '2026-09-24T00:00:00.000Z',
      body: { key: 'notifications.training_certificate.body', params: { courseName: '安全培训' } }
    });
    expect(toCertificateNotifications(records, new Set([notifications[0].id]))[0].unread).toBe(false);
  });

  it('reminds only unfinished courses with a near deadline', () => {
    const assignments = [
      {
        enrollmentId: 'first',
        planStatus: 'PUBLISHED',
        enrollmentStatus: 'IN_PROGRESS',
        assignedAt: '2026-09-20T00:00:00.000Z',
        courses: [{ id: 'course-1', title: '安全培训', dueAt: '2026-09-27T00:00:00.000Z' }]
      }
    ] as never;
    const now = Date.parse('2026-09-25T00:00:00.000Z');
    const unfinishedCourses = [{ id: 'course-1', lessonCount: 1, exerciseCount: 0, progressRate: 0 }] as never;
    const finishedCourses = [{ id: 'course-1', lessonCount: 1, exerciseCount: 0, progressRate: 1 }] as never;
    const notifications = toCourseDeadlineNotifications(assignments, unfinishedCourses, new Set(), now);

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      kind: 'training_course_deadline',
      body: { key: 'notifications.training_course_deadline.body', params: { courseName: '安全培训' } }
    });
    expect(toCourseDeadlineNotifications(assignments, finishedCourses, new Set(), now)).toHaveLength(0);
    expect(toCourseDeadlineNotifications(assignments, [], new Set(), now)).toHaveLength(0);
  });

  it('reminds learners before an upcoming exam and links to it', () => {
    const assignments = [
      {
        enrollmentId: 'first',
        assignedAt: '2026-09-20T00:00:00.000Z',
        exams: [
          {
            id: 'exam-1',
            courseId: 'course-1',
            title: '安全考试',
            opensAt: '2026-09-27T00:00:00.000Z',
            closesAt: '2026-09-28T00:00:00.000Z'
          }
        ]
      }
    ] as never;
    const now = Date.parse('2026-09-25T00:00:00.000Z');
    const notifications = toExamNotifications(assignments, new Set(), now);

    expect(notifications[0]).toMatchObject({
      kind: 'training_exam',
      href: '/courses/course-1/exercises/exam-1',
      body: { key: 'notifications.training_exam.body', params: { examName: '安全考试' } }
    });
    expect(toExamNotifications(assignments, new Set([notifications[0].id]), now)[0].unread).toBe(false);
    expect(toExamNotifications(assignments, new Set(), Date.parse('2026-09-27T00:00:00.000Z'))).toHaveLength(1);
    expect(toExamNotifications(assignments, new Set(), Date.parse('2026-09-28T00:00:00.000Z'))).toHaveLength(0);
  });
});

it('催学使用独立已读标识，并跳转到对应培训', () => {
  const assignment = {
    enrollmentId: 'first',
    name: '新人培训',
    assignedAt: '2026-09-01T00:00:00Z',
    startAt: '2026-09-01T00:00:00Z',
    endAt: '2026-12-01T00:00:00Z',
    enrollmentStatus: 'NOT_STARTED' as const,
    planStatus: 'PUBLISHED' as const,
    finalScore: null,
    result: 'PENDING' as const,
    scoreCalculatedAt: null,
    remindedAt: '2026-09-29T00:00:00Z'
  };
  const reminders = toTrainingNotifications([assignment], new Set(), Date.parse(assignment.remindedAt)).filter(
    (item) => item.kind === 'training_reminder'
  );
  expect(reminders).toHaveLength(1);
  expect(reminders[0].href).toBe('/lms/training/first');
  const readReminders = toTrainingNotifications(
    [assignment],
    new Set([reminders[0].id]),
    Date.parse(assignment.remindedAt)
  );
  expect(readReminders.find((item) => item.id === reminders[0].id)?.unread).toBe(false);
  expect(
    toTrainingNotifications([{ ...assignment, enrollmentStatus: 'COMPLETED' }], new Set()).some(
      (item) => item.kind === 'training_reminder'
    )
  ).toBe(false);
});
