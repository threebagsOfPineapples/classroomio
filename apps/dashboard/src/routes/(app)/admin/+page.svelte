<script lang="ts">
  import Workbench from '$features/enterprise/components/workbench.svelte';
  import { untrack } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { currentOrg, currentOrgPath, isOrgAdmin } from '$lib/utils/store/org';
  import { t } from '$lib/utils/functions/translations';
  import { enterpriseApi } from '$lib/features/enterprise/api/enterprise.svelte';
  import { employeeLabel, matchesEmployee } from '$lib/features/enterprise/utils/admin-workflow';
  import { UnsavedChanges } from '$features/ui';
  import type { EnterpriseDepartment, EnterpriseEmployee, EnterpriseRole } from '$lib/features/enterprise/utils/types';
  import { Button } from '@cio/ui/base/button';
  import { InputField } from '@cio/ui/custom/input-field';
  import { CheckboxField } from '@cio/ui/custom/checkbox-field';
  import * as Select from '@cio/ui/base/select';
  import * as Field from '@cio/ui/base/field';
  import * as Page from '@cio/ui/base/page';
  import * as Dialog from '@cio/ui/base/dialog';

  let search = $state('');
  let showDepartmentForm = $state(false);
  const requestedView = $derived(page.url.searchParams.get('view'));
  const activeView = $derived(
    requestedView === 'departments' || requestedView === 'employees' ? requestedView : 'workbench'
  );
  const headingKey = $derived(
    activeView === 'departments'
      ? 'enterprise.departments'
      : activeView === 'employees'
        ? 'enterprise.employees'
        : 'enterprise.interface.workbench'
  );
  let editingDepartmentId = $state<string | null>(null);
  let departmentForm = $state({ name: '', code: '', parentId: '', leaderMemberId: '', sort: 0, status: 'ACTIVE' });
  let employeeForm = $state({
    employeeNo: '',
    departmentId: '',
    position: '',
    managerMemberId: '',
    employmentStatus: '',
    joinDate: ''
  });
  let selectedRoles = $state<EnterpriseRole[]>([]);
  let savedEmployeeFingerprint = $state('');
  let savedRolesFingerprint = $state('');
  let savedDepartmentFingerprint = $state('');
  let selectingEmployee = $state(false);
  let savingEmployee = $state(false);
  let inviteOpen = $state(false);
  let inviteEmail = $state('');
  const overview = $derived(enterpriseApi.overview);
  const employees = $derived(enterpriseApi.employees);
  const selectedEmployee = $derived(enterpriseApi.selectedEmployee);
  const loading = $derived(enterpriseApi.loading);
  const busy = $derived(enterpriseApi.busy);
  const editorBusy = $derived(busy || selectingEmployee || savingEmployee);
  const hasEmployeeChanges = $derived(
    Boolean(selectedEmployee && overview?.canManage) && JSON.stringify(employeeForm) !== savedEmployeeFingerprint
  );
  const hasRoleChanges = $derived(
    Boolean(selectedEmployee && overview?.isSuperAdmin) &&
      JSON.stringify([...selectedRoles].sort()) !== savedRolesFingerprint
  );
  const hasDepartmentChanges = $derived(
    showDepartmentForm && JSON.stringify(departmentForm) !== savedDepartmentFingerprint
  );
  const hasUnsavedChanges = $derived(
    hasEmployeeChanges || hasRoleChanges || hasDepartmentChanges || (inviteOpen && Boolean(inviteEmail))
  );
  const error = $derived(enterpriseApi.error);
  const notice = $derived(enterpriseApi.notice);
  const roleChoices: EnterpriseRole[] = [
    'SUPER_ADMIN',
    'TRAINING_ADMIN',
    'HR',
    'DEPARTMENT_MANAGER',
    'INSTRUCTOR',
    'EMPLOYEE'
  ];
  const filteredEmployees = $derived(
    enterpriseApi.employees.filter((employee) => matchesEmployee(employee, overview?.departments ?? [], search))
  );

  $effect(() => {
    const organizationId = $currentOrg.id;
    if (!organizationId) return;

    untrack(() => {
      void enterpriseApi.load(organizationId).then((loaded) => {
        if (loaded && $currentOrg.id === organizationId) populateEmployee();
      });
    });
  });

  afterNavigate(({ from, to }) => {
    if (from && to && from.url.search !== to.url.search) {
      showDepartmentForm = false;
      populateEmployee();
    }
  });

  function editDepartment(department?: EnterpriseDepartment) {
    if (editorBusy || (hasDepartmentChanges && !window.confirm($t('common.unsaved_changes.message')))) return;

    showDepartmentForm = true;
    editingDepartmentId = department?.id ?? null;
    departmentForm.name = department?.name ?? '';
    departmentForm.code = department?.code ?? '';
    departmentForm.parentId = department?.parentId ?? '';
    departmentForm.leaderMemberId = department?.leaderMemberId?.toString() ?? '';
    departmentForm.sort = department?.sort ?? 0;
    departmentForm.status = department?.status ?? 'ACTIVE';
    savedDepartmentFingerprint = JSON.stringify(departmentForm);
  }

  async function saveDepartment(event?: SubmitEvent) {
    event?.preventDefault();
    if (!enterpriseApi.overview?.canManage || !$currentOrg.id) return;

    const body = {
      name: departmentForm.name,
      code: departmentForm.code,
      parentId: departmentForm.parentId || null,
      leaderMemberId: departmentForm.leaderMemberId ? Number(departmentForm.leaderMemberId) : null,
      sort: departmentForm.sort,
      status: departmentForm.status
    };
    const path = editingDepartmentId ? `/departments/${editingDepartmentId}` : '/departments';
    const method = editingDepartmentId ? 'PUT' : 'POST';
    if (await enterpriseApi.save($currentOrg.id, path, method, body)) {
      savedDepartmentFingerprint = JSON.stringify(departmentForm);
      showDepartmentForm = false;
    }
  }

  async function selectEmployee(employee: EnterpriseEmployee) {
    if (!$currentOrg.id || editorBusy) return;
    if ((hasEmployeeChanges || hasRoleChanges) && !window.confirm($t('common.unsaved_changes.message'))) return;

    selectingEmployee = true;
    try {
      const detail = await enterpriseApi.selectEmployee($currentOrg.id, employee);
      if (detail) populateEmployee();
    } finally {
      selectingEmployee = false;
    }
  }

  function populateEmployee() {
    const detail = enterpriseApi.selectedEmployee;
    if (!detail) return;

    selectedRoles = [...detail.roles];
    employeeForm.employeeNo = detail.member.employeeNo ?? '';
    employeeForm.departmentId = detail.member.departmentId ?? '';
    employeeForm.position = detail.member.position ?? '';
    employeeForm.managerMemberId = detail.member.managerMemberId?.toString() ?? '';
    employeeForm.employmentStatus = detail.member.employmentStatus ?? '';
    employeeForm.joinDate = detail.member.joinDate ?? '';
    savedEmployeeFingerprint = JSON.stringify(employeeForm);
    savedRolesFingerprint = JSON.stringify([...selectedRoles].sort());
  }

  async function saveEmployee(event?: SubmitEvent) {
    event?.preventDefault();
    const selectedEmployee = enterpriseApi.selectedEmployee;
    if (!enterpriseApi.overview?.canManage || !selectedEmployee || !$currentOrg.id) return;

    const body = {
      employeeNo: employeeForm.employeeNo || null,
      departmentId: employeeForm.departmentId || null,
      position: employeeForm.position || null,
      managerMemberId: employeeForm.managerMemberId ? Number(employeeForm.managerMemberId) : null,
      employmentStatus: employeeForm.employmentStatus || null,
      joinDate: employeeForm.joinDate || null
    };
    const saved = await enterpriseApi.save($currentOrg.id, `/employees/${selectedEmployee.member.id}`, 'PUT', body);
    if (saved) {
      savedEmployeeFingerprint = JSON.stringify(employeeForm);
      await enterpriseApi.selectEmployee($currentOrg.id, selectedEmployee);
    }
    return saved;
  }

  function toggleRole(role: EnterpriseRole, checked: boolean) {
    selectedRoles = checked ? [...selectedRoles, role] : selectedRoles.filter((item) => item !== role);
  }

  async function saveRoles() {
    const selectedEmployee = enterpriseApi.selectedEmployee;
    if (!enterpriseApi.overview?.isSuperAdmin || !selectedEmployee || !$currentOrg.id) return;

    const saved = await enterpriseApi.save($currentOrg.id, `/employees/${selectedEmployee.member.id}/roles`, 'PUT', {
      roles: selectedRoles
    });
    if (saved) {
      savedRolesFingerprint = JSON.stringify([...selectedRoles].sort());
      await enterpriseApi.selectEmployee($currentOrg.id, selectedEmployee);
    }
    return saved;
  }

  async function saveEmployeeChanges(event?: SubmitEvent) {
    event?.preventDefault();
    if (editorBusy) return;

    savingEmployee = true;
    try {
      if (hasEmployeeChanges && !(await saveEmployee())) return;
      if (hasRoleChanges && !(await saveRoles())) return;

      populateEmployee();
    } finally {
      savingEmployee = false;
    }
  }

  function discardChanges() {
    if (activeView === 'departments') {
      showDepartmentForm = false;
      return;
    }

    populateEmployee();
  }

  function closeInvite() {
    if (editorBusy || (inviteEmail && !window.confirm($t('common.unsaved_changes.message')))) return;

    inviteOpen = false;
    inviteEmail = '';
  }

  async function inviteEmployee() {
    if (!$isOrgAdmin || !$currentOrg.id || editorBusy) return;

    const invited = await enterpriseApi.inviteEmployee($currentOrg.id, inviteEmail);
    if (invited) {
      inviteOpen = false;
      inviteEmail = '';
    }
  }
