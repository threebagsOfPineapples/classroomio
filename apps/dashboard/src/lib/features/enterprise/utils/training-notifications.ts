import type { NotificationItem } from '$features/notifications/utils/types';
import type { UserEnrolledCourses } from '$features/course/types';
import { getTrainingCourseProgress } from './my-training-utils';
import type { MyTrainingAssignment, TrainingArchiveSummary } from './types';

export function toTrainingNotifications(
  assignments: Pick<
    MyTrainingAssignment,
    | 'enrollmentId'
    | 'name'
    | 'assignedAt'
    | 'startAt'
    | 'endAt'
    | 'enrollmentStatus'
    | 'planStatus'
    | 'finalScore'
    | 'result'
    | 'scoreCalculatedAt'
  >[],
  readIds: ReadonlySet<string>,
  now = Date.now()
): NotificationItem[] {
  return assignments.flatMap((assignment) => {
    const assignmentId = `training_assignment:${assignment.enrollmentId}`;
    const notifications: NotificationItem[] = [
      {
        id: assignmentId,
        kind: 'training_assignment',
        createdAt: assignment.assignedAt,
        title: { key: 'notifications.training_assignment.heading' },
        body: { key: 'notifications.training_assignment.body', params: { planName: assignment.name } },
        avatarUrl: null,
        avatarName: assignment.name,
        unread: !readIds.has(assignmentId) && !readIds.has(assignment.enrollmentId),
        sourceId: assignment.enrollmentId
      }
    ];
    const start = Date.parse(assignment.startAt);
    if (
      assignment.planStatus === 'PUBLISHED' &&
      assignment.enrollmentStatus !== 'COMPLETED' &&
      assignment.enrollmentStatus !== 'CANCELLED' &&
      assignment.enrollmentStatus !== 'EXPIRED' &&
      start > now &&
      start <= now + 3 * 86400000
    ) {
      const startId = `training_start:${assignment.enrollmentId}:${assignment.startAt}`;
      notifications.push({
        id: startId,
        kind: 'training_start',
        createdAt: new Date(Math.max(Date.parse(assignment.assignedAt), start - 3 * 86400000)).toISOString(),
        title: { key: 'notifications.training_start.heading' },
        body: { key: 'notifications.training_start.body', params: { planName: assignment.name } },
        avatarUrl: null,
        avatarName: assignment.name,
        unread: !readIds.has(startId),
        sourceId: assignment.enrollmentId
      });
    }
    const deadline = Date.parse(assignment.endAt);
    if (
      assignment.planStatus !== 'CANCELLED' &&
      assignment.enrollmentStatus !== 'COMPLETED' &&
      assignment.enrollmentStatus !== 'CANCELLED' &&
      assignment.enrollmentStatus !== 'EXPIRED' &&
      deadline > now &&
      deadline <= now + 3 * 86400000
    ) {
      const deadlineId = `training_deadline:${assignment.enrollmentId}:${assignment.endAt}`;
      notifications.push({
        id: deadlineId,
        kind: 'training_deadline',
        createdAt: new Date(Math.max(Date.parse(assignment.assignedAt), deadline - 3 * 86400000)).toISOString(),
        title: { key: 'notifications.training_deadline.heading' },
        body: { key: 'notifications.training_deadline.body', params: { planName: assignment.name } },
        avatarUrl: null,
        avatarName: assignment.name,
        unread: !readIds.has(deadlineId),
        sourceId: assignment.enrollmentId
      });
    }

    if (assignment.finalScore !== null && assignment.scoreCalculatedAt && assignment.result !== 'PENDING') {
      const scoreId = `training_score:${assignment.enrollmentId}:${assignment.result}:${assignment.finalScore}`;
      notifications.push({
        id: scoreId,
        kind: 'training_score',
        createdAt: assignment.scoreCalculatedAt,
        title: { key: 'notifications.training_score.heading' },
        body: {
          key: 'notifications.training_score.body',
          params: { planName: assignment.name, score: String(assignment.finalScore) }
        },
        avatarUrl: null,
        avatarName: assignment.name,
        unread: !readIds.has(scoreId),
        sourceId: assignment.enrollmentId
      });
    }

    return notifications;
  });
}

