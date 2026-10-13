<script lang="ts">
  import { untrack } from 'svelte';
  import { currentOrg } from '$lib/utils/store/org';
  import { t } from '$lib/utils/functions/translations';
  import { DingtalkDirectoryApi } from '$features/enterprise/api/dingtalk-directory.svelte';
  import * as Page from '@cio/ui/base/page';
  import * as Table from '@cio/ui/base/table';
  import * as Select from '@cio/ui/base/select';
  import * as Dialog from '@cio/ui/base/dialog';
  import { Button } from '@cio/ui/base/button';
  import { InputField } from '@cio/ui/custom/input-field';
  import { CheckboxField } from '@cio/ui/custom/checkbox-field';
  import { ScrollToTop } from '@cio/ui/custom/scroll-to-top';

  const api = new DingtalkDirectoryApi();
  let confirmOpen = $state(false);
  $effect(() => {
    const organizationId = $currentOrg?.id;
    if (organizationId) untrack(() => void api.load(organizationId));
  });
</script>

<Page.Root>
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>{$t('enterprise.dingtalk.directory.title')}</Page.Title>
      <Page.Subtitle>{$t('enterprise.dingtalk.directory.description')}</Page.Subtitle>
    </Page.HeaderContent>
    <Page.Action>
      <Button
        size="sm"
        variant="outline"
        disabled={api.busy || !api.status?.enabled || !api.status?.canSync}
        onclick={() => void api.readPreview()}
      >
        {api.busy ? $t('enterprise.loading') : $t('enterprise.dingtalk.directory.preview')}
      </Button>
      {#if api.preview}<Button size="sm" disabled={api.busy} onclick={() => (confirmOpen = true)}
          >{$t('enterprise.dingtalk.directory.sync')}</Button
        >{/if}
    </Page.Action>
  </Page.Header>
  <Page.Body>
    {#snippet child()}
      {#if api.errorKey}<p role="alert" class="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {$t(api.errorKey)}
        </p>{/if}
      {#if api.status}
        <section class="training-panel space-y-3">
          <h2 class="font-semibold">{$t('enterprise.dingtalk.directory.connection')}</h2>
          <p class="text-sm">
            {$t(
              api.status.enabled
                ? 'enterprise.dingtalk.directory.enabled'
                : 'enterprise.dingtalk.directory.errors.disabled'
            )}
          </p>
          <p class="ui:text-muted-foreground text-sm">
            {$t('enterprise.dingtalk.directory.headquarters_scope', {
              headquarters: api.status.scope.headquartersDepartmentId,
              excluded: api.status.scope.excludedDepartmentIds.join('、')
            })}
          </p>
          {#if api.status.callbackUrl}<p class="ui:text-muted-foreground text-sm break-all">
              {$t('enterprise.dingtalk.directory.callback')}：{api.status.callbackUrl}
            </p>{/if}
          {#if !api.status.canSync}<p class="text-sm">{$t('enterprise.dingtalk.directory.admin_only')}</p>{/if}
          <Button variant="outline" size="sm" href="/lms/settings/integrations">{$t('enterprise.dingtalk.link')}</Button
          >
        </section>
      {/if}
      {#if api.result}
        <p role="status" class="rounded-lg bg-green-50 p-4 text-sm text-green-800">
          {$t('enterprise.dingtalk.directory.completed', api.result)}
        </p>
      {/if}
      {#if api.preview}
        <section class="training-panel space-y-5">
          <div class="grid gap-4 sm:grid-cols-3">
            <div>
              <p class="ui:text-muted-foreground text-sm">{$t('enterprise.departments')}</p>
              <strong class="text-2xl">{api.preview.scope.eligibleDepartmentCount}</strong>
            </div>
            <div>
              <p class="ui:text-muted-foreground text-sm">{$t('enterprise.employees')}</p>
              <strong class="text-2xl">{api.preview.employees.length}</strong>
            </div>
            <div>
              <p class="ui:text-muted-foreground text-sm">{$t('enterprise.dingtalk.directory.selected')}</p>
              <strong class="text-2xl">{api.selectedCount}</strong>
            </div>
          </div>
          <p class="ui:text-muted-foreground text-sm">{$t('enterprise.dingtalk.directory.rules')}</p>
          <div role="status" class="ui:bg-muted space-y-2 rounded-lg p-4 text-sm">
            <p>
              {$t('enterprise.dingtalk.directory.excluded_staff', { count: api.preview.scope.excludedEmployeeCount })}
            </p>
            <p>
              {$t('enterprise.dingtalk.directory.multi_department_staff', {
                count: api.preview.scope.multiDepartmentEmployeeCount
              })}
            </p>
            <p class="ui:text-muted-foreground">{$t('enterprise.dingtalk.directory.department_associations')}</p>
          </div>
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div class="w-full max-w-sm">
              <InputField label={$t('enterprise.dingtalk.directory.search')} bind:value={api.search} />
            </div>
            <Button size="sm" variant="outline" disabled={api.busy} onclick={() => api.selectReady()}
              >{$t('enterprise.dingtalk.directory.select_ready')}</Button
            >
          </div>
          <div class="ui:border-border overflow-x-auto rounded-lg border">
            <Table.Root>
              <Table.Header
                ><Table.Row>
                  <Table.Head>{$t('enterprise.dingtalk.directory.choose')}</Table.Head><Table.Head
                    >{$t('enterprise.name')}</Table.Head
                  ><Table.Head>{$t('enterprise.employee_no')}</Table.Head><Table.Head
                    >{$t('enterprise.department')}</Table.Head
                  ><Table.Head>{$t('enterprise.dingtalk.directory.action')}</Table.Head><Table.Head
                    >{$t('enterprise.dingtalk.directory.check')}</Table.Head
                  >
                </Table.Row></Table.Header
              >
              <Table.Body>
                {#each api.visibleEmployees as employee (employee.userId)}
                  <Table.Row>
                    <Table.Cell
                      ><CheckboxField
                        label={$t('enterprise.dingtalk.directory.choose_employee', { name: employee.name })}
                        className="text-xs"
                        checked={api.selected[employee.userId] ?? false}
                        disabled={api.busy || !api.canSelect(employee)}
                        onclick={() => (api.selected[employee.userId] = !api.selected[employee.userId])}
                      /></Table.Cell
                    >
                    <Table.Cell>{employee.name}</Table.Cell><Table.Cell>{employee.employeeNo ?? '—'}</Table.Cell>
                    <Table.Cell>
                      {#if employee.status === 'ready' && (employee.hasMultipleDepartments || employee.departmentIds.length > 1)}
                        <Select.Root
                          type="single"
                          value={api.departments[employee.userId] || 'none'}
                          onValueChange={(value) => api.setDepartment(employee.userId, value === 'none' ? '' : value)}
                          disabled={api.busy}
                        >
                          <Select.Trigger
                            aria-label={$t('enterprise.dingtalk.directory.primary_department_optional', {
                              name: employee.name
                            })}
                            >{api.departments[employee.userId]
                              ? api.departmentLabel(Number(api.departments[employee.userId]))
                              : $t('enterprise.dingtalk.directory.without_primary_department')}</Select.Trigger
                          >
                          <Select.Content
                            ><Select.Item value="none"
                              >{$t('enterprise.dingtalk.directory.without_primary_department')}</Select.Item
                            >{#each employee.departmentIds as id}<Select.Item value={String(id)}
                                >{api.departmentLabel(id)}</Select.Item
                              >{/each}</Select.Content
                          >
                        </Select.Root>
                        <p class="ui:text-muted-foreground mt-2 text-xs">
                          {employee.departmentIds.map((id) => api.departmentLabel(id)).join('、')}
                        </p>
                      {:else}{employee.departmentIds.map((id) => api.departmentLabel(id)).join('、')}{/if}
                    </Table.Cell>
                    <Table.Cell>{$t(`enterprise.dingtalk.directory.actions.${employee.action}`)}</Table.Cell>
                    <Table.Cell class={employee.status === 'ready' ? 'ui:text-muted-foreground' : 'text-red-700'}
                      >{$t(`enterprise.dingtalk.directory.status.${employee.status}`)}</Table.Cell
                    >
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </div>
          <div class="flex items-center justify-between gap-3">
            <p class="ui:text-muted-foreground text-sm">
              {$t('enterprise.dingtalk.directory.page', {
                page: api.currentPage + 1,
                pages: Math.max(1, Math.ceil(api.filteredEmployees.length / 50))
              })}
            </p>
            <div class="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={api.currentPage === 0 || api.busy}
                onclick={() => (api.pageIndex = api.currentPage - 1)}
                >{$t('enterprise.dingtalk.directory.previous')}</Button
              ><Button
                size="sm"
                variant="outline"
                disabled={(api.currentPage + 1) * 50 >= api.filteredEmployees.length || api.busy}
                onclick={() => (api.pageIndex = api.currentPage + 1)}>{$t('enterprise.dingtalk.directory.next')}</Button
              >
            </div>
          </div>
        </section>
      {/if}
    {/snippet}
  </Page.Body>
</Page.Root>
<ScrollToTop label={$t('common.scroll_to_top')} />

<Dialog.Root bind:open={confirmOpen}>
  <Dialog.Content>
    <Dialog.Header
      ><Dialog.Title>{$t('enterprise.dingtalk.directory.sync')}</Dialog.Title><Dialog.Description
        >{$t('enterprise.dingtalk.directory.confirm', {
          departments: api.preview?.departments.length ?? 0,
          employees: api.selectedCount
        })}</Dialog.Description
      ></Dialog.Header
    >
    <Dialog.Footer
      ><Button size="sm" variant="outline" disabled={api.busy} onclick={() => (confirmOpen = false)}
        >{$t('enterprise.dingtalk.directory.cancel')}</Button
      ><Button
        size="sm"
        disabled={api.busy}
        onclick={async () => {
          if (await api.sync()) confirmOpen = false;
        }}>{api.busy ? $t('enterprise.loading') : $t('enterprise.dingtalk.directory.sync')}</Button
      ></Dialog.Footer
    >
  </Dialog.Content>
</Dialog.Root>
