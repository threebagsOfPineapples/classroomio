<script lang="ts">
  import { t } from '$lib/utils/functions/translations';
  import { Separator } from '@cio/ui/base/separator';
  import * as Sidebar from '@cio/ui/base/sidebar';
  import { cohortApi } from '../api';
</script>

<header
  class="ui:border-border ui:bg-background ui:z-app-bar sticky top-0 flex h-14 w-full shrink-0 items-center gap-2 border-b"
>
  <div class="flex w-full items-center gap-2 px-4">
    <Sidebar.Trigger aria-label={$t('common.toggle_sidebar')} title={$t('common.toggle_sidebar')} variant="secondary" />

    <div class="h-4 w-2">
      <Separator orientation="vertical" />
    </div>

    <div class="flex min-w-0 items-center gap-2">
      <p class="max-w-2xs truncate text-sm font-medium">
        {cohortApi.cohort?.name || ''}
      </p>
    </div>

    <span class="grow"></span>
  </div>
</header>
