import { apiClient, getRequestBaseUrl } from '$lib/utils/services/api';
import { t } from '$lib/utils/functions/translations';
import { ZDingtalkDirectoryError, ZDingtalkDirectorySync } from '@cio/utils/validation/auth/dingtalk';
import type { DingtalkDirectoryPreview, DingtalkDirectoryStatus, DingtalkDirectoryResult } from '../utils/types';

export class DingtalkDirectoryApi {
  private organizationId = '';
  status = $state<DingtalkDirectoryStatus | null>(null);
  preview = $state<DingtalkDirectoryPreview | null>(null);
  result = $state<DingtalkDirectoryResult | null>(null);
  selected = $state<Record<string, boolean>>({});
  departments = $state<Record<string, string>>({});
  busy = $state(false);
  errorKey = $state('');
  search = $state('');
  pageIndex = $state(0);

  get filteredEmployees() {
    const query = this.search.trim().toLocaleLowerCase();
    return (this.preview?.employees ?? []).filter((row) =>
      `${row.name} ${row.employeeNo ?? ''}`.toLocaleLowerCase().includes(query)
    );
  }

  get currentPage() {
    return Math.min(this.pageIndex, Math.max(0, Math.ceil(this.filteredEmployees.length / 50) - 1));
  }

  get visibleEmployees() {
    return this.filteredEmployees.slice(this.currentPage * 50, (this.currentPage + 1) * 50);
  }

  get selectedCount() {
    return (this.preview?.employees ?? []).filter((row) => this.selected[row.userId] && this.departments[row.userId])
      .length;
  }

  departmentLabel(id: number) {
    const department = this.preview?.departments.find((row) => row.id === id);
    return department?.name ?? String(id);
  }

  canSelect(row: NonNullable<DingtalkDirectoryPreview>['employees'][number]) {
    return ['ready', 'department_required'].includes(row.status) && !!this.departments[row.userId];
  }

  setDepartment(userId: string, value: string) {
    this.departments[userId] = value;
    this.selected[userId] = !!value;
  }

  selectReady() {
    const eligible = (this.preview?.employees ?? []).filter((row) => this.canSelect(row));
    const selected = !eligible.every((row) => this.selected[row.userId]);
    for (const row of eligible) this.selected[row.userId] = selected;
  }

  setError(error: unknown) {
    const code = error instanceof Error ? error.message.replace('DINGTALK_DIRECTORY_', '').toLowerCase() : '';
    const parsed = ZDingtalkDirectoryError.safeParse(code);
    this.errorKey = parsed.success
      ? `enterprise.dingtalk.directory.errors.${parsed.data}`
      : 'enterprise.request_failed';
  }

  private async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const requestBody = body === undefined ? undefined : JSON.stringify(body);
    const response = await apiClient.request(`${getRequestBaseUrl()}/enterprise/dingtalk${path}`, {
      method,
      credentials: 'include',
      headers: { 'cio-org-id': this.organizationId, 'Content-Type': 'application/json' },
      body: requestBody,
      timeout: 110_000,
      retries: 0
    });
    const result = (await response.json()) as { success: boolean; data: T; code?: string };
    if (!response.ok || !result.success) throw new Error(result.code ?? 'provider_error');

    return result.data;
  }

  async load(organizationId: string) {
    this.organizationId = organizationId;
    this.status = null;
    this.preview = null;
    this.result = null;
    this.busy = true;
    this.errorKey = '';
    try {
      const status = await this.request<DingtalkDirectoryStatus>('');
      if (this.organizationId === organizationId) this.status = status;
    } catch (error) {
      if (this.organizationId === organizationId) this.setError(error);
    } finally {
      if (this.organizationId === organizationId) this.busy = false;
    }
  }

  async readPreview() {
    if (this.busy) return;

    const organizationId = this.organizationId;
    this.busy = true;
    this.errorKey = '';
    this.result = null;
    this.preview = null;
    try {
      const preview = await this.request<DingtalkDirectoryPreview>('/preview', 'POST');
      if (organizationId !== this.organizationId) return;

      this.preview = preview;
      this.selected = Object.fromEntries(preview.employees.map((row) => [row.userId, row.status === 'ready']));
      this.departments = Object.fromEntries(
        preview.employees.map((row) => [row.userId, row.departmentId ? String(row.departmentId) : ''])
      );
      this.pageIndex = 0;
    } catch (error) {
      if (organizationId === this.organizationId) this.setError(error);
    } finally {
      if (organizationId === this.organizationId) this.busy = false;
    }
  }

  async sync() {
    if (this.busy || !this.preview) return false;

    const organizationId = this.organizationId;
    const selections = this.preview.employees
      .filter((row) => this.selected[row.userId] && this.canSelect(row))
      .map((row) => {
        const departmentId = Number(this.departments[row.userId]);
        return { userId: row.userId, departmentId };
      });
    const parsed = ZDingtalkDirectorySync.safeParse({ token: this.preview.token, selections });
    if (!parsed.success) {
      this.errorKey = 'enterprise.dingtalk.directory.errors.changed';
      return false;
    }

    this.busy = true;
    this.errorKey = '';
    try {
      const result = await this.request<DingtalkDirectoryResult>('/sync', 'POST', parsed.data);
      if (organizationId !== this.organizationId) return false;

      this.result = result;
      this.preview = null;
      return true;
    } catch (error) {
      if (organizationId === this.organizationId) this.setError(error);
      return false;
    } finally {
      if (organizationId === this.organizationId) this.busy = false;
    }
  }
}
