<script lang="ts">
  import { getEditorTranslation } from '../../translation';
  const translate = getEditorTranslation();
  import MediaPlaceHolder from '../../components/MediaPlaceHolder.svelte';
  import type { NodeViewProps } from '@tiptap/core';

  const { editor }: NodeViewProps = $props();
  import Video from '@lucide/svelte/icons/video';
  import { buttonVariants } from '$src/base/button';

  function handleClick() {
    const videoUrl = prompt(translate('Please enter the video URL'));
    if (videoUrl) {
      editor.chain().focus().setVideo(videoUrl).run();
    }
  }
</script>

<MediaPlaceHolder
  class={buttonVariants({ variant: 'secondary', class: 'my-2 w-full justify-start p-6' })}
  icon={Video}
  title={translate('Insert a video')}
  onClick={handleClick}
/>
