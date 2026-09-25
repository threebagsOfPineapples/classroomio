<script lang="ts">
  import { currentOrg } from '$lib/utils/store/org';
  import { t } from '$lib/utils/functions/translations';
  import { AssessmentApi } from '$lib/features/enterprise/api/assessment.svelte';
  import { trainingStatusKey } from '$lib/features/enterprise/utils/training-labels';
  import { Button } from '@cio/ui/base/button';
  import { ScrollToTop } from '@cio/ui/custom/scroll-to-top';
  import * as Page from '@cio/ui/base/page';

  const assessmentApi = new AssessmentApi();

  let lastOrganizationId = '';
  $effect(() => {
    const organizationId = $currentOrg.id;
    if (!organizationId || organizationId === lastOrganizationId) return;

    lastOrganizationId = organizationId;
    assessmentApi.matrix = null;
    void assessmentApi.loadMatrix(organizationId);
  });
</script>

<svelte:head>
  <title>{$t('enterprise.assessment.matrix')}</title>
</svelte:head>

<Page.Root role="main" class="mx-auto max-w-7xl px-6">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>{$t('enterprise.assessment.matrix')}</Page.Title>
      <Page.Subtitle>{$t('enterprise.assessment.subtitle')}</Page.Subtitle>
    </Page.HeaderContent>
    <Page.Action>
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
        <div class="overflow-x-auto rounded-lg border">
          <table class="min-w-full text-left text-sm">
            <thead class="ui:bg-muted">
              <tr>
                <th scope="col" class="min-w-40 p-3">{$t('enterprise.employees')}</th>
                {#each assessmentApi.matrix.plans as plan (plan.id)}
                  <th scope="col" class="min-w-40 p-3">{plan.name}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each assessmentApi.matrix.employees as employee (employee.memberId)}
                <tr class="border-t">
                  <th scope="row" class="p-3 font-medium">{employee.name}</th>
                  {#each employee.cells as cell (cell.planId)}
                    <td class="p-3">
                      {$t(trainingStatusKey(cell.status))}
                      {#if cell.finalScore !== null}<span class="ui:text-muted-foreground">
                          · {cell.finalScore}</span
                        >{/if}
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

<ScrollToTop label={$t('common.scroll_to_top')} />
