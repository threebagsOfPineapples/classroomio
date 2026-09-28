<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';
  import { currentOrg } from '$lib/utils/store/org';
  import { t } from '$lib/utils/functions/translations';
  import { enterpriseApi } from '$lib/features/enterprise/api/enterprise.svelte';
  import { trainingPlansApi } from '$lib/features/enterprise/api/training-plans.svelte';
  import type { TrainingPlanDetail, TrainingPlanDraft } from '$lib/features/enterprise/utils/types';
  import { Button } from '@cio/ui/base/button';
  import { InputField } from '@cio/ui/custom/input-field';
  import { CheckboxField } from '@cio/ui/custom/checkbox-field';
  import { TextareaField } from '@cio/ui/custom/textarea-field';
  import * as Select from '@cio/ui/base/select';
  import * as Field from '@cio/ui/base/field';
  import * as Page from '@cio/ui/base/page';

  const planTypes: TrainingPlanDraft['planType'][] = [
    'ANNUAL',
    'QUARTERLY',
    'MONTHLY',
    'ONBOARDING',
    'SPECIAL',
    'MANDATORY',
    'CUSTOM'
  ];
  const today = new Date().toLocaleDateString('sv-SE');
  let form = $state({
    name: '',
    code: '',
    description: '',
    year: String(new Date().getFullYear()),
    planType: 'CUSTOM' as TrainingPlanDraft['planType'],
    ownerMemberId: '',
    departmentId: '',
    startDate: today,
    endDate: today,
    passScore: ''
  });
  let selectedCourseIds = $state<string[]>([]);
  let departmentTargets = $state<Array<{ departmentId: string; includeDescendants: boolean }>>([]);
  let positionTargets = $state<string[]>([]);
  let employeeTargets = $state<number[]>([]);
  let supplementMemberIds = $state<number[]>([]);
  let positionInput = $state('');
  let planSearch = $state('');
  let message = $state('');
  let savedFingerprint = $state('');
  let lastOrganizationId: string | null = null;
  const selected = $derived(trainingPlansApi.selected);
  const canEdit = $derived(!selected || selected.plan.status === 'DRAFT');
  const hasUnsavedChanges = $derived(savedFingerprint !== getDraftFingerprint());
  const filteredPlans = $derived(
    trainingPlansApi.plans.filter((plan) =>
      `${plan.name} ${plan.code}`.toLocaleLowerCase().includes(planSearch.trim().toLocaleLowerCase())
    )
  );

  $effect(() => {
    const organizationId = $currentOrg.id;
    if (organizationId && organizationId !== lastOrganizationId) {
      lastOrganizationId = organizationId;
      untrack(() => {
        resetForm();
        void enterpriseApi.load(organizationId);
        void trainingPlansApi.load(organizationId).then(() => {
          const planId = page.url.searchParams.get('planId');
          if ($currentOrg.id === organizationId && planId && !trainingPlansApi.error) void selectPlan(planId);
        });
      });
    }
  });

  function getDraftFingerprint() {
    return JSON.stringify({ form, selectedCourseIds, departmentTargets, positionTargets, employeeTargets });
  }

  function toggleCourse(courseId: string) {
    selectedCourseIds = selectedCourseIds.includes(courseId)
      ? selectedCourseIds.filter((id) => id !== courseId)
      : [...selectedCourseIds, courseId];
    trainingPlansApi.preview = null;
  }

  function toggleDepartment(departmentId: string) {
    departmentTargets = departmentTargets.some((target) => target.departmentId === departmentId)
      ? departmentTargets.filter((target) => target.departmentId !== departmentId)
      : [...departmentTargets, { departmentId, includeDescendants: true }];
    trainingPlansApi.preview = null;
  }

  function toggleEmployee(memberId: number) {
    employeeTargets = employeeTargets.includes(memberId)
      ? employeeTargets.filter((id) => id !== memberId)
      : [...employeeTargets, memberId];
    trainingPlansApi.preview = null;
  }

  function toggleSupplementMember(memberId: number) {
    supplementMemberIds = supplementMemberIds.includes(memberId)
      ? supplementMemberIds.filter((id) => id !== memberId)
      : [...supplementMemberIds, memberId];
  }

  function addPosition() {
    const position = positionInput.trim();
    if (!position || positionTargets.some((value) => value.toLowerCase() === position.toLowerCase())) return;

    positionTargets = [...positionTargets, position];
    positionInput = '';
    trainingPlansApi.preview = null;
  }

  function resetForm() {
    trainingPlansApi.selected = null;
    trainingPlansApi.preview = null;
    form = {
      name: '',
      code: '',
      description: '',
      year: String(new Date().getFullYear()),
      planType: 'CUSTOM',
      ownerMemberId: '',
      departmentId: '',
      startDate: today,
      endDate: today,
      passScore: ''
    };
    selectedCourseIds = [];
    departmentTargets = [];
    positionTargets = [];
    employeeTargets = [];
    supplementMemberIds = [];
    message = '';
    savedFingerprint = getDraftFingerprint();
  }

  async function selectPlan(planId: string) {
    const organizationId = $currentOrg.id;
    if (!organizationId) return;

    await trainingPlansApi.select(organizationId, planId);
    const detail: TrainingPlanDetail | null = trainingPlansApi.selected;
    if (!detail) return;

    form = {
      name: detail.plan.name,
      code: detail.plan.code,
      description: detail.plan.description ?? '',
      year: String(detail.plan.year),
      planType: detail.plan.planType,
      ownerMemberId: String(detail.plan.ownerMemberId),
      departmentId: detail.plan.departmentId ?? '',
      startDate: new Date(detail.plan.startAt).toLocaleDateString('sv-SE'),
      endDate: new Date(detail.plan.endAt).toLocaleDateString('sv-SE'),
      passScore: detail.plan.passScore?.toString() ?? ''
    };
    selectedCourseIds = detail.courses.map((course) => course.courseId);
    departmentTargets = detail.targets
      .filter((target) => target.targetType === 'DEPARTMENT' && target.departmentId)
      .map((target) => ({ departmentId: target.departmentId!, includeDescendants: target.includeDescendants }));
    positionTargets = detail.targets
      .filter((target) => target.targetType === 'POSITION' && target.position)
      .map((target) => target.position!);
    employeeTargets = detail.targets
      .filter((target) => target.targetType === 'USER' && target.memberId)
      .map((target) => target.memberId!);
    supplementMemberIds = [];
    message = '';
    savedFingerprint = getDraftFingerprint();
  }

  async function saveDraft() {
    const organizationId = $currentOrg.id;
    if (!organizationId || !canEdit) return;

    if (!form.startDate || !form.endDate || selectedCourseIds.length === 0) {
      message = $t('enterprise.plans.complete_fields');
      return;
    }

    const targets: TrainingPlanDraft['targets'] = [
      ...departmentTargets.map((target) => ({ targetType: 'DEPARTMENT' as const, ...target })),
      ...positionTargets.map((position) => ({ targetType: 'POSITION' as const, position })),
      ...employeeTargets.map((memberId) => ({ targetType: 'USER' as const, memberId }))
    ];
    if (targets.length === 0) {
      message = $t('enterprise.plans.select_targets');
      return;
    }

    const startDate = new Date(`${form.startDate}T00:00:00`);
    const endDate = new Date(`${form.endDate}T23:59:59`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
      message = $t('enterprise.plans.complete_fields');
      return;
    }

    const draft: TrainingPlanDraft = {
      name: form.name.trim(),
      code: form.code.trim(),
      description: form.description.trim() || null,
      year: Number(form.year),
      planType: form.planType,
      ownerMemberId: form.ownerMemberId ? Number(form.ownerMemberId) : undefined,
      departmentId: form.departmentId || null,
      startAt: startDate.toISOString(),
      endAt: endDate.toISOString(),
      passScore: form.passScore ? Number(form.passScore) : null,
      courseIds: selectedCourseIds,
      targets
    };
    const saved = await trainingPlansApi.save(organizationId, draft, selected?.plan.id);
    if (saved) {
      savedFingerprint = getDraftFingerprint();
      message = $t('enterprise.saved');
    }
  }

  async function previewPlan() {
    if (!$currentOrg.id || !selected || hasUnsavedChanges) return;

    await trainingPlansApi.loadPreview($currentOrg.id, selected.plan.id);
  }

  async function publishPlan() {
    if (!$currentOrg.id || !selected || !trainingPlansApi.preview || hasUnsavedChanges) return;

    const published = await trainingPlansApi.publish($currentOrg.id, selected.plan.id);
    if (published) message = $t('enterprise.plans.published');
  }

  async function supplementPlan() {
    if (!$currentOrg.id || !selected || supplementMemberIds.length === 0) return;

    const supplemented = await trainingPlansApi.supplement($currentOrg.id, selected.plan.id, {
      memberIds: supplementMemberIds
    });
    if (supplemented) {
      supplementMemberIds = [];
      message = $t('enterprise.plans.supplemented');
    }
  }
