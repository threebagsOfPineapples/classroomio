<script lang="ts">
  import * as Sidebar from '@cio/ui/base/sidebar';
  import { ScrollToTop } from '@cio/ui/custom/scroll-to-top';
  import EnterpriseSidebar from '$features/ui/navigation/enterprise-sidebar.svelte';
  import AppHeader from '$features/ui/navigation/app-header.svelte';
  import { t } from '$lib/utils/functions/translations';

  let { children } = $props();
</script>

<Sidebar.Provider class="training-shell training-shell--admin" style="--sidebar-width: 14.5rem;">
  <EnterpriseSidebar />
  <Sidebar.Inset>
    <AppHeader enterprise />
    <div class="training-page-container">
      {@render children?.()}
    </div>
  </Sidebar.Inset>
  <ScrollToTop label={$t('common.scroll_to_top')} />
</Sidebar.Provider>
