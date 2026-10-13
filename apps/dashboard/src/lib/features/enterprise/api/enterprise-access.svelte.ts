import type { EnterpriseOverview } from '../utils/types';
import { enterpriseApi } from './enterprise.svelte';

class EnterpriseAccessApi {
  private requestId = 0;
  organizationId = $state('');
  overview = $state<EnterpriseOverview | null>(null);
  loading = $state(false);
  canViewTraining = $derived(
    Boolean(this.overview?.canManageTraining || this.overview?.roles.includes('DEPARTMENT_MANAGER'))
  );

  async load(organizationId: string) {
    const requestId = ++this.requestId;
    this.organizationId = organizationId;
    this.overview = null;
    this.loading = Boolean(organizationId);
    if (!organizationId) return;

    try {
      const overview = await enterpriseApi.request<EnterpriseOverview>(organizationId, '/overview');
      if (requestId !== this.requestId) return;

      this.overview = overview;
    } catch {
      if (requestId === this.requestId) this.overview = null;
    } finally {
      if (requestId === this.requestId) this.loading = false;
    }
  }
}

export const enterpriseAccessApi = new EnterpriseAccessApi();
