<script>
  import { t } from '$lib/utils/functions/translations';
  import { TeamsPage } from '$features/settings/pages';
</script>

<svelte:head>
  <title>{$t('settings.tabs.teams_tab')} · {$t('enterprise.company_name')}</title>
</svelte:head>

<TeamsPage />
