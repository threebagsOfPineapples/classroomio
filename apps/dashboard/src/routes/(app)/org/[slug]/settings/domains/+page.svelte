<script>
  import { t } from '$lib/utils/functions/translations';
  import { DomainsPage } from '$features/settings/pages';
</script>

<svelte:head>
  <title>{$t('settings.tabs.domains_tab')} · {$t('enterprise.company_name')}</title>
</svelte:head>

<DomainsPage />
