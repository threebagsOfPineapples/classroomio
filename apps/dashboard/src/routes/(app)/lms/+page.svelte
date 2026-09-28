<script lang="ts">
  import { DashboardPage } from '$features/lms/pages';
  import { getGreeting } from '$lib/utils/functions/date';
  import { locale, t } from '$lib/utils/functions/translations';
  import { profile } from '$lib/utils/store/user';
  import * as Page from '@cio/ui/base/page';

  const todayLabel = $derived(
    new Intl.DateTimeFormat($locale === 'zh' ? 'zh-CN' : $locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    }).format(new Date())
  );

  const firstName = $derived($profile.fullname?.trim().split(/\s+/)[0] || $t('dashboard.learner'));
</script>

<svelte:head>
  <title>{$t('lms_navigation.home')} · {$t('enterprise.company_name')}</title>
</svelte:head>

<Page.Root class="w-full">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>
        {$t(getGreeting())},
        <span>{firstName}</span>
      </Page.Title>
      <Page.Subtitle>
        {$t('enterprise.ui_v2.home_subtitle')}
      </Page.Subtitle>
    </Page.HeaderContent>
    <p class="learner-date">{todayLabel}</p>
  </Page.Header>

  <Page.Body>
    {#snippet child()}
      <DashboardPage />
    {/snippet}
  </Page.Body>
</Page.Root>
