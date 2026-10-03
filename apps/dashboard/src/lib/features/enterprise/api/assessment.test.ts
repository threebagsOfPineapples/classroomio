import { expect, it, vi } from 'vitest';

const request = vi.hoisted(() => vi.fn());
vi.mock('./enterprise.svelte', () => ({ enterpriseApi: { request } }));
vi.mock('$lib/utils/functions/translations', () => ({ t: { get: (key: string) => key } }));
import { AssessmentApi } from './assessment.svelte';
import type { AssessmentDraft } from '../utils/types';

it('ignores older responses when the same plan is loaded again with different filters', async () => {
  const api = new AssessmentApi();
  let resolveOld!: (value: unknown) => void;
  request.mockResolvedValue([]);
  request.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveOld = resolve;
    })
  );
  const older = api.loadManager('org', 'plan', '2026-01-01');
  request.mockResolvedValueOnce({ name: 'latest' });
  expect(await api.loadManager('org', 'plan', '2026-09-01')).toBe(true);
  resolveOld({ name: 'outdated' });
  expect(await older).toBeUndefined();
  expect(api.scheme?.name).toBe('latest');
  expect(api.loading).toBe(false);
});

it('does not publish an assessment while the form differs from the saved scheme', async () => {
  const draft: AssessmentDraft = {
    name: 'Training assessment',
    passScore: 80,
    items: [{ type: 'INSTRUCTOR', name: 'Practice', weight: 100, maxScore: 100, required: true }]
  };
  request.mockReset();
  request.mockResolvedValue([]);
  request.mockResolvedValueOnce({ ...draft, id: 'scheme', status: 'DRAFT' });
  const api = new AssessmentApi();
  await api.loadManager('org', 'plan');
  request.mockClear();
  expect(await api.publishScheme('org', 'plan', { ...draft, passScore: 90 })).toBe(false);
  expect(api.error).toBe('enterprise.admin_workflow.save_before_publish');
  expect(request).not.toHaveBeenCalled();
  request.mockResolvedValueOnce({ ...draft, id: 'scheme', status: 'PUBLISHED' });
  expect(await api.publishScheme('org', 'plan', draft)).toBe(true);
  expect(request).toHaveBeenCalledWith('org', '/plans/plan/assessment/publish', 'POST');
});

it('preserves actionable translated errors from the enterprise API', async () => {
  request.mockReset();
  request.mockRejectedValueOnce(new Error('录入分数不能超过该考核项目的满分。'));
  const api = new AssessmentApi();
  expect(await api.enterScore('org', 'enrollment', 'item', 90)).toBe(false);
  expect(api.error).toBe('录入分数不能超过该考核项目的满分。');
});
