<script lang="ts">
  import * as Avatar from '@cio/ui/base/avatar';
  import * as Sidebar from '@cio/ui/base/sidebar';
  import { t } from '$lib/utils/functions/translations';
  import { resolve } from '$app/paths';
</script>

<Sidebar.Menu>
  <Sidebar.MenuItem>
    <Sidebar.MenuButton
      size="sm"
      class="ui:data-[state=open]:bg-sidebar-accent ui:data-[state=open]:text-sidebar-accent-foreground"
    >
      {#snippet child({ props })}
        <a href={resolve('/admin', {})} {...props}>
          <Avatar.Root class="flex size-6 items-center justify-center">
            <Avatar.Image src="/enterprise-training-icon.png" alt="" />
          </Avatar.Root>

          <span class="truncate font-normal">{$t('enterprise.title')}</span>
        </a>
      {/snippet}
    </Sidebar.MenuButton>
  </Sidebar.MenuItem>
</Sidebar.Menu>
