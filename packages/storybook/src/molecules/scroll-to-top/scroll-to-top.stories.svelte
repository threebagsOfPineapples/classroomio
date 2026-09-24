<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { ScrollToTop } from '@cio/ui/custom/scroll-to-top';
  import { FIELDS } from './fields';

  const { Story } = defineMeta({
    title: 'Molecules/ScrollToTop',
    component: ScrollToTop,
    parameters: { layout: 'fullscreen', controls: { include: FIELDS } },
    argTypes: { target: { control: false } },
    tags: ['autodocs']
  });
</script>

<script lang="ts">
  let overflowTarget = $state<HTMLElement | null>(null);
  let shortTarget = $state<HTMLElement | null>(null);
</script>

<Story name="Overflowing container" args={{ label: 'Back to top' }}>
  {#snippet template(args)}
    <div bind:this={overflowTarget} class="h-56 overflow-y-auto border p-4">
      <div class="h-[700px]">Scroll this container past one viewport.</div>
      <p>End of content</p>
    </div>
    <ScrollToTop {...args} target={overflowTarget} />
  {/snippet}
</Story>

<Story name="No overflow" args={{ label: 'Back to top' }}>
  {#snippet template(args)}
    <div bind:this={shortTarget} class="h-56 overflow-y-auto border p-4">Short content</div>
    <ScrollToTop {...args} target={shortTarget} />
  {/snippet}
</Story>

<Story name="Default placement" args={{ label: 'Back to top', forceVisible: true }}>
  {#snippet template(args)}
    <div class="h-56 p-4">Default bottom clearance</div>
    <ScrollToTop {...args} />
  {/snippet}
</Story>

<Story name="Mobile navigation clearance" args={{ label: 'Back to top', clearance: 'mobile-nav', forceVisible: true }}>
  {#snippet template(args)}
    <div class="h-56 p-4">Raised above mobile navigation</div>
    <ScrollToTop {...args} />
  {/snippet}
</Story>

<Story name="Ask AI clearance" args={{ label: 'Back to top', clearance: 'ask-ai', forceVisible: true }}>
  {#snippet template(args)}
    <div class="h-56 p-4">Raised above Ask AI</div>
    <ScrollToTop {...args} />
  {/snippet}
</Story>
