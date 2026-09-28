<script>
  import { IntegrationsPage } from '$features/settings/pages';
  import { t } from '$lib/utils/functions/translations';
  import * as Page from '@cio/ui/base/page';
</script>

<svelte:head>
  <title>{$t('settings.tabs.integrations_tab')} · {$t('enterprise.company_name')}</title>
</svelte:head>

<Page.Header>
  <Page.HeaderContent>
    <Page.Title>{$t('settings.integrations.heading')}</Page.Title>
    <Page.Subtitle>{$t('settings.integrations.page_subtitle')}</Page.Subtitle>
  </Page.HeaderContent>
</Page.Header>
<Page.Body>
  {#snippet child()}
    <IntegrationsPage />
  {/snippet}
</Page.Body>
