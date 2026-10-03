import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/utils/services/api/types';
const request = vi.hoisted(() => vi.fn());
const importAudienceMembers = vi.hoisted(() => vi.fn());
vi.mock('$lib/utils/services/api', () => ({ apiClient: { request }, getRequestBaseUrl: () => '/proxy' }));
vi.mock('$features/org/api/org.svelte', () => ({ orgApi: { importAudienceMembers, error: null } }));
vi.mock('$lib/utils/functions/translations', async () => {
  const { writable } = await import('svelte/store');
  return { locale: writable('zh'), t: { get: (key: string) => key } };
});

it('invites exactly one employee through the existing organization flow and validates the address first', async () => {
  request.mockReset();
  importAudienceMembers.mockReset();
  expect(await enterpriseApi.inviteEmployee('org', 'not an email')).toBe(false);
  expect(enterpriseApi.error).toBe('audience.import.status.invalid_email');
  expect(importAudienceMembers).not.toHaveBeenCalled();
  request.mockResolvedValue(new Response(JSON.stringify({ success: true, data: [] })));
  request.mockImplementation(async () => new Response(JSON.stringify({ success: true, data: [] })));
  importAudienceMembers.mockResolvedValue({
    success: true,
    data: { rows: [{ status: 'ready' }], emailsSent: 1, emailsFailed: 0 }
  });
  expect(await enterpriseApi.inviteEmployee('org', ' EMPLOYEE@example.test ')).toBe(true);
  expect(importAudienceMembers).toHaveBeenCalledWith(
    { recipients: [{ email: 'employee@example.test' }], sendEmail: true, allCourses: false, allCohorts: false },
    { notify: false }
  );
  expect(enterpriseApi.notice).toBe('enterprise.admin_workflow.invite_sent');

  importAudienceMembers.mockResolvedValue({
    success: true,
    data: { rows: [{ status: 'is_staff' }], emailsSent: 0, emailsFailed: 0 }
  });
  expect(await enterpriseApi.inviteEmployee('org', 'staff@example.test')).toBe(false);
  expect(enterpriseApi.error).toBe('audience.import.status.is_staff');
  expect(enterpriseApi.notice).toBe('');
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
    request.mockRejectedValueOnce(new ApiError('{"error":"Assessment item weights must total 100"}', 400));
    await expect(enterpriseApi.request('org', '/plans/plan/assessment/publish', 'POST')).rejects.toThrow(
      'enterprise.admin_errors.weights'
    );
    request.mockRejectedValueOnce(new ApiError('{"error":"Department has active children or employees"}', 400));
    await expect(
      enterpriseApi.request('org', '/departments/department', 'PUT', { status: 'INACTIVE' })
    ).rejects.toThrow('enterprise.admin_errors.department_in_use');
  });
});
