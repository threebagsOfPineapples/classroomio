<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import RefreshCcwIcon from '@lucide/svelte/icons/refresh-ccw';

  import { IconButton } from '@cio/ui/custom/icon-button';
  import { t } from '$lib/utils/functions/translations';

  interface Props {
    disabled?: boolean;
    onRefresh?: () => Promise<unknown> | unknown;
  }

  let { disabled = false, onRefresh }: Props = $props();

  let isRefreshing = $state(false);

  async function handleRefresh() {
    if (disabled || isRefreshing) return;

    isRefreshing = true;

    try {
      if (onRefresh) {
        await onRefresh();
        return;
      }

      await invalidateAll();
    } finally {
      isRefreshing = false;
    }
  }
</script>

<IconButton
  variant="secondary"
  onclick={handleRefresh}
  disabled={disabled || isRefreshing}
  aria-label={t.get('common.refresh')}
  title={t.get('common.refresh')}
>
  <RefreshCcwIcon class={isRefreshing ? 'animate-spin' : ''} size={16} aria-hidden="true" />
</IconButton>
