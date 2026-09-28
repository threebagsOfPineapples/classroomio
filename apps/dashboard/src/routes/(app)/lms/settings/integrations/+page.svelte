<script lang="ts">
  import { IntegrationsPage } from '$features/settings/pages';
  import { t } from '$lib/utils/functions/translations';
  import * as Page from '@cio/ui/base/page';
  import Dingtalk from '$features/auth/components/dingtalk.svelte';
</script>

<svelte:head>
  <title>{$t('settings.integrations.heading')} · {$t('enterprise.company_name')}</title>
</svelte:head>

<Page.Header>
  <Page.HeaderContent>
    <Page.Title>{$t('settings.integrations.heading')}</Page.Title>
  </Page.HeaderContent>
</Page.Header>
<Page.Body>
  {#snippet child()}
    <Dingtalk intent="link" />
    <IntegrationsPage />
  {/snippet}
</Page.Body>
