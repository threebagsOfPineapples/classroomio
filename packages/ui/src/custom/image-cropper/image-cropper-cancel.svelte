<script lang="ts">
  import Button from '../../base/button/button.svelte';
  import type { ImageCropperActionProps } from './types';
  import { useImageCropperCancel } from './image-cropper-context.svelte';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';

  let {
    ref = $bindable(null),
    variant = 'outline',
    size = 'sm',
    label = 'Cancel',
    onclick,
    ...rest
  }: ImageCropperActionProps = $props();

  const cancelState = useImageCropperCancel();
</script>

<Button
  {...rest}
  bind:ref
  {size}
  {variant}
  onclick={(
    e: MouseEvent & {
      currentTarget: EventTarget & HTMLButtonElement;
    }
  ) => {
    onclick?.(e);

    cancelState.onclick();
  }}
>
  <Trash2Icon />
  <span>{label}</span>
</Button>
