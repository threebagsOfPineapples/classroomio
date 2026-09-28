<script>
  import { AiCreditsPage } from '$features/settings/pages';
  import { t } from '$lib/utils/functions/translations';
  import * as Page from '@cio/ui/base/page';
</script>

<svelte:head>
  <title>{$t('settings.tabs.ai_credits_tab')} · {$t('enterprise.company_name')}</title>
</svelte:head>

<Page.Header>
  <Page.HeaderContent>
    <Page.Title>{$t('settings.ai_credits.sub_title')}</Page.Title>
    <Page.Subtitle>{$t('settings.ai_credits.page_subtitle')}</Page.Subtitle>
  </Page.HeaderContent>
</Page.Header>
<Page.Body>
  {#snippet child()}
    <AiCreditsPage />
  {/snippet}
</Page.Body>
