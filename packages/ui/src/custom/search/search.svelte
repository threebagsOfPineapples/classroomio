<script lang="ts">
  import * as InputGroup from '../../base/input-group';
  import SearchIcon from '@lucide/svelte/icons/search';
  import XIcon from '@lucide/svelte/icons/x';
  import type { ComponentProps } from 'svelte';
  import { cn } from '../../tools';

  interface Props {
    placeholder?: string;
    'aria-label'?: string;
    clearLabel?: string;
    value?: string;
    class?: string;
    onValueChange?: (value: string) => void;
  }

  let {
    placeholder = '',
    'aria-label': ariaLabel,
    clearLabel = 'Clear search',
    value = $bindable(''),
    class: className = '',
    onValueChange,
    ...restProps
  }: Props & Omit<ComponentProps<typeof InputGroup.Root>, 'class' | 'children'> = $props();

  const mergedProps = $derived({
    class: cn('ui:w-fit ui:max-w-[200px]', className),
    'data-slot': 'search',
    ...restProps
  });

  function handleInput(event: Event) {
    onValueChange?.((event.currentTarget as HTMLInputElement).value);
  }

  function clearValue() {
    value = '';
    onValueChange?.('');
  }
</script>

<InputGroup.Root {...mergedProps}>
  <InputGroup.Input {placeholder} aria-label={ariaLabel || placeholder || undefined} bind:value oninput={handleInput} />
  {#if value}
    <InputGroup.Addon align="inline-end">
      <InputGroup.Button variant="secondary" aria-label={clearLabel} title={clearLabel} onclick={clearValue}>
        <XIcon aria-hidden="true" />
      </InputGroup.Button>
    </InputGroup.Addon>
  {/if}
  <InputGroup.Addon>
    <SearchIcon aria-hidden="true" />
  </InputGroup.Addon>
</InputGroup.Root>
