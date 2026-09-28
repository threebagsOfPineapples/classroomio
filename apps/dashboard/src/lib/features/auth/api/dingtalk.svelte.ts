import { authClient } from '$lib/utils/services/auth/client';
import { ZDingtalkError } from '@cio/utils/validation/auth/dingtalk';
import type { DingtalkEmployee } from '../utils/types';

export class DingtalkApi {
  enabled = $state<boolean | null>(null);
  loading = $state(false);
  linked = $state(false);
  employee = $state<DingtalkEmployee>(null);
  errorKey = $state('');

  setError(error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : error;
    const parsed = ZDingtalkError.safeParse(code);
    this.errorKey = `enterprise.dingtalk.errors.${parsed.success ? parsed.data : 'provider_error'}`;
  }

  async load(organizationId: string, includeEmployee: boolean) {
    if (this.loading) return;

    this.loading = true;
    this.errorKey = '';
    if (includeEmployee) {
      this.employee = null;
      this.linked = false;
    }

    try {
      const query = organizationId ? { organizationId } : {};
      const config = await authClient.dingtalk.config({ query });
      if (config.error) throw config.error;

      this.enabled = config.data?.enabled ?? false;
      if (!this.enabled || !includeEmployee) return;

      const result = await authClient.dingtalk.employee();
      if (result.error) throw result.error;
      if (!result.data || !('employee' in result.data)) throw result.data;

      this.linked = result.data.linked;
      this.employee = result.data.employee;
    } catch (error) {
      this.enabled = null;
      this.setError(error);
    } finally {
      this.loading = false;
    }
  }

  async start(organizationId: string, intent: 'login' | 'link') {
    if (this.loading) return;

    this.loading = true;
    this.errorKey = '';
    try {
      const result = await authClient.dingtalk.start({ ...(organizationId ? { organizationId } : {}), intent });
      if (result.error) throw result.error;
      if (!result.data || !('url' in result.data)) throw result.data;

      const destination = new URL(result.data.url);
      if (destination.origin !== 'https://login.dingtalk.com' || destination.pathname !== '/oauth2/auth') {
        throw new Error('Invalid authorization URL');
      }

      window.location.assign(destination.href);
    } catch (error) {
      this.setError(error);
      this.loading = false;
    }
  }
}
