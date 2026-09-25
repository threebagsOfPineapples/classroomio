import { describe, expect, it } from 'vitest';
import { toTrainingNotifications } from './training-notifications';

describe('training notifications', () => {
  it('uses plan assignments and respects read state', () => {
    const assignments = [
      { enrollmentId: 'first', name: '新人培训', assignedAt: '2026-09-25T00:00:00.000Z' },
      { enrollmentId: 'second', name: '合规培训', assignedAt: '2026-09-24T00:00:00.000Z' }
    ];

    const notifications = toTrainingNotifications(assignments, new Set(['first']));

    expect(notifications.map((item) => [item.sourceId, item.unread])).toEqual([
      ['first', false],
      ['second', true]
    ]);
    expect(notifications[0].body.params).toEqual({ planName: '新人培训' });
  });
});
