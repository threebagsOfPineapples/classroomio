<script lang="ts">
  import { t } from '$lib/utils/functions/translations';
  import { OrgAiTutorSettingsPage } from '$features/ai-tutor-settings';
</script>

<svelte:head>
  <title>{$t('settings.tabs.ai_tutor_tab')} · {$t('enterprise.company_name')}</title>
</svelte:head>

<OrgAiTutorSettingsPage />
