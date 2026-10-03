import { describe, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('./enterprise.svelte', () => ({ enterpriseApi: { request } }));
vi.mock('$lib/utils/functions/translations', () => ({ t: { get: (key: string) => key } }));
import { trainingPlansApi } from './training-plans.svelte';

describe('training selection requests', () => {
  it('keeps assessment status tied to the selected plan and distinguishes errors from an absent scheme', async () => {
    request.mockReset();
    request.mockResolvedValue([]);
    await trainingPlansApi.load('org');
    let resolveOldAssessment!: (value: unknown) => void;
    request.mockImplementation((_organizationId: string, path: string) => {
      if (path === '/plans/old/assessment')
        return new Promise((resolve) => {
          resolveOldAssessment = resolve;
        });

      if (path === '/plans/new/assessment') return Promise.resolve({ id: 'new-scheme', status: 'DRAFT' });

      return Promise.resolve({ plan: { id: path.endsWith('/old') ? 'old' : 'new' } });
    });
    await trainingPlansApi.select('org', 'old');
    expect(trainingPlansApi.assessmentLoading).toBe(true);
    await trainingPlansApi.select('org', 'new');
    await vi.waitFor(() => expect(trainingPlansApi.assessment?.id).toBe('new-scheme'));
    resolveOldAssessment({ id: 'old-scheme', status: 'PUBLISHED' });
    await Promise.resolve();
    expect(trainingPlansApi.assessment?.id).toBe('new-scheme');
    expect(trainingPlansApi.assessmentLoading).toBe(false);

    request.mockRejectedValueOnce(new Error('enterprise.load_failed'));
    await trainingPlansApi.loadAssessment('org', 'new');
    expect(trainingPlansApi.assessment).toBeNull();
    expect(trainingPlansApi.assessmentError).toBe('enterprise.load_failed');

    request.mockResolvedValueOnce(null);
    await trainingPlansApi.loadAssessment('org', 'new');
    expect(trainingPlansApi.assessment).toBeNull();
    expect(trainingPlansApi.assessmentError).toBe('');
    trainingPlansApi.clearSelection();
    request.mockReset();
  });

  it('preserves mapped business failures for save, publish, and preview', async () => {
    request.mockRejectedValueOnce(new Error('enterprise.admin_errors.published_courses'));
    const saved = await trainingPlansApi.save('org', {
      name: 'Safety training',
      code: 'SAFETY-2026',
      year: 2026,
      planType: 'MANDATORY',
      startAt: '2026-10-01T00:00:00Z',
      endAt: '2026-11-01T00:00:00Z',
      courseIds: ['00000000-0000-4000-8000-000000000001'],
      targets: [{ targetType: 'USER', memberId: 1 }]
    });
    expect(saved).toBeNull();
    expect(trainingPlansApi.error).toBe('enterprise.admin_errors.published_courses');

    request.mockRejectedValueOnce(new Error('enterprise.admin_errors.no_recipients'));
    expect(await trainingPlansApi.publish('org', 'plan')).toBe(false);
    expect(trainingPlansApi.error).toBe('enterprise.admin_errors.no_recipients');

    request.mockRejectedValueOnce(new Error('enterprise.admin_errors.active_employee'));
    await trainingPlansApi.loadPreview('org', 'plan');
    expect(trainingPlansApi.error).toBe('enterprise.admin_errors.active_employee');
  });

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
