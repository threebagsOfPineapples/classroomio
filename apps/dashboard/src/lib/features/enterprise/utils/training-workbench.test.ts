import { describe, expect, it } from 'vitest';
import type { TrainingPlans } from './types';
import { getTrainingWorkbenchPlans } from './training-workbench';

describe('training workbench', () => {
  it('shows published active, upcoming and soon due plans in date order', () => {
    const now = Date.parse('2026-09-25T00:00:00Z');
    const plan = (id: string, startAt: string, endAt: string, status = 'PUBLISHED') => ({
      id,
      startAt,
      endAt,
      status
    });
    const plans = [
      plan('later', '2026-10-10T00:00:00Z', '2026-10-20T00:00:00Z'),
      plan('soon', '2026-09-27T00:00:00Z', '2026-10-10T00:00:00Z'),
      plan('active', '2026-09-20T00:00:00Z', '2026-09-28T00:00:00Z'),
      plan('draft', '2026-09-20T00:00:00Z', '2026-09-27T00:00:00Z', 'DRAFT'),
      plan('ended', '2026-09-18T00:00:00Z', '2026-09-25T00:00:00Z')
    ] as TrainingPlans;

    const result = getTrainingWorkbenchPlans(plans, now);
    expect(result.active.map((item) => item.id)).toEqual(['active']);
    expect(result.upcoming.map((item) => item.id)).toEqual(['soon', 'later']);
    expect(result.dueSoon.map((item) => item.id)).toEqual(['active']);
  });
});
