<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { AuthUI } from '$features/ui';
  import { Button } from '@cio/ui/base/button';
  import * as Card from '@cio/ui/base/card';
  import { currentOrg } from '$lib/utils/store/org';
  import { t } from '$lib/utils/functions/translations';
  import * as Avatar from '@cio/ui/base/avatar';

  const errorCode = $derived(new URLSearchParams(page.url.search).get('error'));

  function goHome() {
    window.location.href = resolve('/', {});
  }
</script>

<svelte:head>
  <title>{$t('login.auth_failure.title')} · {$t('enterprise.company_name')}</title>
</svelte:head>

<AuthUI isLogin={false} showOnlyContent={true}>
  <div class="flex flex-col items-center gap-4">
    <Avatar.Root>
      <Avatar.Image
        src={$currentOrg.avatarUrl || '/enterprise-training-icon.png'}
        alt={$currentOrg.name || $t('enterprise.company_name')}
      />
      <Avatar.Fallback>{$currentOrg.name || $t('enterprise.company_name')}</Avatar.Fallback>
    </Avatar.Root>

    <p class="text-xl font-semibold">{$t('login.auth_failure.title')}</p>

    {#if errorCode}
      <Card.Description class="border px-2 py-1">
        {$t('login.auth_failure.code')}: {errorCode}
      </Card.Description>
    {/if}

    <Card.Description class="text-center">
      {$t('login.auth_failure.description')}
    </Card.Description>

    <Button onclick={goHome}>{$t('login.auth_failure.back_home')}</Button>
  </div>
</AuthUI>
