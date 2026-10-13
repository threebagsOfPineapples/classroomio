<script lang="ts">
  import * as Select from '@cio/ui/base/select';
  import * as Field from '@cio/ui/base/field';
  import type { MentorshipChoice } from '../utils/types';

  let {
    label,
    value = $bindable(''),
    options,
    placeholder,
    disabled = false
  }: { label: string; value?: string; options: MentorshipChoice[]; placeholder: string; disabled?: boolean } = $props();
  const controlId = $props.id();
</script>

<Field.Field>
  <Field.Label for={controlId}>{label}</Field.Label>
  <Select.Root type="single" bind:value {disabled}>
    <Select.Trigger id={controlId} class="w-full"
      >{options.find((option) => option.value === value)?.label ?? placeholder}</Select.Trigger
    >
    <Select.Content>
      <Select.Item value="">{placeholder}</Select.Item>
      {#each options as option (option.value)}
        <Select.Item value={option.value}>{option.label}</Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
</Field.Field>
