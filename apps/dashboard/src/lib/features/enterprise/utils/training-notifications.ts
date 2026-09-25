import type { NotificationItem } from '$features/notifications/utils/types';
import type { MyTrainingAssignment } from './types';

export function toTrainingNotifications(
  assignments: Pick<MyTrainingAssignment, 'enrollmentId' | 'name' | 'assignedAt'>[],
  readIds: ReadonlySet<string>
): NotificationItem[] {
  return assignments.map((assignment) => ({
    id: `training_assignment:${assignment.enrollmentId}`,
    kind: 'training_assignment' as const,
    createdAt: assignment.assignedAt,
    title: { key: 'notifications.training_assignment.heading' },
    body: { key: 'notifications.training_assignment.body', params: { planName: assignment.name } },
    avatarUrl: null,
    avatarName: assignment.name,
    unread: !readIds.has(assignment.enrollmentId),
    sourceId: assignment.enrollmentId
  }));
}
