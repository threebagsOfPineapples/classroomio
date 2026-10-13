import { t } from '$lib/utils/functions/translations';
import { ZEnterpriseMemberScopes } from '@cio/utils/validation/enterprise';
import { enterpriseValidationMessage } from '../utils/enterprise-errors';
import { departmentPath, scopeEmployeeLabel, trainingScopesFingerprint } from '../utils/training-scopes';
import type {
  EnterpriseDepartment,
  EnterpriseEmployees,
  EnterpriseOverview,
  TrainingScopes,
  TrainingScopesDraft
} from '../utils/types';
import { enterpriseApi } from './enterprise.svelte';

export class TrainingScopesApi {
  private requestId = 0;
  private organizationId = '';
  private memberId = 0;
  private savedFingerprint = $state('');
  departments = $state<EnterpriseDepartment[]>([]);
  employees = $state<EnterpriseEmployees>([]);
  departmentIds = $state<string[]>([]);
  memberIds = $state<number[]>([]);
  departmentSearch = $state('');
  employeeSearch = $state('');
  loading = $state(false);
  busy = $state(false);
  loaded = $state(false);
  error = $state('');
  notice = $state('');
  hasChanges = $derived(
    this.loaded &&
      trainingScopesFingerprint({ departmentIds: this.departmentIds, memberIds: this.memberIds }) !==
        this.savedFingerprint
  );
  filteredDepartments = $derived.by(() => {
    const search = this.departmentSearch.trim().toLocaleLowerCase();
    return this.departments.filter((department) =>
      departmentPath(department, this.departments).toLocaleLowerCase().includes(search)
    );
  });
  filteredEmployees = $derived.by(() => {
    const search = this.employeeSearch.trim().toLocaleLowerCase();
    return this.employees.filter((employee) =>
      scopeEmployeeLabel(employee, this.departments).toLocaleLowerCase().includes(search)
    );
  });
  missingDepartmentIds = $derived(this.departmentIds.filter((id) => !this.departments.some((item) => item.id === id)));
  missingMemberIds = $derived(this.memberIds.filter((id) => !this.employees.some((item) => item.member.id === id)));

  reset() {
    ++this.requestId;
    this.organizationId = '';
    this.memberId = 0;
    this.departmentIds = [];
    this.memberIds = [];
    this.departments = [];
    this.employees = [];
    this.savedFingerprint = '';
    this.loaded = false;
    this.loading = false;
    this.busy = false;
    this.error = '';
    this.notice = '';
  }

  async load(organizationId: string, memberId: number) {
    this.reset();
    this.organizationId = organizationId;
    this.memberId = memberId;
    const requestId = this.requestId;
    this.loading = true;
    try {
      const [overview, employees, scopes] = await Promise.all([
        enterpriseApi.request<EnterpriseOverview>(organizationId, '/overview'),
        enterpriseApi.request<EnterpriseEmployees>(organizationId, '/employees'),
        enterpriseApi.request<TrainingScopes>(organizationId, `/employees/${memberId}/training-scopes`)
      ]);
      if (requestId !== this.requestId) return;
      if (!overview.isSuperAdmin) throw new Error(t.get('common.restricted_description'));

      this.departments = overview.departments;
      this.employees = employees;
      this.applyScopes(scopes);
      this.loaded = true;
    } catch (error) {
      if (requestId === this.requestId)
        this.error = error instanceof Error ? error.message : t.get('enterprise.load_failed');
    } finally {
      if (requestId === this.requestId) this.loading = false;
    }
  }

  toggleDepartment(departmentId: string) {
    if (!this.loaded || this.busy || this.loading) return;

    this.departmentIds = this.departmentIds.includes(departmentId)
      ? this.departmentIds.filter((id) => id !== departmentId)
      : [...this.departmentIds, departmentId];
    this.notice = '';
  }

  toggleMember(memberId: number) {
    if (!this.loaded || this.busy || this.loading) return;

    this.memberIds = this.memberIds.includes(memberId)
      ? this.memberIds.filter((id) => id !== memberId)
      : [...this.memberIds, memberId];
    this.notice = '';
  }

  private applyScopes(scopes: TrainingScopes) {
    this.departmentIds = [...scopes.departmentIds];
    this.memberIds = [...scopes.memberIds];
    this.savedFingerprint = trainingScopesFingerprint(scopes);
  }

  async save() {
    if (!this.loaded || this.loading || this.busy || !this.hasChanges) return false;

    const organizationId = this.organizationId;
    const memberId = this.memberId;
    const requestId = this.requestId;
    const draft: TrainingScopesDraft = { departmentIds: [...this.departmentIds], memberIds: [...this.memberIds] };
    const validated = ZEnterpriseMemberScopes.safeParse(draft);
    if (!validated.success) {
      this.error = enterpriseValidationMessage(validated.error);
      return false;
    }

    this.busy = true;
    this.error = '';
    this.notice = '';
    let saved = false;
    try {
      const path = `/employees/${memberId}/training-scopes`;
      const previous = await enterpriseApi.request<TrainingScopes>(organizationId, path);
      if (requestId !== this.requestId) return false;
      if (trainingScopesFingerprint(previous) !== this.savedFingerprint) {
        this.error = t.get('enterprise.training_scopes.concurrent_change');
        return false;
      }

      await enterpriseApi.request<TrainingScopes>(organizationId, path, 'PUT', validated.data);
      saved = true;
      if (requestId !== this.requestId) return false;

      const scopes = await enterpriseApi.request<TrainingScopes>(organizationId, path);
      if (requestId !== this.requestId) return false;

      this.applyScopes(scopes);
      if (trainingScopesFingerprint(scopes) !== trainingScopesFingerprint(draft)) {
        this.error = t.get('enterprise.training_scopes.readback_changed');
        return false;
      }

      this.notice = t.get('enterprise.training_scopes.saved_verified');
      return true;
    } catch (error) {
      if (requestId === this.requestId) {
        this.error = saved
          ? t.get('enterprise.training_scopes.readback_failed')
          : error instanceof Error
            ? error.message
            : t.get('enterprise.request_failed');
        if (saved) this.loaded = false;
      }

      return false;
    } finally {
      if (requestId === this.requestId) this.busy = false;
    }
  }
}