</script>

<UnsavedChanges {hasUnsavedChanges} />

<svelte:head>
  <title>{$t(headingKey)} · {$t('enterprise.company_name')}</title>
</svelte:head>

<Page.Root class="w-full">
  <Page.Header>
    <Page.HeaderContent>
      <div class="flex items-center gap-4">
        <div>
          <Page.Title>{$t(headingKey)}</Page.Title>
          <Page.Subtitle
            >{$t(
              activeView === 'workbench' ? 'enterprise.ui_v2.workbench_subtitle' : 'enterprise.subtitle'
            )}</Page.Subtitle
          >
        </div>
      </div>
    </Page.HeaderContent>
    <Page.Action>
      {#if activeView === 'workbench'}
        {#if overview?.canManage || overview?.roles.includes('DEPARTMENT_MANAGER')}<Button
            variant="outline"
            size="sm"
            href="/admin/statistics">{$t('org_navigation.stats')}</Button
          >{/if}
        {#if overview?.canManage}<Button size="sm" href="/admin/plans">{$t('enterprise.ui_v2.new_plan')}</Button>{/if}
      {/if}
      {#if activeView === 'employees' && $isOrgAdmin}<Button
          size="sm"
          disabled={editorBusy}
          onclick={() => (inviteOpen = true)}
          testId="employee-invite-open">{$t('enterprise.admin_workflow.invite_employee')}</Button
        >{/if}
    </Page.Action>
  </Page.Header>

  <Page.Body>
    {#snippet child()}
      {#if error}<p role="alert" class="rounded-md bg-red-50 p-3 text-red-700">{error}</p>
        <Button variant="outline" size="sm" onclick={() => void enterpriseApi.load($currentOrg.id)}
          >{$t('enterprise.ui_v2.retry')}</Button
        >{/if}
      {#if notice}<p role="status" class="rounded-md bg-green-50 p-3 text-green-700">{notice}</p>{/if}
      {#if loading}<p>{$t('enterprise.loading')}</p>{/if}

      {#if overview}
        {#if activeView === 'workbench' && (overview.canManage || overview.roles.includes('DEPARTMENT_MANAGER'))}
          <Workbench {overview} />
        {/if}
        {#if activeView === 'departments'}
          <section class="training-panel space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold">{$t('enterprise.departments')}</h2>
              {#if overview.canManage}
                <Button variant="outline" onclick={() => editDepartment()}>{$t('enterprise.add_department')}</Button>
              {/if}
            </div>
            <div class="overflow-x-auto rounded-lg border">
              <table class="w-full text-left text-sm">
                <thead class="ui:bg-muted/50 border-b">
                  <tr>
                    <th class="p-3">{$t('enterprise.name')}</th>
                    <th class="p-3">{$t('enterprise.code')}</th>
                    <th class="p-3">{$t('enterprise.parent')}</th>
                    <th class="p-3">{$t('enterprise.leader')}</th>
                    <th class="p-3">{$t('enterprise.status')}</th>
                    <th class="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {#each overview.departments as department (department.id)}
                    <tr class="border-b">
                      <td class="p-3">{department.name}</td>
                      <td class="p-3">{department.code}</td>
                      <td class="p-3"
                        >{overview.departments.find((item) => item.id === department.parentId)?.name ?? '—'}</td
                      >
                      <td class="p-3"
                        >{employees.find((item) => item.member.id === department.leaderMemberId)?.fullname ?? '—'}</td
                      >
                      <td class="p-3">{$t(`enterprise.${department.status.toLowerCase()}`)}</td>
                      <td class="p-3">
                        {#if overview.canManage}<Button variant="link" onclick={() => editDepartment(department)}
                            >{$t('enterprise.edit')}</Button
                          >{/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
            {#if overview.canManage && showDepartmentForm}
              <form onsubmit={saveDepartment} class="rounded-lg border p-4">
                <Field.Group>
                  <Field.Set disabled={editorBusy}>
                    <Field.Legend>{$t('enterprise.departments')}</Field.Legend>
                    <Field.Group class="grid gap-3 md:grid-cols-3">
                      <InputField
                        label={$t('enterprise.name')}
                        isRequired
                        maxLength={160}
                        bind:value={departmentForm.name}
                      />
                      <InputField
                        label={$t('enterprise.code')}
                        isRequired
                        maxLength={64}
                        bind:value={departmentForm.code}
                      />
                      <Field.Field>
                        <Field.Label>{$t('enterprise.parent')}</Field.Label>
                        <Select.Root type="single" bind:value={departmentForm.parentId}>
                          <Select.Trigger class="w-full"
                            >{overview.departments.find((item) => item.id === departmentForm.parentId)?.name ??
                              '—'}</Select.Trigger
                          >
                          <Select.Content>
                            <Select.Item value="">—</Select.Item>
                            {#each overview.departments.filter((item) => item.id !== editingDepartmentId && item.status === 'ACTIVE') as department (department.id)}
                              <Select.Item value={department.id}>{department.name}</Select.Item>
                            {/each}
                          </Select.Content>
                        </Select.Root>
                      </Field.Field>
                      <Field.Field>
                        <Field.Label>{$t('enterprise.leader')}</Field.Label>
                        <Select.Root type="single" bind:value={departmentForm.leaderMemberId}>
                          <Select.Trigger class="w-full"
                            >{employees.find((item) => item.member.id.toString() === departmentForm.leaderMemberId)
                              ?.fullname ?? '—'}</Select.Trigger
                          >
                          <Select.Content>
                            <Select.Item value="">—</Select.Item>
                            {#each employees.filter((item) => item.member.status === 'ACTIVE') as employee (employee.member.id)}
                              <Select.Item value={employee.member.id.toString()}
                                >{employee.fullname ?? employee.email ?? employee.member.email}</Select.Item
                              >
                            {/each}
                          </Select.Content>
                        </Select.Root>
                      </Field.Field>
                      <Field.Field>
                        <Field.Label>{$t('enterprise.status')}</Field.Label>
                        <Select.Root type="single" bind:value={departmentForm.status}>
                          <Select.Trigger class="w-full"
                            >{$t(`enterprise.${departmentForm.status.toLowerCase()}`)}</Select.Trigger
                          >
                          <Select.Content>
                            <Select.Item value="ACTIVE">{$t('enterprise.active')}</Select.Item>
                            <Select.Item value="INACTIVE">{$t('enterprise.inactive')}</Select.Item>
                          </Select.Content>
                        </Select.Root>
                      </Field.Field>
                    </Field.Group>
                  </Field.Set>
                </Field.Group>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={editorBusy}
                  onclick={() => {
                    if (!hasDepartmentChanges || window.confirm($t('common.unsaved_changes.message')))
                      showDepartmentForm = false;
                  }}>{$t('app.cancel')}</Button
                >
              </form>
            {/if}
          </section>
        {/if}
        {#if activeView === 'employees'}
          <section class="training-panel space-y-4">
            <div class="flex items-center justify-between gap-4">
              <h2 class="text-xl font-semibold">{$t('enterprise.employees')}</h2>
              <InputField label={$t('enterprise.admin_workflow.search_employees')} bind:value={search} />
            </div>
            <div class="grid gap-5 lg:grid-cols-2">
              <div class="max-h-[34rem] overflow-auto rounded-lg border">
                {#each filteredEmployees as employee (employee.member.id)}
                  <Button
                    variant="ghost"
                    class="flex h-auto w-full justify-between rounded-none border-b p-3 text-left"
                    disabled={editorBusy}
                    testId={`employee-${employee.member.id}`}
                    onclick={() => selectEmployee(employee)}
                  >
                    <span class="min-w-0 break-words whitespace-normal"
                      >{employeeLabel(employee, overview.departments)}</span
                    >
                  </Button>
                {/each}
                {#if filteredEmployees.length === 0}<p class="ui:text-muted-foreground p-4 text-sm">
                    {$t('enterprise.admin_workflow.no_matches')}
                  </p>{/if}
              </div>
              {#if selectedEmployee}
                <div class="space-y-4 rounded-lg border p-4">
                  <h3 class="text-lg font-medium">{selectedEmployee.fullname ?? selectedEmployee.email}</h3>
                  <Button variant="secondary" href={`/admin/employees/${selectedEmployee.member.id}/archive`}
                    >{$t('enterprise.assessment.archive')}</Button
                  >
                  <form onsubmit={saveEmployeeChanges}>
                    <Field.Group>
                      <Field.Set>
                        <Field.Legend>{$t('enterprise.employees')}</Field.Legend>
                        <Field.Group class="grid gap-3 sm:grid-cols-2">
                          <InputField
                            label={$t('enterprise.employee_no')}
                            testId="employee-number"
                            isDisabled={!overview.canManage || editorBusy}
                            bind:value={employeeForm.employeeNo}
                          />
                          <InputField
                            label={$t('enterprise.position')}
                            isDisabled={!overview.canManage || editorBusy}
                            bind:value={employeeForm.position}
                          />
                          <Field.Field>
                            <Field.Label>{$t('enterprise.department')}</Field.Label>
                            <Select.Root
                              type="single"
                              disabled={!overview.canManage || editorBusy}
                              bind:value={employeeForm.departmentId}
                            >
                              <Select.Trigger class="w-full"
                                >{overview.departments.find((item) => item.id === employeeForm.departmentId)?.name ??
                                  '—'}</Select.Trigger
                              >
                              <Select.Content>
                                <Select.Item value="">—</Select.Item>
                                {#each overview.departments.filter((item) => item.status === 'ACTIVE') as department (department.id)}
                                  <Select.Item value={department.id}>{department.name}</Select.Item>
                                {/each}
                              </Select.Content>
                            </Select.Root>
                          </Field.Field>
                          <Field.Field>
                            <Field.Label>{$t('enterprise.manager')}</Field.Label>
                            <Select.Root
                              type="single"
                              disabled={!overview.canManage || editorBusy}
                              bind:value={employeeForm.managerMemberId}
                            >
                              <Select.Trigger class="w-full"
                                >{employees.find((item) => item.member.id.toString() === employeeForm.managerMemberId)
                                  ?.fullname ?? '—'}</Select.Trigger
                              >
                              <Select.Content>
                                <Select.Item value="">—</Select.Item>
                                {#each employees.filter((item) => item.member.id !== selectedEmployee.member.id && item.member.status === 'ACTIVE') as employee (employee.member.id)}
                                  <Select.Item value={employee.member.id.toString()}
                                    >{employee.fullname ?? employee.email ?? employee.member.email}</Select.Item
                                  >
                                {/each}
                              </Select.Content>
                            </Select.Root>
                          </Field.Field>
                          <Field.Field>
                            <Field.Label>{$t('enterprise.employment_status')}</Field.Label>
                            <Select.Root
                              type="single"
                              disabled={!overview.canManage || editorBusy}
                              bind:value={employeeForm.employmentStatus}
                            >
                              <Select.Trigger class="w-full"
                                >{employeeForm.employmentStatus
                                  ? $t(`enterprise.${employeeForm.employmentStatus.toLowerCase()}`)
                                  : '—'}</Select.Trigger
                              >
                              <Select.Content>
                                <Select.Item value="">—</Select.Item>
                                <Select.Item value="ACTIVE">{$t('enterprise.active')}</Select.Item>
                                <Select.Item value="ON_LEAVE">{$t('enterprise.on_leave')}</Select.Item>
                                <Select.Item value="TERMINATED">{$t('enterprise.terminated')}</Select.Item>
                              </Select.Content>
                            </Select.Root>
                          </Field.Field>
                          <InputField
                            label={$t('enterprise.join_date')}
                            type="date"
                            isDisabled={!overview.canManage || editorBusy}
                            bind:value={employeeForm.joinDate}
                          />
                        </Field.Group>
                      </Field.Set>
                    </Field.Group>
                  </form>
                  {#if overview.isSuperAdmin}
                    <div class="space-y-3 border-t pt-4">
                      <h4 class="font-medium">{$t('enterprise.roles')}</h4>
                      <div class="grid gap-2 sm:grid-cols-2">
                        {#each roleChoices as role (role)}
                          <CheckboxField
                            disabled={editorBusy}
                            label={$t(`enterprise.role_${role.toLowerCase()}`)}
                            checked={selectedRoles.includes(role)}
                            onclick={() => toggleRole(role, !selectedRoles.includes(role))}
                          />
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </section>
        {/if}
      {/if}
    {/snippet}
  </Page.Body>
  <Page.SettingsActions
    hasChanges={activeView === 'departments'
      ? hasDepartmentChanges
      : activeView === 'employees' && (hasEmployeeChanges || hasRoleChanges)}
    loading={editorBusy}
    statusLabel={$t('common.unsaved_changes.label')}
    discardLabel={$t('common.discard')}
    saveLabel={$t('common.save_changes')}
    onSave={activeView === 'departments' ? saveDepartment : saveEmployeeChanges}
    onDiscard={discardChanges}
  />
</Page.Root>

<Dialog.Root
  open={inviteOpen}
  onOpenChange={(open) => {
    if (!open) closeInvite();
  }}
>
  <Dialog.Content>
    <Dialog.Header
      ><Dialog.Title>{$t('enterprise.admin_workflow.invite_employee')}</Dialog.Title><Dialog.Description
        >{$t('enterprise.admin_workflow.invite_help')}</Dialog.Description
      ></Dialog.Header
    >
    <InputField
      name="invite-email"
      label={$t('audience.email')}
      type="email"
      isRequired
      isDisabled={editorBusy}
      bind:value={inviteEmail}
    />
    {#if error}<p role="alert" class="text-red-700">{error}</p>{/if}
    <Dialog.Footer
      ><Button size="sm" variant="outline" disabled={editorBusy} onclick={closeInvite}>{$t('app.cancel')}</Button
      ><Button size="sm" disabled={editorBusy || !inviteEmail.trim()} onclick={inviteEmployee}
        >{$t('enterprise.admin_workflow.send_invite')}</Button
      ></Dialog.Footer
    >
  </Dialog.Content>
</Dialog.Root>
