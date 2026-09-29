<script lang="ts">
  import { t } from '$lib/utils/functions/translations';
  import * as Sidebar from '@cio/ui/base/sidebar';
  import { profile } from '$lib/utils/store/user';
  import { currentOrg, orgs } from '$lib/utils/store/org';

  import AppLogo from './app-logo.svelte';
  import NavMain from './nav-main.svelte';
  import { orgNavCountsApi } from './org-nav-counts.svelte';
  import { SidebarFooterMenu } from '../footer';
  import SidebarSkeleton from '../sidebar-skeleton.svelte';

  const isOrgLoaded = $derived($orgs.length > 0 && $profile.id);

  $effect(() => {
    if (!isOrgLoaded || !$currentOrg.id) return;
    void orgNavCountsApi.ensureCounts($currentOrg.id);
  });
</script>

{#if !isOrgLoaded}
  <SidebarSkeleton />
{:else}
  <Sidebar.Root collapsible="icon" class="enterprise-sidebar">
    <Sidebar.Header>
      <AppLogo />
    </Sidebar.Header>

    <Sidebar.Content class="gap-0!">
      <NavMain />
    </Sidebar.Content>

    <Sidebar.Footer class="gap-4!">
      <SidebarFooterMenu />
    </Sidebar.Footer>

    <Sidebar.Rail aria-label={$t('common.toggle_sidebar')} title={$t('common.toggle_sidebar')} />
  </Sidebar.Root>
{/if}
