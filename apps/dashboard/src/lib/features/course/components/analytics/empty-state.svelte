<script lang="ts">
  import { t } from '$lib/utils/functions/translations';
  import type { Component } from 'svelte';
  import ChartBarIcon from '@lucide/svelte/icons/chart-bar';

  interface Props {
    title?: string;
    description?: string;
    icon?: Component;
    className?: string;
  }

  let {
    title = $t('analytics.no_data_default'),
    description = $t('analytics.no_data_default_description'),
    icon = ChartBarIcon,
    className = ''
  }: Props = $props();

  const SvelteComponent = $derived(icon);
</script>

<div class="flex flex-col items-center justify-center px-4 py-12 {className}">
  <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-neutral-800">
    <SvelteComponent size="24" class="text-gray-400 dark:text-gray-500" />
  </div>
  <h3 class="mb-2 text-lg font-medium text-gray-900 dark:text-white">
    {title}
  </h3>
  <p class="max-w-sm text-center text-sm text-gray-500 dark:text-gray-400">
    {description}
  </p>
</div>
