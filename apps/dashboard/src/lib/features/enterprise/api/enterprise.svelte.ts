import { apiClient, getRequestBaseUrl } from '$lib/utils/services/api';
import { locale, t } from '$lib/utils/functions/translations';
import { get } from 'svelte/store';
import { ApiError } from '$lib/utils/services/api/types';
import type { EnterpriseEmployee, EnterpriseEmployees, EnterpriseOverview, EnterpriseRole } from '../utils/types';

class EnterpriseApi {
  private currentOrganizationId: string | null = null;
  overview = $state<EnterpriseOverview | null>(null);
  employees = $state<EnterpriseEmployees>([]);
  selectedEmployee = $state<(EnterpriseEmployee & { roles: EnterpriseRole[] }) | null>(null);
  loading = $state(false);
  busy = $state(false);
  error = $state('');
  notice = $state('');

  async request<T>(organizationId: string, path: string, method = 'GET', body?: unknown): Promise<T> {
    try {
      const response = await apiClient.request(`${getRequestBaseUrl()}/enterprise${path}`, {
        method,
        credentials: 'include',
        headers: { 'cio-org-id': organizationId, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const result = (await response.json()) as { success: boolean; data: T; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error ?? '');

      return result.data;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        throw new Error(t.get('common.restricted_description'));
      }

      if (error instanceof ApiError && error.status === 404) throw new Error(t.get('common.page_not_found'));

      let message = error instanceof Error ? error.message : '';
      try {
        const result = JSON.parse(message) as { error?: unknown };
        message = typeof result.error === 'string' ? result.error : '';
      } catch {
        message = message.trim();
      }

      const displayMessage =
        get(locale) === 'zh' && /[\u3400-\u9fff]/.test(message) ? message : t.get('enterprise.request_failed');
      throw new Error(displayMessage);
    }
  }

  async load(organizationId: string) {
    if (this.currentOrganizationId !== organizationId) {
      this.currentOrganizationId = organizationId;
      this.overview = null;
      this.employees = [];
      this.selectedEmployee = null;
      this.notice = '';
    }

    this.loading = true;
    this.error = '';
    try {
      const [overview, employees] = await Promise.all([
        this.request<EnterpriseOverview>(organizationId, '/overview'),
        this.request<EnterpriseEmployees>(organizationId, '/employees')
      ]);
      if (this.currentOrganizationId !== organizationId) return false;

      this.overview = overview;
      this.employees = employees;
      return true;
    } catch {
      if (this.currentOrganizationId === organizationId) this.error = t.get('enterprise.load_failed');
      return false;
    } finally {
      if (this.currentOrganizationId === organizationId) this.loading = false;
    }
  }

  async selectEmployee(organizationId: string, employee: EnterpriseEmployee) {
    if (this.currentOrganizationId !== organizationId) return;

    this.error = '';
    try {
      const detail = await this.request<EnterpriseEmployee & { roles: EnterpriseRole[] }>(
        organizationId,
        `/employees/${employee.member.id}`
      );
      if (this.currentOrganizationId === organizationId) this.selectedEmployee = detail;
    } catch {
      if (this.currentOrganizationId === organizationId) this.error = t.get('enterprise.load_failed');
    }
  }

  async save(organizationId: string, path: string, method: 'POST' | 'PUT', body: unknown) {
    this.busy = true;
    this.error = '';
    try {
      await this.request(organizationId, path, method, body);
      const reloaded = await this.load(organizationId);
      if (!reloaded) return false;

      this.notice = t.get('enterprise.saved');
      return true;
    } catch {
      this.error = t.get('enterprise.request_failed');
      return false;
    } finally {
      this.busy = false;
    }
  }
}

export const enterpriseApi = new EnterpriseApi();
