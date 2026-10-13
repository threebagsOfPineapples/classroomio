import { beforeEach, describe, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('./enterprise.svelte', () => ({ enterpriseApi: { request } }));
vi.mock('$lib/utils/functions/translations', () => ({ t: { get: (key: string) => key } }));
vi.mock('../utils/enterprise-errors', () => ({ enterpriseValidationMessage: () => 'validation_failed' }));
import { TrainingScopesApi } from './training-scopes.svelte';

const parentDepartmentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const childDepartmentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

beforeEach(() => {
  request.mockReset();
});

async function loadEditor(api: TrainingScopesApi, scopes = { departmentIds: [], memberIds: [] }) {
  request.mockResolvedValueOnce({
    isSuperAdmin: true,
    departments: [
      { id: parentDepartmentId, parentId: null, name: 'Operations', code: 'OPS', status: 'ACTIVE' },
      { id: childDepartmentId, parentId: parentDepartmentId, name: 'Team 1', code: 'OPS1', status: 'ACTIVE' }
    ]
  });
  request.mockResolvedValueOnce([]);
  request.mockResolvedValueOnce(scopes);
  await api.load('organization-one', 5);
}

describe('explicit training data access', () => {
  it('starts empty and never expands a selected department into its children', async () => {
    const api = new TrainingScopesApi();
    await loadEditor(api);
    expect(api.loaded).toBe(true);
    expect(api.departmentIds).toEqual([]);
    expect(api.memberIds).toEqual([]);
    api.toggleDepartment(parentDepartmentId);
    expect(api.departmentIds).toEqual([parentDepartmentId]);
    expect(api.departmentIds).not.toContain(childDepartmentId);
    api.departmentSearch = 'Operations / Team 1';
    expect(api.filteredDepartments.map((department) => department.id)).toEqual([childDepartmentId]);
  });

  it('compares current access before saving and reads it back after the write', async () => {
    const api = new TrainingScopesApi();
    await loadEditor(api);
    api.toggleMember(20);
    request.mockResolvedValueOnce({ departmentIds: [], memberIds: [] });
    request.mockResolvedValueOnce({ departmentIds: [], memberIds: [20] });
    request.mockResolvedValueOnce({ departmentIds: [], memberIds: [20] });
    expect(await api.save()).toBe(true);
    expect(request.mock.calls.slice(-3)).toEqual([
      ['organization-one', '/employees/5/training-scopes'],
      ['organization-one', '/employees/5/training-scopes', 'PUT', { departmentIds: [], memberIds: [20] }],
      ['organization-one', '/employees/5/training-scopes']
    ]);
    expect(api.hasChanges).toBe(false);
    expect(api.notice).toBe('enterprise.training_scopes.saved_verified');
  });

  it('refuses to overwrite access changed since the editor was opened', async () => {
    const api = new TrainingScopesApi();
    await loadEditor(api);
    api.toggleMember(20);
    request.mockResolvedValueOnce({ departmentIds: [], memberIds: [30] });
    expect(await api.save()).toBe(false);
    expect(request.mock.calls.filter((call) => call[2] === 'PUT')).toHaveLength(0);
    expect(api.error).toBe('enterprise.training_scopes.concurrent_change');
    expect(api.memberIds).toEqual([20]);
  });

  it('requires a reload when a saved write cannot be read back', async () => {
    const api = new TrainingScopesApi();
    await loadEditor(api);
    api.toggleMember(20);
    request.mockResolvedValueOnce({ departmentIds: [], memberIds: [] });
    request.mockResolvedValueOnce({ departmentIds: [], memberIds: [20] });
    request.mockRejectedValueOnce(new Error('offline'));
    expect(await api.save()).toBe(false);
    expect(api.loaded).toBe(false);
    expect(api.error).toBe('enterprise.training_scopes.readback_failed');
    const callCount = request.mock.calls.length;
    expect(await api.save()).toBe(false);
    expect(request).toHaveBeenCalledTimes(callCount);
  });

  it('does not continue an old save after the editor changes organization', async () => {
    const api = new TrainingScopesApi();
    await loadEditor(api);
    api.toggleMember(20);
    let resolveRead!: (scopes: { departmentIds: string[]; memberIds: number[] }) => void;
    request.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRead = resolve;
      })
    );
    const pendingSave = api.save();
    api.reset();
    resolveRead({ departmentIds: [], memberIds: [] });
    expect(await pendingSave).toBe(false);
    expect(request.mock.calls.filter((call) => call[2] === 'PUT')).toHaveLength(0);
    expect(api.memberIds).toEqual([]);
    expect(api.loaded).toBe(false);
  });

  it('keeps the editor unusable for a non-super-admin even if data requests return', async () => {
    const api = new TrainingScopesApi();
    request.mockResolvedValueOnce({ isSuperAdmin: false, departments: [] });
    request.mockResolvedValueOnce([]);
    request.mockResolvedValueOnce({ departmentIds: [], memberIds: [] });
    await api.load('organization-one', 5);
    api.toggleMember(20);
    expect(api.loaded).toBe(false);
    expect(api.memberIds).toEqual([]);
    expect(await api.save()).toBe(false);
  });
});
