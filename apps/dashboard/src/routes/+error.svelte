<script>
  import { page } from '$app/state';
  import { Button } from '@cio/ui/base/button';
  import { Empty } from '@cio/ui/custom/empty';
  import { HomeIcon, HoverableItem } from '@cio/ui/custom/moving-icons';
  import { t } from '$lib/utils/functions/translations';
  import HeartCrack from '@lucide/svelte/icons/heart-crack';

  const isNotFound = $derived(page.status === 404);

  console.error('Error message:', page.error?.message);
  console.error('Error page:', page.url);

  function goHome() {
    window.location.href = '/';
  }
</script>

<svelte:head>
  <title
    >{isNotFound ? $t('common.page_not_found') : $t('login.auth_failure.title')} · {$t(
      'enterprise.company_name'
    )}</title
  >
</svelte:head>

{#if isNotFound}
  <Empty
    title={$t('common.page_not_found')}
    description={$t('common.page_not_found_description')}
    icon={HeartCrack}
    variant="page"
    layout="full-page"
  >
    <div class="flex gap-2">
      <HoverableItem>
        {#snippet children(isHovered)}
          <Button onclick={goHome}>
            <HomeIcon {isHovered} size={16} ariaHidden={true} />
            {$t('login.auth_failure.back_home')}
          </Button>
        {/snippet}
      </HoverableItem>
    </div>
  </Empty>
{:else}
  <Empty
    title={$t('login.auth_failure.title')}
    description={$t('login.auth_failure.description')}
    icon={HeartCrack}
    variant="page"
    layout="full-page"
  >
    <div class="flex gap-2">
      <Button variant="secondary" size="xs" onclick={() => window.location.reload()}
        >{$t('common.app_update.reload')}</Button
      >
      <HoverableItem>
        {#snippet children(isHovered)}
          <Button size="xs" onclick={goHome}>
            <HomeIcon {isHovered} size={16} ariaHidden={true} />
            {$t('login.auth_failure.back_home')}
          </Button>
        {/snippet}
      </HoverableItem>
    </div>
  </Empty>
{/if}
