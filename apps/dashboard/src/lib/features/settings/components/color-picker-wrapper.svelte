<script lang="ts">
  import { t } from '$lib/utils/functions/translations';

  export let wrapper: HTMLDivElement | undefined = undefined;
  export let isOpen: boolean;
  export let isDialog: boolean;
</script>

<div
  bind:this={wrapper}
  class:is-open={isOpen}
  role={isDialog ? 'dialog' : undefined}
  aria-label={$t('settings.organization.organization_profile.theme.color_picker.title')}
>
  <slot />
</div>

<style>
  div {
    display: none;
    width: max-content;
    margin: 0 10px 10px;
    padding: 8px;
    border: 1px solid var(--cp-border-color, black);
    border-radius: 12px;
    background-color: var(--cp-bg-color, white);
  }

  .is-open {
    display: inline-block;
  }

  [role='dialog'] {
    position: absolute;
    top: calc(var(--input-size, 25px) + 12px);
    left: 0;
    z-index: var(--picker-z-index, 2);
  }
</style>
