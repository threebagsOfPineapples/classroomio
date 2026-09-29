<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { t } from '$lib/utils/functions/translations';
  import { AssessmentApi } from '../api/assessment.svelte';
  import type { AssessmentExercises, EnterpriseEmployees, TrainingArchive } from '../utils/types';
  import { Button } from '@cio/ui/base/button';
  import { InputField } from '@cio/ui/custom/input-field';
  import { CheckboxField } from '@cio/ui/custom/checkbox-field';
  import * as Select from '@cio/ui/base/select';
  import * as Dialog from '@cio/ui/base/dialog';

  let {
    organizationId,
    planId,
    exams,
    employees,
    directory
  }: {
    organizationId: string;
    planId: string;
    exams: AssessmentExercises;
    employees: TrainingArchive;
    directory: EnterpriseEmployees;
  } = $props();
  const api = new AssessmentApi();
  const selected = new SvelteSet<number>();
  let open = $state(false);
  let exerciseId = $state('');
  let opensAt = $state('');
  let closesAt = $state('');
  let notice = $state('');
  let search = $state('');
  const candidates = $derived(
    employees
      .filter((employee) => ['NOT_STARTED', 'IN_PROGRESS', 'FAILED'].includes(employee.status))
      .map((employee) => {
        const person = directory.find((entry) => entry.member.id === employee.memberId);
        const label =
          [person?.fullname, person?.member.employeeNo, employee.memberEmail].filter(Boolean).join(' · ') ||
          String(employee.memberId);
        return { ...employee, label };
      })
  );

  const visibleCandidates = $derived(
    candidates.filter((employee) => employee.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  );
  const selectionWouldOverflow = $derived(
    new Set([...selected, ...visibleCandidates.map((employee) => employee.memberId)]).size > 100
  );

  function selectVisible() {
    if (selectionWouldOverflow || api.busy) return;

    for (const employee of visibleCandidates) selected.add(employee.memberId);
  }

  async function save() {
    if (api.busy) return;

    const start = new Date(opensAt);
    const end = new Date(closesAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      api.error = $t('enterprise.makeup.help');
      return;
    }

    const result = await api.grantMakeup(organizationId, planId, {
      exerciseId,
      memberIds: [...selected],
      opensAt: start.toISOString(),
      closesAt: end.toISOString()
    });
    if (result) {
      notice = $t('enterprise.makeup.result', { count: result.count, skipped: result.skipped });
      open = false;
      selected.clear();
    }
  }
</script>

<Button
  variant="secondary"
  disabled={!exams.some((exam) => exam.isExam)}
  onclick={() => {
    api.error = '';
    open = true;
  }}>{$t('enterprise.makeup.action')}</Button
>
{#if notice}<p role="status">{notice}</p>{/if}
<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{$t('enterprise.makeup.action')}</Dialog.Title>
      <Dialog.Description>{$t('enterprise.makeup.help')}</Dialog.Description>
    </Dialog.Header>
    <Select.Root type="single" bind:value={exerciseId}>
      <Select.Trigger aria-label={$t('enterprise.assessment.type_exam')}
        >{exams.find((exam) => exam.id === exerciseId)?.title ?? $t('enterprise.assessment.type_exam')}</Select.Trigger
      >
      <Select.Content
        >{#each exams.filter((exam) => exam.isExam) as exam (exam.id)}<Select.Item value={exam.id}
            >{exam.title}</Select.Item
          >{/each}</Select.Content
      >
    </Select.Root>
    <InputField type="datetime-local" label={$t('enterprise.plans.start_date')} bind:value={opensAt} />
    <InputField type="datetime-local" label={$t('enterprise.plans.end_date')} bind:value={closesAt} />
    <InputField label={$t('enterprise.search')} bind:value={search} />
    <div class="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        disabled={api.busy || selectionWouldOverflow || !visibleCandidates.length}
        onclick={selectVisible}>{$t('audience.select_all')}</Button
      >
      <Button size="sm" variant="outline" disabled={api.busy || !selected.size} onclick={() => selected.clear()}
        >{$t('audience.bulk.clear_selection')}</Button
      >
      <span role="status">{$t('audience.selected_count', { count: selected.size })} / 100</span>
    </div>
    <div class="max-h-56 space-y-2 overflow-auto">
      {#each visibleCandidates as employee (employee.memberId)}
        <CheckboxField
          label={employee.label}
          disabled={api.busy || (!selected.has(employee.memberId) && selected.size >= 100)}
          checked={selected.has(employee.memberId)}
          onclick={() =>
            selected.has(employee.memberId) ? selected.delete(employee.memberId) : selected.add(employee.memberId)}
        />
      {:else}<p class="ui:text-muted-foreground text-sm">{$t('enterprise.my_training.pending')}</p>{/each}
    </div>
    {#if api.error}<p role="alert" class="text-red-700">{api.error}</p>{/if}
    <Dialog.Footer>
      <Button size="sm" variant="outline" disabled={api.busy} onclick={() => (open = false)}>{$t('app.cancel')}</Button>
      <Button
        size="sm"
        disabled={api.busy || !exerciseId || !selected.size || selected.size > 100 || !opensAt || !closesAt}
        onclick={save}>{$t('app.save')}</Button
      >
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
