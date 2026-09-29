import { expect, it } from 'vitest';
import { getActiveMakeupPolicy } from '@cio/utils/functions/exam-makeup';
import { ZTrainingMakeup } from '@cio/utils/validation/training-plan';

const makeup = { opensAt: '2026-09-29T01:00:00Z', closesAt: '2026-09-29T02:00:00Z', maxAttempts: 3 };

it('个人补考只在授权窗口生效，截止瞬间不再开放', () => {
  expect(getActiveMakeupPolicy(null)).toBeNull();
  expect(getActiveMakeupPolicy(makeup, Date.parse('2026-09-29T00:59:59Z'))).toBeNull();
  expect(getActiveMakeupPolicy(makeup, Date.parse(makeup.opensAt))).toMatchObject({
    maxAttempts: 3,
    allowMakeup: true,
    allowMultipleAttempts: true
  });
  expect(getActiveMakeupPolicy(makeup, Date.parse(makeup.closesAt))).toBeNull();
});

it('批量补考必须选择员工并提供正向时间窗口', () => {
  const payload = {
    exerciseId: '10000000-0000-4000-8000-000000000001',
    memberIds: [1],
    opensAt: makeup.opensAt,
    closesAt: makeup.closesAt
  };
  expect(ZTrainingMakeup.safeParse(payload).success).toBe(true);
  expect(ZTrainingMakeup.safeParse({ ...payload, memberIds: [] }).success).toBe(false);
  expect(
    ZTrainingMakeup.safeParse({ ...payload, memberIds: Array.from({ length: 101 }, (_, index) => index + 1) }).success
  ).toBe(false);
  expect(ZTrainingMakeup.safeParse({ ...payload, closesAt: payload.opensAt }).success).toBe(false);
});
