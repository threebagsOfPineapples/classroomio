<script lang="ts">
  import InterfaceLanguage from '$features/ui/navigation/interface-language.svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import BellIcon from '@lucide/svelte/icons/bell';
  import MenuIcon from '@lucide/svelte/icons/menu';
  import { Button } from '@cio/ui/base/button';
  import * as Popover from '@cio/ui/base/popover';
  import * as DropdownMenu from '@cio/ui/base/dropdown-menu';
  import Search from '../search.svelte';
  import { getLmsNavigationItems } from './lms-navigation';
  import { SidebarFooterMenu } from '../sidebar/footer';
  import { t } from '$lib/utils/functions/translations';
  import { currentOrg, isOrgTeamMember } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import { notificationsApi } from '$features/notifications/api/notifications.svelte';
  import NotificationsPanel from '$features/notifications/components/notifications-panel.svelte';

  interface Props {
    hideSearch?: boolean;
  }

  let { hideSearch = false }: Props = $props();
  const notificationCount = $derived(notificationsApi.unreadCount);
  const navigation = $derived(getLmsNavigationItems($currentOrg, $t, page.url.pathname).filter((item) => !item.items));

  $effect(() => {
    if (!$currentOrg.id || !$profile.id) return;

    void notificationsApi.loadTraining($currentOrg.id, $profile.id);
  });

  onMount(() => {
    void notificationsApi.fetchOnce();
  });
</script>

<header class="learner-header">
  <div class="learner-toolbar">
    <a href="/lms" class="enterprise-brand">
      <img src="/enterprise-training-icon.png" alt="" width="40" height="40" />
      <span>
        <strong>{$t('enterprise.interface.platform_name')}</strong>
        <small>{$t('enterprise.company_name')}</small>
      </span>
    </a>
    <span class="grow"></span>
    <InterfaceLanguage />

    {#if !hideSearch}
      <div class="hidden lg:block"><Search scope="lms" /></div>

      <div class="relative">
        <Popover.Root
          onOpenChange={(open) => {
            if (open) void notificationsApi.refresh();
          }}
        >
          <Popover.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                variant="secondary"
                size="icon"
                testId="lms-notifications-trigger"
                aria-label={$t('settings.tabs.notifications_tab')}
              >
                <BellIcon class="custom rounded-full" />
              </Button>
            {/snippet}
          </Popover.Trigger>
          <Popover.Content align="end" sideOffset={8} class="ui:p-0! w-[min(460px,calc(100vw-2rem))]">
            <NotificationsPanel />
          </Popover.Content>
        </Popover.Root>

        {#if notificationCount > 0}
          <span
            class="ui:bg-primary ui:text-primary-foreground pointer-events-none absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium"
          >
            {notificationCount}
          </span>
        {/if}
      </div>
    {/if}
    {#if $isOrgTeamMember}
      <Button href="/admin" variant="outline" size="sm" testId="switch-to-management">
        {$t('enterprise.interface.admin_portal')}
      </Button>
    {/if}
    <div class="learner-user-menu"><SidebarFooterMenu compact /></div>
  </div>
  <nav class="learner-navigation" aria-label={$t('enterprise.interface.learner_portal')}>
    {#each navigation as item (item.url)}
      <a href={item.url} class:active={item.isActive} aria-current={item.isActive ? 'page' : undefined}>
        {item.title}
      </a>
    {/each}
  </nav>
  <nav class="learner-mobile-navigation" aria-label={$t('enterprise.interface.learner_portal')}>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="secondary" size="sm" testId="learner-navigation-trigger">
            <MenuIcon class="size-4" />
            {navigation.find((item) => item.isActive)?.title ?? $t('enterprise.interface.learner_portal')}
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        {#each navigation as item (item.url)}
          <DropdownMenu.Item>
            <a href={item.url} aria-current={item.isActive ? 'page' : undefined} class="w-full">{item.title}</a>
          </DropdownMenu.Item>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </nav>
</header>
