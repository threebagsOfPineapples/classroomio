<script lang="ts">
  import { onMount } from 'svelte';
  import { Separator } from '@cio/ui/base/separator';
  import * as Sidebar from '@cio/ui/base/sidebar';
  import BellIcon from '@lucide/svelte/icons/bell';
  import { Button } from '@cio/ui/base/button';
  import * as Popover from '@cio/ui/base/popover';
  import Search from '$features/ui/search.svelte';
  import AppBreadcrumbs from './app-breadcrumbs.svelte';
  import { currentOrg } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import { setupProgressApi } from '$features/setup/api/setup-progress.svelte';
  import { notificationsApi } from '$features/notifications/api/notifications.svelte';
  import NotificationsPanel from '$features/notifications/components/notifications-panel.svelte';
  import AppSetup from './app-setup.svelte';
  import VisitOrgSiteBtn from '$features/ui/visit-org-site-btn.svelte';
  import { t } from '$lib/utils/functions/translations';

  let { enterprise = false }: { enterprise?: boolean } = $props();

  const siteName = $derived($currentOrg.siteName);
  const notificationCount = $derived(notificationsApi.unreadCount);

  $effect(() => {
    if (!siteName) return;

    setupProgressApi.fetchSetupProgress(siteName);
  });

  $effect(() => {
    if (!$currentOrg.id || !$profile.id) return;

    void notificationsApi.loadTraining($currentOrg.id, $profile.id);
  });

  onMount(() => {
    notificationsApi.fetchOnce();
  });
</script>

<header
  class="ui:border-border ui:bg-background sticky top-0 z-50 flex h-12 w-full shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-8"
>
  <div class="flex w-full items-center gap-2 px-4">
    <Sidebar.Trigger
      aria-label={$t('common.toggle_sidebar')}
      title={$t('common.toggle_sidebar')}
      testId="app-sidebar-trigger"
      variant="secondary"
    />

    <div class="h-4 w-2">
      <Separator orientation="vertical" />
    </div>

    {#if enterprise}
      <span class="text-sm font-medium">{$t('enterprise.interface.admin_portal')}</span>
    {:else}
      <AppBreadcrumbs />
    {/if}

    <span class="grow"></span>

    {#if enterprise}
      <Button href="/lms" variant="outline" size="sm">{$t('enterprise.interface.learner_portal')}</Button>
    {:else}
      <AppSetup />
      <VisitOrgSiteBtn variant="outline" labelKey="dashboard.open_academy" />
    {/if}

    <div class="hidden sm:block"><Search /></div>

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
              testId="app-notifications-trigger"
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
  </div>
</header>
