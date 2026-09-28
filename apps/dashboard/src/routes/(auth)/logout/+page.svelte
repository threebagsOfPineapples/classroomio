<script lang="ts">
  import { onMount } from 'svelte';
  import { logout } from '$lib/utils/functions/logout';
  import { t } from '$lib/utils/functions/translations';

  onMount(() => {
    logout();
  });
</script>

<svelte:head>
  <title>{$t('settings.profile.logout')} · {$t('enterprise.company_name')}</title>
</svelte:head>

<div class="flex min-h-screen w-full items-center justify-center">
  <div role="status">{$t('login.logging_out')}</div>
</div>
