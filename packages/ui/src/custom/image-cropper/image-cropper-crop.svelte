<script lang="ts">
  import Button from '../../base/button/button.svelte';
  import type { ImageCropperActionProps } from './types';
  import { useImageCropperCrop } from './image-cropper-context.svelte';
  import CropIcon from '@lucide/svelte/icons/crop';

  let {
    ref = $bindable(null),
    variant = 'default',
    size = 'sm',
    label = 'Crop',
    onclick,
    ...rest
  }: ImageCropperActionProps = $props();

  const cropState = useImageCropperCrop();
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

    cropState.onclick();
  }}
>
  <CropIcon />
  <span>{label}</span>
</Button>
