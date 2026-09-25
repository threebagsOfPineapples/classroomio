<script lang="ts">
  import { CommunityQuestionPage } from '$features/community/pages';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { t } from '$lib/utils/functions/translations';

  let { data } = $props();

  const communityPath = $derived(page.url.pathname.replace(/\/[^/]+$/, ''));
</script>

<svelte:head>
  <title>{$t('lms_navigation.community')} · {$t('enterprise.company_name')}</title>
</svelte:head>

<CommunityQuestionPage slug={data.slug} backHref={resolve(communityPath, {})} />
