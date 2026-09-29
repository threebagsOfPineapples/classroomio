<script lang="ts">
  import { t } from '$lib/utils/functions/translations';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import * as Sidebar from '@cio/ui/base/sidebar';
  import { Skeleton } from '@cio/ui/base/skeleton';
  import { currentOrg, currentOrgPath, isOrgAdmin } from '$lib/utils/store/org';
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
  const courseSections = $derived([
    { path: 'courses', key: 'org_navigation.courses' },
    { path: 'media', key: 'org_navigation.media' },
    ...($isOrgAdmin ? [{ path: 'tags', key: 'org_navigation.tags' }] : [])
  ]);
  const currentSection = $derived(page.url.pathname.slice($currentOrgPath.length + 1).split('/')[0]);

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
    <AppHeader enterprise={PUBLIC_IS_SELFHOSTED === 'true'} />

    <div class="training-page-container">
      {#if useEnterpriseShell && courseSections.some((section) => section.path === currentSection)}
        <nav
          aria-label={$t('enterprise.navigation.course_resources')}
          class="ui:border-border mb-4 flex gap-6 overflow-x-auto border-b px-1"
        >
          {#each courseSections as section (section.path)}
            <a
              href={`${$currentOrgPath}/${section.path}`}
              aria-current={section.path === currentSection ? 'page' : undefined}
              class="shrink-0 border-b-2 px-1 py-3 text-sm font-medium {section.path === currentSection
                ? 'ui:border-primary ui:text-primary'
                : 'ui:text-muted-foreground ui:hover:text-foreground border-transparent'}">{$t(section.key)}</a
            >
          {/each}
        </nav>
      {/if}
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
