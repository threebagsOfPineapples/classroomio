<script lang="ts">
  import { untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
  import { Button } from '../../base/button';
  import { isScrollToTopVisible } from './scroll-to-top';

  interface Props {
    label: string;
    target?: HTMLElement | null;
    clearance?: 'default' | 'mobile-nav' | 'ask-ai';
    class?: string;
    forceVisible?: boolean;
  }

  let { label, target = null, clearance = 'default', class: className = '', forceVisible = false }: Props = $props();
  let visible = $state(false);
  let reducedMotion = $state(false);

  const bottom = $derived(
    clearance === 'mobile-nav'
      ? 'max(6rem, env(safe-area-inset-bottom) + 6rem)'
      : clearance === 'ask-ai'
        ? 'max(5rem, env(safe-area-inset-bottom) + 5rem)'
        : 'max(1.5rem, env(safe-area-inset-bottom) + 1rem)'
  );

  function updateVisibility() {
    const container = target ?? document.documentElement;
    const scrollTop = target ? target.scrollTop : window.scrollY;
    const clientHeight = target ? target.clientHeight : window.innerHeight;
    visible = isScrollToTopVisible(scrollTop, clientHeight, container.scrollHeight, visible);
  }

  function scrollToTop() {
    const scrollTarget = target ?? window;
    scrollTarget.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' });
  }

  $effect(() => {
    const scrollTarget = target ?? window;
    const resizeTarget = target ?? document.documentElement;
    const observer = new ResizeObserver(updateVisibility);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => (reducedMotion = media.matches);
    updateMotion();
    untrack(updateVisibility);
    scrollTarget.addEventListener('scroll', updateVisibility, { passive: true });
    window.addEventListener('resize', updateVisibility);
    media.addEventListener('change', updateMotion);
    observer.observe(resizeTarget);

    return () => {
      scrollTarget.removeEventListener('scroll', updateVisibility);
      window.removeEventListener('resize', updateVisibility);
      media.removeEventListener('change', updateMotion);
      observer.disconnect();
    };
  });
</script>

{#if visible || forceVisible}
  <div
    class={`ui:fixed ui:right-6 ui:z-30 ${className}`}
    style:bottom
    transition:fly={{ y: reducedMotion ? 0 : 8, duration: reducedMotion ? 0 : 150 }}
  >
    <Button
      variant="secondary"
      size="icon"
      class="ui:rounded-full ui:shadow-md"
      aria-label={label}
      title={label}
      onclick={scrollToTop}
    >
      <ArrowUpIcon aria-hidden="true" class="ui:size-4" />
    </Button>
  </div>
{/if}
