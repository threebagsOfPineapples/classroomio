<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { currentOrg } from '$lib/utils/store/org';
  import { t } from '$lib/utils/functions/translations';
  import { enterpriseApi } from '$lib/features/enterprise/api/enterprise.svelte';
  import { AssessmentApi } from '$lib/features/enterprise/api/assessment.svelte';
  import { trainingPlansApi } from '$lib/features/enterprise/api/training-plans.svelte';
  import { getTrainingWorkbenchPlans } from '$lib/features/enterprise/utils/training-workbench';
  import type {
    EnterpriseDepartment,
    EnterpriseEmployee,
    EnterpriseGradingQueue,
    EnterpriseRole
  } from '$lib/features/enterprise/utils/types';
  import { Button } from '@cio/ui/base/button';
  import { InputField } from '@cio/ui/custom/input-field';
  import { CheckboxField } from '@cio/ui/custom/checkbox-field';
  import * as Select from '@cio/ui/base/select';
  import * as Field from '@cio/ui/base/field';
  import * as Page from '@cio/ui/base/page';

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
  const assessmentApi = new AssessmentApi();
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
  const overview = $derived(enterpriseApi.overview);
  const statistics = $derived(assessmentApi.statistics);
  const currentTime = Date.now();
  const workbenchPlans = $derived(getTrainingWorkbenchPlans(trainingPlansApi.plans, currentTime));
  const pendingAssignments = $derived(assessmentApi.gradingQueue.filter((item) => !item.isExam));
  const pendingWritten = $derived(assessmentApi.gradingQueue.filter((item) => item.hasWrittenQuestion));
  const employees = $derived(enterpriseApi.employees);
  const selectedEmployee = $derived(enterpriseApi.selectedEmployee);
  const loading = $derived(enterpriseApi.loading);
  const busy = $derived(enterpriseApi.busy);
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
    enterpriseApi.employees.filter((employee) => {
      const text = `${employee.fullname ?? ''} ${employee.email ?? employee.member.email ?? ''} ${employee.member.employeeNo ?? ''}`;
      return text.toLowerCase().includes(search.toLowerCase().trim());
    })
  );

  $effect(() => {
    const organizationId = $currentOrg.id;
    if (!organizationId) return;

    void enterpriseApi.load(organizationId).then((loaded) => {
      if (
        loaded &&
        $currentOrg.id === organizationId &&
        (enterpriseApi.overview?.canManage || enterpriseApi.overview?.roles.includes('DEPARTMENT_MANAGER'))
      ) {
        void assessmentApi.loadStatistics(organizationId);
        if (enterpriseApi.overview?.canManage) {
          void trainingPlansApi.load(organizationId);
          void assessmentApi.loadGradingQueue(organizationId);
        }
      }
    });
  });

  function editDepartment(department?: EnterpriseDepartment) {
    showDepartmentForm = true;
    editingDepartmentId = department?.id ?? null;
    departmentForm.name = department?.name ?? '';
    departmentForm.code = department?.code ?? '';
    departmentForm.parentId = department?.parentId ?? '';
    departmentForm.leaderMemberId = department?.leaderMemberId?.toString() ?? '';
    departmentForm.sort = department?.sort ?? 0;
    departmentForm.status = department?.status ?? 'ACTIVE';
  }

  async function saveDepartment(event: SubmitEvent) {
    event.preventDefault();
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
      editDepartment();
      showDepartmentForm = false;
    }
  }

  async function selectEmployee(employee: EnterpriseEmployee) {
    if (!$currentOrg.id) return;

    await enterpriseApi.selectEmployee($currentOrg.id, employee);
    const detail = enterpriseApi.selectedEmployee;
    if (!detail) return;

    selectedRoles = detail.roles;
    employeeForm.employeeNo = detail.member.employeeNo ?? '';
    employeeForm.departmentId = detail.member.departmentId ?? '';
    employeeForm.position = detail.member.position ?? '';
    employeeForm.managerMemberId = detail.member.managerMemberId?.toString() ?? '';
    employeeForm.employmentStatus = detail.member.employmentStatus ?? '';
    employeeForm.joinDate = detail.member.joinDate ?? '';
  }

  async function saveEmployee(event: SubmitEvent) {
    event.preventDefault();
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
    if (saved) await selectEmployee(selectedEmployee);
  }

  function toggleRole(role: EnterpriseRole, checked: boolean) {
    selectedRoles = checked ? [...selectedRoles, role] : selectedRoles.filter((item) => item !== role);
  }

  async function saveRoles() {
    const selectedEmployee = enterpriseApi.selectedEmployee;
    if (!enterpriseApi.overview?.isSuperAdmin || !selectedEmployee || !$currentOrg.id) return;

    await enterpriseApi.save($currentOrg.id, `/employees/${selectedEmployee.member.id}/roles`, 'PUT', {
      roles: selectedRoles
    });
  }
</script>

<svelte:head>
  <title>{$t(headingKey)} · {$t('enterprise.company_name')}</title>
</svelte:head>

