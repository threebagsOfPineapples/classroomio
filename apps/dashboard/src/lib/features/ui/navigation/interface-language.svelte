<script lang="ts">
  import * as Select from '@cio/ui/base/select';
  import LanguagesIcon from '@lucide/svelte/icons/languages';
  import { locale, handleLocaleChange, t, config } from '$lib/utils/functions/translations';
  import { LANGUAGES } from '$lib/utils/constants/translation';
  import type { TLocale } from '@cio/db/types';

  const languages = LANGUAGES.filter((language) => config.loaders.some((loader) => loader.locale === language.id));
</script>

<Select.Root type="single" value={$locale} onValueChange={(value) => handleLocaleChange(value as TLocale)}>
  <Select.Trigger
    class="h-8 w-auto shrink-0 gap-1"
    aria-label={$t('settings.account.language')}
    data-interface-language
  >
    <LanguagesIcon class="size-4" />
    <span class="hidden sm:inline">{languages.find((language) => language.id === $locale)?.text}</span>
  </Select.Trigger>
  <Select.Content align="end">
    {#each languages as language (language.id)}
      <Select.Item value={language.id}>{language.text}</Select.Item>
    {/each}
  </Select.Content>
</Select.Root>
