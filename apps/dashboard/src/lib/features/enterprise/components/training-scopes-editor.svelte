<script lang="ts">
  import { untrack } from 'svelte';
  import { Button } from '@cio/ui/base/button';
  import * as Dialog from '@cio/ui/base/dialog';
  import * as Field from '@cio/ui/base/field';
  import { InputField } from '@cio/ui/custom/input-field';
  import { CheckboxField } from '@cio/ui/custom/checkbox-field';
  import { UnsavedChanges } from '$features/ui';
  import { t } from '$lib/utils/functions/translations';
  import { TrainingScopesApi } from '../api/training-scopes.svelte';
  import { departmentPath, scopeEmployeeLabel } from '../utils/training-scopes';
  import type { EnterpriseEmployee } from '../utils/types';

  let {
    organizationId,
    employee,
    onClose
  }: {
    organizationId: string;
    employee: EnterpriseEmployee;
    onClose: () => void;
  } = $props();
  const api = new TrainingScopesApi();

  $effect(() => {
    const currentOrganizationId = organizationId;
    const memberId = employee.member.id;
    untrack(() => void api.load(currentOrganizationId, memberId));
    return () => api.reset();
  });

  function close() {
    if (api.busy || (api.hasChanges && !window.confirm($t('common.unsaved_changes.message')))) return;

    onClose();
  }

  function reload() {
    if (api.busy || (api.hasChanges && !window.confirm($t('common.unsaved_changes.message')))) return;

    void api.load(organizationId, employee.member.id);
  }
</script>

<UnsavedChanges hasUnsavedChanges={api.hasChanges} />

<Dialog.Root
  open={true}
  onOpenChange={(open) => {
    if (!open) close();
  }}
>
  <Dialog.Content class="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-3xl! overflow-y-auto" showCloseButton={false}>
    <Dialog.Header>
      <Dialog.Title>{$t('enterprise.training_scopes.title')}</Dialog.Title>
      <Dialog.Description>
        {employee.fullname ?? employee.email ?? employee.member.email}
        <span class="mt-2 block">{$t('enterprise.training_scopes.description')}</span>
      </Dialog.Description>
    </Dialog.Header>
    {#if api.loading}
      <p role="status" class="ui:text-muted-foreground py-6">{$t('enterprise.loading')}</p>
    {:else if api.loaded}
      <p class="ui:bg-muted rounded-md p-3 text-sm" data-testid="training-scope-summary">
        {$t('enterprise.training_scopes.selection_count', {
          departments: api.departmentIds.length,
          employees: api.memberIds.length
        })}
      </p>
      {#if !api.departmentIds.length && !api.memberIds.length}
        <p class="ui:text-muted-foreground text-sm">{$t('enterprise.training_scopes.empty_scope')}</p>
      {/if}
      <Field.Group>
        <Field.Set>
          <Field.Legend>{$t('enterprise.training_scopes.departments')}</Field.Legend>
          <Field.Description>{$t('enterprise.training_scopes.department_help')}</Field.Description>
          <Field.Group>
            <InputField
              name="training-scope-department-search"
              label={$t('enterprise.training_scopes.search_departments')}
              bind:value={api.departmentSearch}
              isDisabled={api.busy}
            />
            <div class="max-h-56 overflow-auto rounded-lg border p-2" aria-busy={api.busy}>
              {#each api.filteredDepartments as department (department.id)}
                <CheckboxField
                  name={`training-scope-department-${department.id}`}
                  label={departmentPath(department, api.departments)}
                  checked={api.departmentIds.includes(department.id)}
                  disabled={api.busy || (department.status !== 'ACTIVE' && !api.departmentIds.includes(department.id))}
                  className="min-h-11 focus-visible:ring-2 ui:focus-visible:ring-ring"
                  testId={`training-scope-department-${department.id}`}
                  onclick={() => api.toggleDepartment(department.id)}
                >
                  {#if department.status !== 'ACTIVE'}<span class="ui:text-muted-foreground ml-auto pl-2 text-xs"
                      >{$t('enterprise.inactive')}</span
                    >{/if}
                </CheckboxField>
              {:else}
                <p class="ui:text-muted-foreground p-3 text-sm">{$t('enterprise.admin_workflow.no_matches')}</p>
              {/each}
            </div>
          </Field.Group>
        </Field.Set>
        <Field.Separator />
        <Field.Set>
          <Field.Legend>{$t('enterprise.training_scopes.employees')}</Field.Legend>
          <Field.Description>{$t('enterprise.training_scopes.employee_help')}</Field.Description>
          <Field.Group>
            <InputField
              name="training-scope-employee-search"
              label={$t('enterprise.admin_workflow.search_employees')}
              bind:value={api.employeeSearch}
              isDisabled={api.busy}
            />
            <div class="max-h-56 overflow-auto rounded-lg border p-2" aria-busy={api.busy}>
              {#each api.filteredEmployees as target (target.member.id)}
                <CheckboxField
                  name={`training-scope-member-${target.member.id}`}
                  label={scopeEmployeeLabel(target, api.departments)}
                  checked={api.memberIds.includes(target.member.id)}
                  disabled={api.busy ||
                    ((target.member.status !== 'ACTIVE' || target.member.employmentStatus === 'TERMINATED') &&
                      !api.memberIds.includes(target.member.id))}
                  className="min-h-11 focus-visible:ring-2 ui:focus-visible:ring-ring"
                  testId={`training-scope-member-${target.member.id}`}
                  onclick={() => api.toggleMember(target.member.id)}
                />
              {:else}
                <p class="ui:text-muted-foreground p-3 text-sm">{$t('enterprise.admin_workflow.no_matches')}</p>
              {/each}
            </div>
          </Field.Group>
        </Field.Set>
        {#if api.missingDepartmentIds.length || api.missingMemberIds.length}
          <Field.Separator />
          <Field.Set>
            <Field.Legend>{$t('enterprise.training_scopes.unavailable')}</Field.Legend>
            <Field.Description>{$t('enterprise.training_scopes.unavailable_help')}</Field.Description>
            {#each api.missingDepartmentIds as departmentId (departmentId)}
              <CheckboxField
                name={`training-scope-missing-department-${departmentId}`}
                label={`${$t('enterprise.department')} · ${departmentId}`}
                checked={true}
                disabled={api.busy}
                onclick={() => api.toggleDepartment(departmentId)}
              />
            {/each}
            {#each api.missingMemberIds as memberId (memberId)}
              <CheckboxField
                name={`training-scope-missing-member-${memberId}`}
                label={`${$t('enterprise.employees')} · ${memberId}`}
                checked={true}
                disabled={api.busy}
                onclick={() => api.toggleMember(memberId)}
              />
            {/each}
          </Field.Set>
        {/if}
      </Field.Group>
    {/if}
    {#if api.error}<p role="alert" class="text-red-700">{api.error}</p>{/if}
    {#if api.notice}<p role="status" class="text-green-700">{api.notice}</p>{/if}
    <Dialog.Footer>
      <Button size="sm" variant="secondary" disabled={api.busy || api.loading} onclick={reload}
        >{$t('enterprise.training_scopes.reload')}</Button
      >
      <Button size="sm" variant="outline" disabled={api.busy} onclick={close}>{$t('app.cancel')}</Button>
      <Button
        size="sm"
        disabled={api.busy || api.loading || !api.loaded || !api.hasChanges}
        onclick={() => void api.save()}
        testId="training-scope-save"
      >
        {api.busy ? $t('enterprise.training_scopes.saving') : $t('common.save_changes')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
