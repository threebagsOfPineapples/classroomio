<script lang="ts">
  import { t } from '$lib/utils/functions/translations';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import * as Sidebar from '@cio/ui/base/sidebar';
  import { Skeleton } from '@cio/ui/base/skeleton';
  import { currentOrg } from '$lib/utils/store/org';
  import { isOrgStudent } from '$lib/utils/store/app';
  import { appInitApi } from '$features/app/init.svelte';
  import { AppHeader } from '$features/ui';
  import { PUBLIC_IS_SELFHOSTED } from '$env/static/public';

  import { OrgSidebar } from '$features/ui/sidebar/org-sidebar';
  import SettingsSidebar from '$features/ui/sidebar/settings-sidebar.svelte';
  import { AddOrgModal } from '$features/org';
  import EnterpriseSidebar from '$features/ui/navigation/enterprise-sidebar.svelte';
  import { ScrollToTop } from '@cio/ui/custom/scroll-to-top';

  let { data, children } = $props();
  const isSettingsRoute = $derived(/\/settings(?:\/|$)/.test(page.url.pathname));
  const useEnterpriseShell = $derived(PUBLIC_IS_SELFHOSTED === 'true' && !isSettingsRoute);

  function redirect(siteName: string | null) {
    if (!siteName) return;

    const newUrl = page.url.pathname.replace('*', siteName);
    goto(newUrl + page.url.search);
  }

  $effect(() => {
    data.orgName === '*' && redirect($currentOrg.siteName);
  });

  $effect(() => {
    // Students must not use the admin org dashboard on app.* — send them to LMS.
    // isStudentExperience is false on the app host in cloud mode even for students.
    if (appInitApi.isInitializedAndReady && $isOrgStudent) {
      goto(resolve('/lms', {}));
    }
  });
</script>

{#if PUBLIC_IS_SELFHOSTED !== 'true'}
  <AddOrgModal />
{/if}

<Sidebar.Provider
  class="training-shell training-shell--admin"
  style={useEnterpriseShell ? '--sidebar-width: 14.5rem;' : undefined}
>
  {#if isSettingsRoute}
    <SettingsSidebar />
  {:else if useEnterpriseShell}
    <EnterpriseSidebar />
  {:else}
    <OrgSidebar />
  {/if}

  <Sidebar.Inset>
    {#if isSettingsRoute}
      <div class="flex h-10 items-center px-3 md:hidden">
        <Sidebar.Trigger
          aria-label={$t('common.toggle_sidebar')}
          title={$t('common.toggle_sidebar')}
          testId="settings-sidebar-trigger-mobile"
          variant="secondary"
        />
      </div>
    {:else}
      <AppHeader enterprise={useEnterpriseShell} />
    {/if}

    <div class="training-page-container">
      {#if data.orgName === '*'}
        <div class="grid auto-rows-min gap-4 md:grid-cols-3">
          <Skeleton class="aspect-video rounded-xl" />
          <Skeleton class="aspect-video rounded-xl" />
          <Skeleton class="aspect-video rounded-xl" />
        </div>
        <Skeleton class="h-[50vh] w-full rounded-xl" />
      {:else}
        {@render children?.()}
      {/if}
    </div>
  </Sidebar.Inset>
  <ScrollToTop label={$t('common.scroll_to_top')} />
</Sidebar.Provider>
