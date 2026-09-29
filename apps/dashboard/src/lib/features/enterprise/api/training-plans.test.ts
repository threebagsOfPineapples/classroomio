import { describe, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('./enterprise.svelte', () => ({ enterpriseApi: { request } }));
vi.mock('$lib/utils/functions/translations', () => ({ t: { get: (key: string) => key } }));
import { trainingPlansApi } from './training-plans.svelte';

describe('training selection requests', () => {
  it('ignores stale selections and previews when a user changes or clears the plan', async () => {
    request.mockResolvedValue([]);
    await trainingPlansApi.load('org');
    let resolveOld!: (value: unknown) => void;
    request.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      })
    );
    const old = trainingPlansApi.select('org', 'old');
    request.mockResolvedValueOnce({ plan: { id: 'new' } });
    await trainingPlansApi.select('org', 'new');
    resolveOld({ plan: { id: 'old' } });
    expect(await old).toBeNull();
    expect(trainingPlansApi.selected?.plan.id).toBe('new');
    let resolvePreview!: (value: unknown) => void;
    request.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePreview = resolve;
      })
    );
    const preview = trainingPlansApi.loadPreview('org', 'new');
    trainingPlansApi.clearSelection();
    resolvePreview({ count: 1, memberIds: [1] });
    await preview;
    expect(trainingPlansApi.preview).toBeNull();
    expect(trainingPlansApi.selected).toBeNull();
  });
});