{#snippet gradingItems(items: EnterpriseGradingQueue)}
  <ol class="space-y-1 text-sm">
    {#each items.slice(0, 5) as item (item.id)}
      <li class="py-1">
        {#if item.canGrade}
          <a
            class="ui:hover:text-primary"
            href={resolve(`/courses/${item.courseId}/submissions?submissionId=${item.id}`)}
            >{item.exerciseTitle} · {item.learnerName ?? '—'}</a
          >
        {:else}
          <span>{item.exerciseTitle} · {item.learnerName ?? '—'}</span>
          <span class="ui:text-muted-foreground"> · {$t('enterprise.workbench.instructor_only')}</span>
        {/if}
      </li>
    {:else}
      <li class="ui:text-muted-foreground">—</li>
    {/each}
  </ol>
{/snippet}

<Page.Root class="w-full">
  <Page.Header>
    <Page.HeaderContent>
      <div class="flex items-center gap-4">
        <div>
          <Page.Title>{$t(headingKey)}</Page.Title>
          <Page.Subtitle>{$t('enterprise.subtitle')}</Page.Subtitle>
        </div>
      </div>
    </Page.HeaderContent>
    <Page.Action>
      {#if overview?.canManage}
        <Button variant="secondary" href={resolve('/admin/plans')}>{$t('enterprise.plans.title')}</Button>
        <Button variant="secondary" href={resolve('/admin/assessment')}>{$t('enterprise.assessment.title')}</Button>
      {/if}
      {#if overview?.canManage || overview?.roles.includes('DEPARTMENT_MANAGER')}
        <Button variant="secondary" href={resolve('/admin/matrix')}>{$t('enterprise.assessment.matrix')}</Button>
        <Button variant="secondary" href={resolve('/admin/statistics')}>{$t('org_navigation.stats')}</Button>
      {/if}
    </Page.Action>
  </Page.Header>

  <Page.Body>
    {#snippet child()}
      {#if error}<p role="alert" class="rounded-md bg-red-50 p-3 text-red-700">{error}</p>{/if}
      {#if notice}<p role="status" class="rounded-md bg-green-50 p-3 text-green-700">{notice}</p>{/if}
      {#if loading}<p>{$t('enterprise.loading')}</p>{/if}

      {#if overview}
        {#if activeView === 'workbench' && (overview.canManage || overview.roles.includes('DEPARTMENT_MANAGER'))}
          <section aria-label={$t('enterprise.assessment.title')} class="training-panel space-y-6">
            {#if assessmentApi.error}<p role="alert">{assessmentApi.error}</p>{/if}
            {#if assessmentApi.loading}<p>{$t('enterprise.loading')}</p>{/if}
            {#if statistics}
              <div class="training-metrics grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <p>{$t('enterprise.assessment.learners')}: <strong>{statistics.learners}</strong></p>
                <p>
                  {$t('enterprise.assessment.completion_rate')}:
                  <strong>{statistics.completionRate === null ? '—' : `${statistics.completionRate}%`}</strong>
                </p>
                <p>
                  {$t('enterprise.assessment.pass_rate')}:
                  <strong>{statistics.passRate === null ? '—' : `${statistics.passRate}%`}</strong>
                </p>
                <p>
                  {$t('enterprise.assessment.average_score')}: <strong>{statistics.averageScore ?? '—'}</strong>
                </p>
              </div>
              {#if overview.canManage}
                <div class="grid gap-5 border-t pt-4 text-sm md:grid-cols-3">
                  <div>
                    <h2 class="mb-2 font-medium">{$t('enterprise.workbench.active_plans')}</h2>
                    {#each workbenchPlans.active as plan (plan.id)}
                      <a class="ui:hover:text-primary block py-1" href={resolve('/admin/plans')}>{plan.name}</a>
                    {:else}
                      <p class="ui:text-muted-foreground">—</p>
                    {/each}
                  </div>
                  <div>
                    <h2 class="mb-2 font-medium">{$t('enterprise.workbench.upcoming_plans')}</h2>
                    {#each workbenchPlans.upcoming as plan (plan.id)}
                      <a class="ui:hover:text-primary block py-1" href={resolve('/admin/plans')}
                        >{plan.name} · {new Date(plan.startAt).toLocaleDateString()}</a
                      >
                    {:else}
                      <p class="ui:text-muted-foreground">—</p>
                    {/each}
                  </div>
                  <div>
                    <h2 class="mb-2 font-medium">{$t('enterprise.workbench.due_soon')}</h2>
                    {#each workbenchPlans.dueSoon as plan (plan.id)}
                      <a class="ui:hover:text-primary block py-1" href={resolve('/admin/plans')}
                        >{plan.name} · {new Date(plan.endAt).toLocaleDateString()}</a
                      >
                    {:else}
                      <p class="ui:text-muted-foreground">—</p>
                    {/each}
                  </div>
                </div>
                <div class="grid gap-5 border-t pt-4 md:grid-cols-2">
                  <div>
                    <h2 class="mb-2 font-medium">{$t('enterprise.workbench.pending_assignments')}</h2>
                    {@render gradingItems(pendingAssignments)}
                  </div>
                  <div>
                    <h2 class="mb-2 font-medium">{$t('enterprise.workbench.pending_written')}</h2>
                    {@render gradingItems(pendingWritten)}
                  </div>
                </div>
                {#if assessmentApi.gradingQueueError}<p role="alert">{assessmentApi.gradingQueueError}</p>{/if}
              {/if}
              <div class="grid gap-5 border-t pt-4 md:grid-cols-2">
                <div>
                  <h2 class="mb-2 font-medium">{$t('enterprise.assessment.unfinished_plans')}</h2>
                  <ol class="space-y-1 text-sm">
                    {#each statistics.unfinishedPlans.slice(0, 5) as plan (plan.planId)}
                      <li class="flex justify-between gap-3"><span>{plan.name}</span><span>{plan.count}</span></li>
                    {/each}
                  </ol>
                </div>
                <div>
                  <h2 class="mb-2 font-medium">{$t('enterprise.assessment.by_department')}</h2>
                  <ol class="space-y-1 text-sm">
                    {#each [...statistics.byDepartment]
                      .sort((left, right) => right.assigned - left.assigned)
                      .slice(0, 5) as department (department.departmentId)}
                      <li class="flex justify-between gap-3">
                        <span
                          >{overview.departments.find((item) => item.id === department.departmentId)?.name ??
                            $t('enterprise.assessment.not_assigned')}</span
                        >
                        <span>{department.completionRate}%</span>
                      </li>
                    {/each}
                  </ol>
                </div>
              </div>
            {/if}
          </section>
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
                  <Field.Set>
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
                      <div class="flex items-end">
                        <Button type="submit" disabled={busy}>{$t('enterprise.save')}</Button>
                        <Button variant="outline" disabled={busy} onclick={() => (showDepartmentForm = false)}
                          >{$t('app.cancel')}</Button
                        >
                      </div>
                    </Field.Group>
                  </Field.Set>
                </Field.Group>
              </form>
            {/if}
          </section>
        {/if}
        {#if activeView === 'employees'}
          <section class="training-panel space-y-4">
            <div class="flex items-center justify-between gap-4">
              <h2 class="text-xl font-semibold">{$t('enterprise.employees')}</h2>
              <InputField label={$t('enterprise.search')} bind:value={search} />
            </div>
            <div class="grid gap-5 lg:grid-cols-2">
              <div class="max-h-[34rem] overflow-auto rounded-lg border">
                {#each filteredEmployees as employee (employee.member.id)}
                  <Button
                    variant="ghost"
                    class="flex h-auto w-full justify-between rounded-none border-b p-3 text-left"
                    onclick={() => selectEmployee(employee)}
                  >
                    <span>{employee.fullname ?? employee.email ?? employee.member.email ?? '—'}</span>
                    <span class="ui:text-muted-foreground">{employee.member.employeeNo ?? '—'}</span>
                  </Button>
                {/each}
              </div>
              {#if selectedEmployee}
                <div class="space-y-4 rounded-lg border p-4">
                  <h3 class="text-lg font-medium">{selectedEmployee.fullname ?? selectedEmployee.email}</h3>
                  <form onsubmit={saveEmployee}>
                    <Field.Group>
                      <Field.Set>
                        <Field.Legend>{$t('enterprise.employees')}</Field.Legend>
                        <Field.Group class="grid gap-3 sm:grid-cols-2">
                          <InputField
                            label={$t('enterprise.employee_no')}
                            isDisabled={!overview.canManage}
                            bind:value={employeeForm.employeeNo}
                          />
                          <InputField
                            label={$t('enterprise.position')}
                            isDisabled={!overview.canManage}
                            bind:value={employeeForm.position}
                          />
                          <Field.Field>
                            <Field.Label>{$t('enterprise.department')}</Field.Label>
                            <Select.Root
                              type="single"
                              disabled={!overview.canManage}
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
                              disabled={!overview.canManage}
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
                              disabled={!overview.canManage}
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
                            isDisabled={!overview.canManage}
                            bind:value={employeeForm.joinDate}
                          />
                        </Field.Group>
                      </Field.Set>
                      {#if overview.canManage}<Button type="submit" disabled={busy}>{$t('enterprise.save')}</Button
                        >{/if}
                    </Field.Group>
                  </form>
                  {#if overview.isSuperAdmin}
                    <div class="space-y-3 border-t pt-4">
                      <h4 class="font-medium">{$t('enterprise.roles')}</h4>
                      <div class="grid gap-2 sm:grid-cols-2">
                        {#each roleChoices as role (role)}
                          <CheckboxField
                            label={$t(`enterprise.role_${role.toLowerCase()}`)}
                            checked={selectedRoles.includes(role)}
                            onclick={() => toggleRole(role, !selectedRoles.includes(role))}
                          />
                        {/each}
                      </div>
                      <Button variant="outline" disabled={busy} onclick={saveRoles}
                        >{$t('enterprise.save_roles')}</Button
                      >
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
</Page.Root>
