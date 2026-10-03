import { apiClient, getRequestBaseUrl } from '$lib/utils/services/api';
import { t } from '$lib/utils/functions/translations';
import { enterpriseErrorMessage, enterpriseValidationMessage } from '../utils/enterprise-errors';
import { isImportableEmail } from '@cio/utils/validation/organization';
import { ZEnterpriseDepartment, ZEnterpriseEmployeeUpdate, ZEnterpriseRoles } from '@cio/utils/validation/enterprise';
import type { EnterpriseEmployee, EnterpriseEmployees, EnterpriseOverview, EnterpriseRole } from '../utils/types';

class EnterpriseApi {
  private currentOrganizationId: string | null = null;
  private employeeRequest = 0;
  overview = $state<EnterpriseOverview | null>(null);
  employees = $state<EnterpriseEmployees>([]);
  selectedEmployee = $state<(EnterpriseEmployee & { roles: EnterpriseRole[] }) | null>(null);
  loading = $state(false);
  busy = $state(false);
  error = $state('');
  notice = $state('');

  async inviteEmployee(organizationId: string, email: string) {
    this.notice = '';
    if (!isImportableEmail(email)) {
      this.error = t.get('audience.import.status.invalid_email');
      return false;
    }

    this.busy = true;
    this.error = '';
    try {
      const { orgApi } = await import('$features/org/api/org.svelte');
      const normalizedEmail = email.trim().toLowerCase();
      const recipient = { email: normalizedEmail };
      const result = await orgApi.importAudienceMembers(
        { recipients: [recipient], sendEmail: true, allCourses: false, allCohorts: false },
        { notify: false }
      );
      if (!result) {
        this.error = enterpriseErrorMessage(new Error(orgApi.error ?? ''));
        return false;
      }

      const row = result.data.rows[0];
      if (row && !['ready', 'already_member'].includes(row.status)) {
        this.error = t.get(`audience.import.status.${row.status}`);
        return false;
      }

      const reloaded = await this.load(organizationId);
      if (!reloaded) return false;

      if (result.data.emailsFailed > 0) {
        this.error = t.get('enterprise.admin_workflow.invite_email_failed');
        return false;
      }

      this.notice = t.get(
        result.data.emailsSent > 0
          ? 'enterprise.admin_workflow.invite_sent'
          : 'enterprise.admin_workflow.invite_existing'
      );
      return true;
    } catch (error) {
      this.error = enterpriseErrorMessage(error);
      return false;
    } finally {
      this.busy = false;
    }
  }

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
      throw new Error(enterpriseErrorMessage(error));
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

    const request = ++this.employeeRequest;
    this.error = '';
    try {
      const detail = await this.request<EnterpriseEmployee & { roles: EnterpriseRole[] }>(
        organizationId,
        `/employees/${employee.member.id}`
      );
      if (request !== this.employeeRequest || this.currentOrganizationId !== organizationId) return;

      this.selectedEmployee = detail;
      return detail;
    } catch {
      if (request === this.employeeRequest && this.currentOrganizationId === organizationId)
        this.error = t.get('enterprise.load_failed');
    }
  }

  async save(organizationId: string, path: string, method: 'POST' | 'PUT', body: unknown) {
    const schema = path.startsWith('/departments')
      ? ZEnterpriseDepartment
      : path.endsWith('/roles')
        ? ZEnterpriseRoles
        : ZEnterpriseEmployeeUpdate;
    const validated = schema.safeParse(body);
    if (!validated.success) {
      this.error = enterpriseValidationMessage(validated.error);
      return false;
    }

    this.busy = true;
    this.error = '';
    try {
      await this.request(organizationId, path, method, validated.data);
      const reloaded = await this.load(organizationId);
      if (!reloaded) return false;

      this.notice = t.get('enterprise.saved');
      return true;
    } catch (error) {
      this.error = error instanceof Error ? error.message : t.get('enterprise.request_failed');
      return false;
    } finally {
      this.busy = false;
    }
  }
}

export const enterpriseApi = new EnterpriseApi();
