<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { Button } from '@cio/ui/base/button';
  import { t } from '$lib/utils/functions/translations';
  import { currentOrg } from '$lib/utils/store/org';
  import { DingtalkApi } from '../api/dingtalk.svelte';
  import { ZDingtalkError } from '@cio/utils/validation/auth/dingtalk';

  let { intent = 'login', disabled = false }: { intent?: 'login' | 'link'; disabled?: boolean } = $props();
  const api = new DingtalkApi();
  const callbackCode = $derived(ZDingtalkError.safeParse(page.url.searchParams.get('dingtalk_error')));
  const callbackError = $derived(callbackCode.success ? `enterprise.dingtalk.errors.${callbackCode.data}` : '');
  const linkedNotice = $derived(page.url.searchParams.get('dingtalk_linked') === '1');

  onMount(() => {
    void api.load($currentOrg.id, intent === 'link');
  });
</script>

{#if intent === 'login' || api.enabled || api.errorKey || callbackError}
  <section class="space-y-4" aria-label={$t('enterprise.dingtalk.title')}>
    {#if intent === 'link'}
      <div>
        <h2 class="ui:text-foreground text-lg font-semibold">{$t('enterprise.dingtalk.title')}</h2>
        <p class="ui:text-muted-foreground mt-1 text-sm">{$t('enterprise.dingtalk.description')}</p>
      </div>
    {/if}
    {#if callbackError || api.errorKey}
      <div role="alert" class="ui:text-destructive space-y-2 text-sm">
        <p>{$t(api.errorKey || callbackError)}</p>
        {#if api.errorKey}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={api.loading}
            onclick={() => api.load($currentOrg.id, intent === 'link')}
          >
            {$t('enterprise.ui_v2.retry')}
          </Button>
        {/if}
      </div>
      {#if (api.errorKey || callbackError).endsWith('.reauth_required')}
        <Button size="sm" variant="outline" href="/login?redirect=%2Flms%2Fsettings%2Fintegrations">
          {$t('login.login')}
        </Button>
      {/if}
    {/if}
    {#if intent === 'link' && linkedNotice && api.linked}
      <p role="status" class="ui:text-primary text-sm">{$t('enterprise.dingtalk.linked_notice')}</p>
    {/if}
    {#if intent === 'link' && api.linked && api.employee}
      <div class="ui:border-border ui:bg-muted/30 rounded-xl border p-4">
        <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {#each [['name', api.employee.name], ['employee_no', api.employee.employeeNo], ['position', api.employee.position], ['mobile', api.employee.mobile], ['company_email', api.employee.companyEmail], ['department_ids', api.employee.departmentIds.length ? api.employee.departmentIds.join('、') : null]] as [label, value]}
            <div class="min-w-0">
              <dt class="ui:text-muted-foreground text-xs">{$t(`enterprise.dingtalk.fields.${label}`)}</dt>
              <dd class="ui:text-foreground mt-1 text-sm break-words">{value || '—'}</dd>
            </div>
          {/each}
        </dl>
        <p class="ui:text-muted-foreground mt-4 text-xs">{$t('enterprise.dingtalk.read_only')}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={api.loading}
        loading={api.loading}
        onclick={() => api.load($currentOrg.id, true)}
      >
        {$t('enterprise.dingtalk.refresh')}
      </Button>
    {:else if intent === 'login' || (api.enabled && !api.errorKey)}
      <Button
        type="button"
        variant="outline"
        class="w-full"
        loading={api.loading}
        disabled={disabled || api.loading || !api.enabled}
        onclick={() => api.start($currentOrg.id, intent)}
      >
        {$t(intent === 'login' ? 'enterprise.dingtalk.login' : 'enterprise.dingtalk.link')}
      </Button>
      {#if intent === 'link'}
        <p class="ui:text-muted-foreground text-xs">{$t('enterprise.dingtalk.binding_help')}</p>
      {:else if api.enabled === false && !api.loading && !api.errorKey && !callbackError}
        <p class="ui:text-muted-foreground text-xs">{$t('enterprise.dingtalk.paused_hint')}</p>
      {/if}
    {/if}
  </section>
{/if}
