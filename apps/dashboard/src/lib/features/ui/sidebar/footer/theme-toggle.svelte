<script lang="ts">
  import { Button } from '@cio/ui/base/button';
  import { MonitorIcon, SunIcon, MoonIcon } from '@lucide/svelte';
  import { setMode, userPrefersMode } from '@cio/ui/base/dark-mode';
  import { t } from '$lib/utils/functions/translations';

  import { markColorModeExplicit, type ColorModePreference } from '$lib/utils/functions/color-mode';

  const themes: { mode: ColorModePreference; icon: typeof MonitorIcon }[] = [
    { mode: 'light', icon: SunIcon },
    { mode: 'dark', icon: MoonIcon },
    { mode: 'system', icon: MonitorIcon }
  ];

  const activeMode = $derived(userPrefersMode.current ?? 'light');

  const handleThemeChange = (newMode: ColorModePreference) => {
    markColorModeExplicit();
    setMode(newMode);
  };
</script>

<div class="flex items-center justify-between gap-8">
  <p>{$t('enterprise.interface.appearance')}</p>

  <div class="theme-toggle flex items-center gap-1 rounded-md">
    {#each themes as theme (theme.mode)}
      <Button
        size="icon-sm"
        variant="secondary"
        title={$t('enterprise.interface.' + theme.mode)}
        aria-label={$t('enterprise.interface.' + theme.mode)}
        aria-pressed={activeMode === theme.mode}
        onclick={() => handleThemeChange(theme.mode)}
      >
        <theme.icon class="size-4" />
      </Button>
    {/each}
  </div>
</div>
