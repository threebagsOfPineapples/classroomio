import { t } from '$lib/utils/functions/translations';
import { enterpriseApi } from './enterprise.svelte';
import type { MyTrainingAssignments } from '../utils/types';

class MyTrainingApi {
  private loadKey: string | null = null;
  assignments = $state<MyTrainingAssignments>([]);
  loading = $state(false);
  error = $state('');

  clear() {
    this.loadKey = null;
    this.assignments = [];
    this.loading = false;
    this.error = '';
  }

  async load(organizationId: string, profileId: string) {
    const loadKey = `${organizationId}:${profileId}`;
    this.loadKey = loadKey;
    this.assignments = [];
    this.loading = true;
    this.error = '';
    try {
      const assignments = await enterpriseApi.request<MyTrainingAssignments>(organizationId, '/my-training');
      if (this.loadKey === loadKey) this.assignments = assignments;
    } catch {
      if (this.loadKey === loadKey) this.error = t.get('enterprise.my_training.load_failed');
    } finally {
      if (this.loadKey === loadKey) this.loading = false;
    }
  }
}

export const myTrainingApi = new MyTrainingApi();
