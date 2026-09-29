<script lang="ts">
  import { Label } from '@cio/ui/base/label';
  import * as Select from '@cio/ui/base/select';

  import type { TLocale } from '@cio/db/types';
  import { LANGUAGES } from '$lib/utils/constants/translation';
  import { t, initialized } from '$lib/utils/functions/translations';

  interface Props {
    className?: string;
    value?: TLocale;
    hasLangChanged?: boolean;
    change?: () => void;
  }

  let { className = '', value = $bindable('zh'), hasLangChanged = $bindable(false), change }: Props = $props();

  function handleSelect(selectedValue: string) {
    value = selectedValue as TLocale;
    hasLangChanged = true;
    change?.();
  }
</script>

{#if $initialized}
  <div class={className}>
    <Label class="mb-2 block">{$t('content.toggle_label')}</Label>
    <Select.Root type="single" value="zh" disabled>
      <Select.Trigger class="w-full">
        <p>{value ? LANGUAGES.find((lang) => lang.id === 'zh')?.text : $t('settings.account.select_language')}</p>
      </Select.Trigger>
      <Select.Content>
        {#each LANGUAGES.filter((language) => language.id === 'zh') as language}
          <Select.Item value={language.id}>{language.text}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
  </div>
{/if}
