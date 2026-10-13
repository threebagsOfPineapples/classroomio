<script lang="ts">
  import * as Select from '@cio/ui/base/select';
  import * as Field from '@cio/ui/base/field';
  let {
    label,
    value = $bindable(''),
    options,
    disabled = false
  }: { label: string; value?: string; options: { value: string; label: string }[]; disabled?: boolean } = $props();
</script>

<Field.Field>
  <Field.Label>{label}</Field.Label>
  <Select.Root type="single" bind:value {disabled}>
    <Select.Trigger class="w-full" aria-label={label}
      >{options.find((option) => option.value === value)?.label ?? label}</Select.Trigger
    >
    <Select.Content
      >{#each options as option}<Select.Item value={option.value}>{option.label}</Select.Item>{/each}</Select.Content
    >
  </Select.Root>
</Field.Field>