</script>

<svelte:head>
  <title>{$t('enterprise.plans.title')}</title>
</svelte:head>

<Page.Root class="mx-auto max-w-6xl px-6">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>{$t('enterprise.plans.title')}</Page.Title>
      <Page.Subtitle>{$t('enterprise.plans.subtitle')}</Page.Subtitle>
    </Page.HeaderContent>
    <Page.Action>
      <Button variant="secondary" onclick={resetForm}>{$t('enterprise.plans.new')}</Button>
    </Page.Action>
  </Page.Header>
  <Page.Body>
    {#snippet child()}
      {#if trainingPlansApi.error}<p role="alert" class="rounded-md bg-red-50 p-3 text-red-700">
          {trainingPlansApi.error}
        </p>{/if}
      {#if message}<p role="status" class="rounded-md bg-green-50 p-3 text-green-700">{message}</p>{/if}
      {#if trainingPlansApi.loading}<p>{$t('enterprise.loading')}</p>{/if}

      {#if enterpriseApi.overview?.canManage}
        <div class="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <nav aria-label={$t('enterprise.plans.title')} class="space-y-2">
            <InputField name="plan-search" label={$t('enterprise.plans.title')} type="search" bind:value={planSearch} />
            {#each filteredPlans as plan (plan.id)}
              <Button
                variant={selected?.plan.id === plan.id ? 'secondary' : 'outline'}
                class="w-full justify-start"
                onclick={() => selectPlan(plan.id)}
              >
                {plan.name}
              </Button>
            {/each}
          </nav>

          <div class="space-y-6">
            {#if selected && !canEdit}
              <section class="rounded-lg border p-5">
                <h2 class="text-lg font-semibold">{selected.plan.name}</h2>
                <p class="ui:text-muted-foreground text-sm">
                  {$t(`enterprise.plans.status_${selected.plan.status.toLowerCase()}`)}
                </p>
                <p class="mt-3 text-sm">{$t('enterprise.plans.assigned')}: {selected.enrollmentCount}</p>
                {#if selected.plan.status === 'PUBLISHED'}
                  <Field.Group class="mt-5">
                    <Field.Set>
                      <Field.Legend>{$t('enterprise.plans.supplement')}</Field.Legend>
                      <Field.Group class="grid max-h-64 gap-2 overflow-auto sm:grid-cols-2">
                        {#each enterpriseApi.employees.filter((employee) => employee.member.status === 'ACTIVE' && employee.member.employmentStatus !== 'TERMINATED' && !selected.enrolledMemberIds.includes(employee.member.id)) as employee (employee.member.id)}
                          <CheckboxField
                            label={employee.fullname ??
                              employee.email ??
                              employee.member.email ??
                              String(employee.member.id)}
                            checked={supplementMemberIds.includes(employee.member.id)}
                            onclick={() => toggleSupplementMember(employee.member.id)}
                          />
                        {/each}
                      </Field.Group>
                    </Field.Set>
                    <Button
                      disabled={trainingPlansApi.busy || supplementMemberIds.length === 0}
                      onclick={supplementPlan}
                    >
                      {$t('enterprise.plans.supplement')}
                    </Button>
                  </Field.Group>
                {/if}
              </section>
            {:else}
              <Field.Group>
                <Field.Set>
                  <Field.Legend>{$t('enterprise.plans.details')}</Field.Legend>
                  <Field.Group class="grid gap-3 sm:grid-cols-2">
                    <InputField label={$t('enterprise.name')} isRequired bind:value={form.name} />
                    <InputField label={$t('enterprise.code')} isRequired bind:value={form.code} />
                    <InputField label={$t('enterprise.plans.year')} type="number" isRequired bind:value={form.year} />
                    <Field.Field>
                      <Field.Label>{$t('enterprise.plans.type')}</Field.Label>
                      <Select.Root type="single" bind:value={form.planType}>
                        <Select.Trigger class="w-full"
                          >{$t(`enterprise.plans.type_${form.planType.toLowerCase()}`)}</Select.Trigger
                        >
                        <Select.Content>
                          {#each planTypes as planType (planType)}
                            <Select.Item value={planType} label={$t(`enterprise.plans.type_${planType.toLowerCase()}`)}>
                              {$t(`enterprise.plans.type_${planType.toLowerCase()}`)}
                            </Select.Item>
                          {/each}
                        </Select.Content>
                      </Select.Root>
                    </Field.Field>
                    <InputField
                      label={$t('enterprise.plans.start_date')}
                      type="date"
                      isRequired
                      bind:value={form.startDate}
                    />
                    <InputField
                      label={$t('enterprise.plans.end_date')}
                      type="date"
                      isRequired
                      bind:value={form.endDate}
                    />
                    <InputField label={$t('enterprise.plans.pass_score')} type="number" bind:value={form.passScore} />
                    <Field.Field>
                      <Field.Label>{$t('enterprise.plans.owner')}</Field.Label>
                      <Select.Root type="single" bind:value={form.ownerMemberId}>
                        <Select.Trigger class="w-full">
                          {enterpriseApi.employees.find((employee) => String(employee.member.id) === form.ownerMemberId)
                            ?.fullname ?? '—'}
                        </Select.Trigger>
                        <Select.Content>
                          {#each enterpriseApi.employees.filter((employee) => employee.member.status === 'ACTIVE' && employee.member.employmentStatus !== 'TERMINATED') as employee (employee.member.id)}
                            <Select.Item
                              value={String(employee.member.id)}
                              label={employee.fullname ?? employee.email ?? ''}
                            >
                              {employee.fullname ?? employee.email ?? employee.member.email}
                            </Select.Item>
                          {/each}
                        </Select.Content>
                      </Select.Root>
                    </Field.Field>
                    <Field.Field>
                      <Field.Label>{$t('enterprise.department')}</Field.Label>
                      <Select.Root
                        type="single"
                        value={form.departmentId || 'none'}
                        onValueChange={(value) => (form.departmentId = value === 'none' ? '' : (value ?? ''))}
                      >
                        <Select.Trigger class="w-full">
                          {enterpriseApi.overview.departments.find((department) => department.id === form.departmentId)
                            ?.name ?? '—'}
                        </Select.Trigger>
                        <Select.Content>
                          <Select.Item value="none" label="—">—</Select.Item>
                          {#each enterpriseApi.overview.departments.filter((department) => department.status === 'ACTIVE') as department (department.id)}
                            <Select.Item value={department.id} label={department.name}>{department.name}</Select.Item>
                          {/each}
                        </Select.Content>
                      </Select.Root>
                    </Field.Field>
                  </Field.Group>
                  <TextareaField label={$t('enterprise.plans.description')} bind:value={form.description} />
                </Field.Set>

                <Field.Separator />

                <Field.Set>
                  <Field.Legend>{$t('enterprise.plans.courses')}</Field.Legend>
                  <Field.Group class="grid gap-2 sm:grid-cols-2">
                    {#each trainingPlansApi.courses as course (course.id)}
                      <CheckboxField
                        label={course.title}
                        checked={selectedCourseIds.includes(course.id)}
                        onclick={() => toggleCourse(course.id)}
                      />
                    {/each}
                  </Field.Group>
                </Field.Set>

                <Field.Separator />

                <Field.Set>
                  <Field.Legend>{$t('enterprise.plans.targets')}</Field.Legend>
                  <Field.Group class="space-y-3">
                    <p class="text-sm font-medium">{$t('enterprise.departments')}</p>
                    {#each enterpriseApi.overview.departments.filter((department) => department.status === 'ACTIVE') as department (department.id)}
                      <div class="flex flex-wrap items-center gap-4">
                        <CheckboxField
                          label={department.name}
                          checked={departmentTargets.some((target) => target.departmentId === department.id)}
                          onclick={() => toggleDepartment(department.id)}
                        />
                        {#if departmentTargets.some((target) => target.departmentId === department.id)}
                          <CheckboxField
                            label={$t('enterprise.plans.include_descendants')}
                            checked={departmentTargets.find((target) => target.departmentId === department.id)
                              ?.includeDescendants ?? false}
                            onclick={() => {
                              departmentTargets = departmentTargets.map((target) =>
                                target.departmentId === department.id
                                  ? { ...target, includeDescendants: !target.includeDescendants }
                                  : target
                              );
                              trainingPlansApi.preview = null;
                            }}
                          />
                        {/if}
                      </div>
                    {/each}
                    <p class="text-sm font-medium">{$t('enterprise.position')}</p>
                    <div class="flex gap-2">
                      <InputField label={$t('enterprise.position')} bind:value={positionInput} />
                      <Button variant="secondary" onclick={addPosition}>{$t('enterprise.plans.add')}</Button>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      {#each positionTargets as position (position)}
                        <Button
                          variant="outline"
                          size="sm"
                          onclick={() => {
                            positionTargets = positionTargets.filter((value) => value !== position);
                            trainingPlansApi.preview = null;
                          }}
                        >
                          {position} ×
                        </Button>
                      {/each}
                    </div>
                    <p class="text-sm font-medium">{$t('enterprise.employees')}</p>
                    <div class="grid max-h-64 gap-2 overflow-auto sm:grid-cols-2">
                      {#each enterpriseApi.employees.filter((employee) => employee.member.status === 'ACTIVE' && employee.member.employmentStatus !== 'TERMINATED') as employee (employee.member.id)}
                        <CheckboxField
                          label={employee.fullname ??
                            employee.email ??
                            employee.member.email ??
                            String(employee.member.id)}
                          checked={employeeTargets.includes(employee.member.id)}
                          onclick={() => toggleEmployee(employee.member.id)}
                        />
                      {/each}
                    </div>
                  </Field.Group>
                </Field.Set>
              </Field.Group>

              <Button disabled={trainingPlansApi.busy} onclick={saveDraft}>{$t('enterprise.plans.save_draft')}</Button>
            {/if}

            {#if selected?.plan.status === 'DRAFT'}
              <div class="flex flex-wrap items-center gap-3 border-t pt-4">
                <Button variant="secondary" disabled={trainingPlansApi.busy || hasUnsavedChanges} onclick={previewPlan}
                  >{$t('enterprise.plans.preview')}</Button
                >
                {#if trainingPlansApi.preview}
                  <span class="text-sm">{$t('enterprise.plans.eligible')}: {trainingPlansApi.preview.count}</span>
                  <Button
                    disabled={trainingPlansApi.busy || trainingPlansApi.preview.count === 0 || hasUnsavedChanges}
                    onclick={publishPlan}>{$t('enterprise.plans.publish')}</Button
                  >
                {/if}
              </div>
            {/if}
          </div>
        </div>
      {/if}
    {/snippet}
  </Page.Body>
</Page.Root>
