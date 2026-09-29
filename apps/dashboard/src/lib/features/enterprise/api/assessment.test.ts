import { expect, it, vi } from 'vitest';

const request = vi.hoisted(() => vi.fn());
vi.mock('./enterprise.svelte', () => ({ enterpriseApi: { request } }));
vi.mock('$lib/utils/functions/translations', () => ({ t: { get: (key: string) => key } }));
import { AssessmentApi } from './assessment.svelte';

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
