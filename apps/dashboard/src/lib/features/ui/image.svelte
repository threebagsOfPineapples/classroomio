<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '$lib/utils/functions/translations';
  import { Skeleton } from '@cio/ui/base/skeleton';

  let {
    src,
    className,
    alt,
    fallback
  }: { src: string | undefined; className?: string; alt?: string; fallback?: Snippet } = $props();

  function loadImage(src: string | undefined): Promise<void> {
    if (!src) return Promise.reject();
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = src;
    });
  }
</script>

{#await loadImage(src)}
  <Skeleton class={className} />
{:then}
  <img {src} {alt} class={className} />
{:catch}
  {#if fallback}
    {@render fallback()}
  {:else}
    <div class="flex h-[200px] w-full items-center justify-center rounded bg-gray-100 dark:bg-neutral-800">
      <p class="text-sm text-red-600">{$t('interface_copy.failed_to_load')}</p>
    </div>
  {/if}
{/await}
