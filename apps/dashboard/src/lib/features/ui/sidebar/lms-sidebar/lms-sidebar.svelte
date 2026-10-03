<script lang="ts">
  import { t } from '$lib/utils/functions/translations';
  import * as Sidebar from '@cio/ui/base/sidebar';
  import { profile } from '$lib/utils/store/user';
  import { orgs } from '$lib/utils/store/org';

  import NavMain from './nav-main.svelte';
  import OrgLogo from '../org-sidebar/org-logo.svelte';
  import { SidebarFooterMenu } from '../footer';
  import SidebarSkeleton from '../sidebar-skeleton.svelte';

  const isOrgLoaded = $derived($orgs.length > 0 && $profile.id);
</script>

{#if !isOrgLoaded}
  <SidebarSkeleton />
{:else}
  <Sidebar.Root
    collapsible="icon"
    mobileTitle={$t('interface_copy.menu')}
    mobileDescription={$t('common.toggle_sidebar')}
    closeLabel={$t('interface_copy.close_menu')}
  >
    <Sidebar.Header>
      <OrgLogo />
    </Sidebar.Header>

    <Sidebar.Content>
      <NavMain />
    </Sidebar.Content>

    <Sidebar.Footer class="gap-4!">
      <SidebarFooterMenu />
    </Sidebar.Footer>

    <Sidebar.Rail aria-label={$t('common.toggle_sidebar')} title={$t('common.toggle_sidebar')} />
  </Sidebar.Root>
{/if}