export function toCertificateNotifications(
  records: TrainingArchiveSummary['records'],
  readIds: ReadonlySet<string>
): NotificationItem[] {
  const seenCertificates = new Set<string>();
  return records.flatMap((record) =>
    record.courses.flatMap((course) => {
      if (!course.certificateAt) return [];

      const certificateId = `${course.id}:${course.certificateAt}`;
      if (seenCertificates.has(certificateId)) return [];

      seenCertificates.add(certificateId);
      const id = `training_certificate:${certificateId}`;
      return [
        {
          id,
          kind: 'training_certificate' as const,
          createdAt: course.certificateAt,
          title: { key: 'notifications.training_certificate.heading' },
          body: {
            key: 'notifications.training_certificate.body',
            params: { courseName: course.title }
          },
          avatarUrl: null,
          avatarName: course.title,
          unread: !readIds.has(id),
          sourceId: record.enrollmentId
        }
      ];
    })
  );
}

export function toCourseDeadlineNotifications(
  assignments: MyTrainingAssignment[],
  enrolledCourses: UserEnrolledCourses,
  readIds: ReadonlySet<string>,
  now = Date.now()
): NotificationItem[] {
  const enrolledById = new Map(enrolledCourses.map((course) => [course.id, course]));
  return assignments.flatMap((assignment) => {
    if (
      assignment.planStatus !== 'PUBLISHED' ||
      assignment.enrollmentStatus === 'COMPLETED' ||
      assignment.enrollmentStatus === 'CANCELLED' ||
      assignment.enrollmentStatus === 'EXPIRED'
    )
      return [];

    return assignment.courses.flatMap((course) => {
      if (!course.dueAt) return [];

      const dueAt = Date.parse(course.dueAt);
      const progress = getTrainingCourseProgress(enrolledById.get(course.id));
      if (dueAt <= now || dueAt > now + 3 * 86400000 || progress === null || progress >= 100) return [];

      const id = `training_course_deadline:${assignment.enrollmentId}:${course.id}:${course.dueAt}`;
      return [
        {
          id,
          kind: 'training_course_deadline' as const,
          createdAt: new Date(Math.max(Date.parse(assignment.assignedAt), dueAt - 3 * 86400000)).toISOString(),
          title: { key: 'notifications.training_course_deadline.heading' },
          body: {
            key: 'notifications.training_course_deadline.body',
            params: { courseName: course.title }
          },
          avatarUrl: null,
          avatarName: course.title,
          unread: !readIds.has(id),
          sourceId: assignment.enrollmentId
        }
      ];
    });
  });
}

export function toExamNotifications(
  assignments: MyTrainingAssignment[],
  readIds: ReadonlySet<string>,
  now = Date.now()
): NotificationItem[] {
  return assignments.flatMap((assignment) =>
    assignment.exams.flatMap((exam) => {
      const opensAt = Date.parse(exam.opensAt);
      if (opensAt <= now || opensAt > now + 3 * 86400000) return [];

      const id = `training_exam:${assignment.enrollmentId}:${exam.id}:${exam.opensAt}`;
      return [
        {
          id,
          kind: 'training_exam' as const,
          createdAt: new Date(Math.max(Date.parse(assignment.assignedAt), opensAt - 3 * 86400000)).toISOString(),
          title: { key: 'notifications.training_exam.heading' },
          body: { key: 'notifications.training_exam.body', params: { examName: exam.title } },
          avatarUrl: null,
          avatarName: exam.title,
          unread: !readIds.has(id),
          sourceId: assignment.enrollmentId,
          href: `/courses/${encodeURIComponent(exam.courseId)}/exercises/${encodeURIComponent(exam.id)}`
        }
      ];
    })
  );
}
