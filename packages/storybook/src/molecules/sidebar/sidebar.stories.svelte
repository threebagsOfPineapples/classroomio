<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { FIELDS } from './fields';
  import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarTrigger
  } from '@cio/ui/base/sidebar';

  const { Story } = defineMeta({
    title: 'Molecules/Sidebar',
    component: Sidebar,
    parameters: {
      layout: 'fullscreen',
      controls: { include: FIELDS }
    },
    tags: ['autodocs']
  });
</script>

<Story name="Default">
  {#snippet template()}
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <h2 class="px-4 text-lg font-semibold">My App</h2>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <span>Projects</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <span>Settings</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <p class="ui:text-muted-foreground px-4 text-sm">© 2024 My App</p>
        </SidebarFooter>
      </Sidebar>
      <main class="flex-1 p-4">
        <SidebarTrigger />
        <div class="mt-4">
          <h1 class="text-2xl font-bold">Main Content</h1>
          <p class="mt-2">This is the main content area.</p>
        </div>
      </main>
    </SidebarProvider>
  {/snippet}
</Story>

<Story
  name="Localized mobile navigation"
  args={{ mobileTitle: '菜单', mobileDescription: '展开或收起侧栏', closeLabel: '关闭菜单' }}
  parameters={{ viewport: { defaultViewport: 'mobile1' } }}
>
  {#snippet template(args)}
    <SidebarProvider>
      <Sidebar {...args}>
        <SidebarHeader><h2 class="px-4 text-lg font-semibold">至臻培训</h2></SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>学习导航</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem><SidebarMenuButton>我的学习</SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton>内部课程库</SidebarMenuButton></SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <main class="flex-1 p-4">
        <SidebarTrigger aria-label="展开或收起侧栏" />
        <h1 class="mt-4 text-2xl font-semibold">移动端菜单</h1>
      </main>
    </SidebarProvider>
  {/snippet}
</Story>
