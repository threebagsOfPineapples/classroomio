import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/utils/services/api/types';
const request = vi.hoisted(() => vi.fn());
vi.mock('$lib/utils/services/api', () => ({ apiClient: { request }, getRequestBaseUrl: () => '/proxy' }));
vi.mock('$lib/utils/functions/translations', async () => {
  const { writable } = await import('svelte/store');
  return { locale: writable('zh'), t: { get: (key: string) => key } };
});
import { enterpriseApi } from './enterprise.svelte';

describe('enterprise request errors', () => {
  it('keeps business reasons readable without leaking raw JSON or English errors', async () => {
    request.mockRejectedValueOnce(new ApiError('{"error":"培训尚未开始，无需催学"}', 400));
    await expect(enterpriseApi.request('org', '/plans/plan/remind', 'POST')).rejects.toThrow('培训尚未开始，无需催学');
    request.mockRejectedValueOnce(new ApiError('{"error":"Training manager access required"}', 403));
    await expect(enterpriseApi.request('org', '/plans')).rejects.toThrow('common.restricted_description');
    request.mockRejectedValueOnce(new ApiError('Internal Server Error', 500));
    await expect(enterpriseApi.request('org', '/plans')).rejects.toThrow('enterprise.request_failed');
  });
});
