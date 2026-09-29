<script lang="ts">
  import { currentOrg } from '$lib/utils/store/org';
  import { t, locale } from '$lib/utils/functions/translations';
  import { AssessmentApi } from '$lib/features/enterprise/api/assessment.svelte';
  import { trainingStatusKey } from '$lib/features/enterprise/utils/training-labels';
  import { Button } from '@cio/ui/base/button';
  import { CheckboxField } from '@cio/ui/custom/checkbox-field';
  import { InputField } from '@cio/ui/custom/input-field';
  import * as Select from '@cio/ui/base/select';
  import * as Field from '@cio/ui/base/field';
  import { downloadXlsx } from '$lib/features/ui/export/export-renderers';
  import {
    filterTrainingMatrixEmployees,
    getTrainingMatrixExportRows
  } from '$lib/features/enterprise/utils/training-matrix';
  import * as Page from '@cio/ui/base/page';

  const assessmentApi = new AssessmentApi();
  let expiringOnly = $state(false);
  let employeeSearch = $state('');
  let selectedPlanId = $state('all');
  const visiblePlans = $derived(
    assessmentApi.matrix?.plans.filter((plan) => selectedPlanId === 'all' || plan.id === selectedPlanId) ?? []
  );
  const visibleEmployees = $derived(
    filterTrainingMatrixEmployees(
      assessmentApi.matrix?.employees ?? [],
      employeeSearch,
      selectedPlanId === 'all' ? '' : selectedPlanId,
      expiringOnly
    )
  );

  function exportResults() {
    if (assessmentApi.loading || assessmentApi.error || !assessmentApi.matrix) return;

    const rows = getTrainingMatrixExportRows(visibleEmployees, visiblePlans);
    const title = $t('enterprise.assessment.matrix');
    const employeeHeader = $t('enterprise.employees');
    const planHeader = $t('enterprise.assessment.plans');
    const statusHeader = $t('enterprise.status');
    const scoreHeader = $t('enterprise.assessment.score');
    const exportedAtHeader = $t('enterprise.operations.exported_at');
    const exportedAt = new Date().toLocaleString($locale === 'zh' ? 'zh-CN' : $locale);
    const filename = `${title}-${new Date().toISOString().slice(0, 10)}`;
    downloadXlsx({
      filename,
      title,
      columns: [
        { key: 'memberId', header: 'ID', value: (row) => row.memberId },
        { key: 'employee', header: employeeHeader, value: (row) => row.employeeName },
        { key: 'plan', header: planHeader, value: (row) => row.planName },
        { key: 'status', header: statusHeader, value: (row) => $t(trainingStatusKey(row.status)) },
        { key: 'score', header: scoreHeader, value: (row) => row.finalScore },
        { key: 'exportedAt', header: exportedAtHeader, value: () => exportedAt }
      ],
      rows
    });
  }

  let lastOrganizationId = '';
  $effect(() => {
    const organizationId = $currentOrg.id;
    if (!organizationId || organizationId === lastOrganizationId) return;

    lastOrganizationId = organizationId;
    employeeSearch = '';
    selectedPlanId = 'all';
    expiringOnly = false;
    assessmentApi.matrix = null;
    void assessmentApi.loadMatrix(organizationId);
  });
</script>

<svelte:head>
  <title>{$t('enterprise.assessment.matrix')}</title>
</svelte:head>

<Page.Root class="mx-auto max-w-7xl px-6">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>{$t('enterprise.assessment.matrix')}</Page.Title>
      <Page.Subtitle>{$t('enterprise.assessment.subtitle')}</Page.Subtitle>
    </Page.HeaderContent>
    <Page.Action>
      <Button
        onclick={exportResults}
        disabled={assessmentApi.loading ||
          !!assessmentApi.error ||
          visibleEmployees.length === 0 ||
          visiblePlans.length === 0}>{$t('enterprise.operations.export_excel')}</Button
      >
      <Button href="/admin/assessment" variant="secondary">{$t('enterprise.assessment.title')}</Button>
    </Page.Action>
  </Page.Header>
  <Page.Body>
    {#snippet child()}
      {#if assessmentApi.error}<p role="alert" class="rounded-md bg-red-50 p-3 text-red-700">
          {assessmentApi.error}
        </p>{/if}
      {#if assessmentApi.loading}<p>{$t('enterprise.loading')}</p>{/if}
      {#if assessmentApi.matrix}
        <div class="flex flex-wrap items-end gap-3">
          <InputField label={$t('enterprise.search')} bind:value={employeeSearch} />
          <Field.Field class="w-64">
            <Field.Label>{$t('enterprise.ui_v2.plan_filter')}</Field.Label>
            <Select.Root type="single" bind:value={selectedPlanId}>
              <Select.Trigger class="w-full"
                >{assessmentApi.matrix.plans.find((plan) => plan.id === selectedPlanId)?.name ??
                  $t('enterprise.ui_v2.plans_all')}</Select.Trigger
              >
              <Select.Content>
                <Select.Item value="all">{$t('enterprise.ui_v2.plans_all')}</Select.Item>
                {#each assessmentApi.matrix.plans as plan (plan.id)}
                  <Select.Item value={plan.id}>{plan.name}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </Field.Field>
        </div>
        <CheckboxField
          label={$t('compliance.filter.expiring_soon')}
          checked={expiringOnly}
          onclick={() => (expiringOnly = !expiringOnly)}
        />
        <div class="overflow-x-auto rounded-lg border">
          <table class="min-w-full text-left text-sm">
            <thead class="ui:bg-muted">
              <tr>
                <th scope="col" class="min-w-40 p-3">{$t('enterprise.employees')}</th>
                {#each visiblePlans as plan (plan.id)}
                  <th scope="col" class="min-w-40 p-3">{plan.name}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#if visibleEmployees.length === 0}
                <tr
                  ><td colspan={visiblePlans.length + 1} class="p-4 text-center">
                    {$t('compliance.learners.empty')}
                  </td></tr
                >
              {/if}
              {#each visibleEmployees as employee (employee.memberId)}
                <tr class="border-t">
                  <th scope="row" class="p-3 font-medium"
                    ><a class="ui:text-primary underline" href={`/admin/employees/${employee.memberId}/archive`}
                      >{employee.name}</a
                    ></th
                  >
                  {#each visiblePlans as plan (plan.id)}
                    {@const cell = employee.cells.find((item) => item.planId === plan.id)}
                    <td class="p-3">
                      {$t(trainingStatusKey(cell?.status ?? null))}
                      {#if cell && cell.finalScore !== null}<span class="ui:text-muted-foreground">
                          · {cell.finalScore}</span
                        >{/if}
                      {#if cell?.nearestCertificateExpiry}
                        <span
                          class={cell.certificateExpiringSoon
                            ? 'block text-xs text-amber-700'
                            : 'ui:text-muted-foreground block text-xs'}
                        >
                          {$t('enterprise.assessment.nearest_expiry')}:
                          {new Date(cell.nearestCertificateExpiry).toLocaleDateString(
                            $locale === 'zh' ? 'zh-CN' : $locale
                          )}
                          {#if cell.certificateExpiringSoon}· {$t('compliance.status.expiring_soon')}{/if}
                        </span>
                      {/if}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {/snippet}
  </Page.Body>
</Page.Root>
