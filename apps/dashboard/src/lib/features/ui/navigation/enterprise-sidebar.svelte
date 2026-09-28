<script lang="ts">
  import { page } from '$app/state';
  import * as Sidebar from '@cio/ui/base/sidebar';
  import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
  import Building from '@lucide/svelte/icons/building-2';
  import Users from '@lucide/svelte/icons/users';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Calendar from '@lucide/svelte/icons/calendar-days';
  import ClipboardCheck from '@lucide/svelte/icons/clipboard-check';
  import Grid from '@lucide/svelte/icons/grid-2x2';
  import Chart from '@lucide/svelte/icons/chart-no-axes-combined';
  import { currentOrgPath } from '$lib/utils/store/org';
  import { t } from '$lib/utils/functions/translations';
  import { SidebarFooterMenu } from '$features/ui/sidebar/footer';

  const links = $derived([
    { key: 'enterprise.interface.workbench', href: '/admin', icon: LayoutDashboard },
    { key: 'enterprise.departments', href: '/admin?view=departments', icon: Building },
    { key: 'enterprise.employees', href: '/admin?view=employees', icon: Users },
    { key: 'org_navigation.courses', href: `${$currentOrgPath}/courses`, icon: BookOpen },
    { key: 'enterprise.plans.title', href: '/admin/plans', icon: Calendar },
    { key: 'enterprise.assessment.title', href: '/admin/assessment', icon: ClipboardCheck },
    { key: 'enterprise.assessment.matrix', href: '/admin/matrix', icon: Grid },
    { key: 'org_navigation.stats', href: '/admin/statistics', icon: Chart }
  ]);
  const currentView = $derived(page.url.searchParams.get('view'));
</script>

<Sidebar.Root collapsible="icon" class="enterprise-sidebar">
  <Sidebar.Header>
    <a href="/admin" class="enterprise-brand">
      <img src="/enterprise-training-icon.png" alt="" width="40" height="40" />
      <span>
        <strong>{$t('enterprise.interface.platform_name')}</strong>
        <small>{$t('enterprise.interface.admin_portal')}</small>
      </span>
    </a>
  </Sidebar.Header>
  <Sidebar.Content>
    <Sidebar.Group>
      <Sidebar.Menu>
        {#each links as link (link.href)}
          {@const active = link.href.includes('?')
            ? page.url.pathname === '/admin' && currentView === link.href.split('=')[1]
            : link.href === '/admin'
              ? page.url.pathname === '/admin' && !['departments', 'employees'].includes(currentView ?? '')
              : page.url.pathname.startsWith(link.href)}
          <Sidebar.MenuItem>
            <Sidebar.MenuButton isActive={active} tooltipContent={$t(link.key)}>
              {#snippet child({ props })}
                <a {...props} href={link.href} aria-current={active ? 'page' : undefined}>
                  <link.icon class="size-4" />
                  <span>{$t(link.key)}</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
        {/each}
      </Sidebar.Menu>
    </Sidebar.Group>
  </Sidebar.Content>
  <Sidebar.Footer>
    <SidebarFooterMenu />
  </Sidebar.Footer>
  <Sidebar.Rail aria-label={$t('common.toggle_sidebar')} title={$t('common.toggle_sidebar')} />
</Sidebar.Root>
