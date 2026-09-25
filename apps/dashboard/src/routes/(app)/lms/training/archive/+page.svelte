<script lang="ts">
  import { currentOrg } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import { t } from '$lib/utils/functions/translations';
  import { AssessmentApi } from '$lib/features/enterprise/api/assessment.svelte';
  import { trainingResultKey, trainingStatusKey } from '$lib/features/enterprise/utils/training-labels';
  import { Button } from '@cio/ui/base/button';
  import { ScrollToTop } from '@cio/ui/custom/scroll-to-top';
  import * as Page from '@cio/ui/base/page';

  const assessmentApi = new AssessmentApi();

  let lastLoadKey = '';

  $effect(() => {
    const organizationId = $currentOrg.id;
    const profileId = $profile.id;
    if (!organizationId || !profileId) return;

    const loadKey = `${organizationId}:${profileId}`;
    if (lastLoadKey === loadKey) return;

    lastLoadKey = loadKey;
    assessmentApi.archiveSummary = null;
    void assessmentApi.loadArchiveSummary(organizationId);
  });
</script>

<svelte:head>
  <title>{$t('enterprise.assessment.archive')}</title>
</svelte:head>

<Page.Root role="main" class="mx-auto max-w-5xl px-6">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>{$t('enterprise.assessment.archive')}</Page.Title>
      <Page.Subtitle>{$t('enterprise.my_training.subtitle')}</Page.Subtitle>
    </Page.HeaderContent>
    <Page.Action>
      <Button href="/lms/training" variant="secondary">{$t('enterprise.my_training.title')}</Button>
    </Page.Action>
  </Page.Header>
  <Page.Body>
    {#snippet child()}
      {#if assessmentApi.error}<p role="alert" class="rounded-md bg-red-50 p-3 text-red-700">
          {assessmentApi.error}
        </p>{/if}
      {#if assessmentApi.loading}<p>{$t('enterprise.loading')}</p>{/if}
      {#if assessmentApi.archiveSummary}
        <div class="space-y-6 pb-8">
          <section class="grid gap-3 rounded-lg border p-5 sm:grid-cols-3">
            <p>{$t('enterprise.assessment.training_count')}: {assessmentApi.archiveSummary.trainingCount}</p>
            <p>{$t('enterprise.assessment.course_count')}: {assessmentApi.archiveSummary.courseCount}</p>
            <p>{$t('enterprise.assessment.certificate_count')}: {assessmentApi.archiveSummary.certificateCount}</p>
            <p>{$t('enterprise.assessment.average_score')}: {assessmentApi.archiveSummary.averageScore ?? '—'}</p>
            <p>
              {$t('enterprise.assessment.pass_rate')}: {assessmentApi.archiveSummary.passRate === null
                ? '—'
                : `${assessmentApi.archiveSummary.passRate}%`}
            </p>
            <p>
              {$t('enterprise.assessment.learning_hours')}: {assessmentApi.archiveSummary.actualLearningHours ?? '—'}
            </p>
            <p>{$t('enterprise.assessment.training_points')}: {assessmentApi.archiveSummary.trainingPoints ?? '—'}</p>
            <p>
              {$t('enterprise.assessment.nearest_expiry')}: {assessmentApi.archiveSummary.nearestCertificateExpiry
                ? new Date(assessmentApi.archiveSummary.nearestCertificateExpiry).toLocaleDateString()
                : '—'}
            </p>
          </section>
          {#each assessmentApi.archiveSummary.records as record (record.enrollmentId)}
            <section class="space-y-3 rounded-lg border p-5">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 class="text-lg font-semibold">{record.planName}</h2>
                  <p class="ui:text-muted-foreground text-sm">
                    {new Date(record.assignedAt).toLocaleDateString()} · {$t(trainingStatusKey(record.status))}
                  </p>
                </div>
                <Button href={`/lms/training/${record.enrollmentId}`} variant="secondary" size="sm">
                  {$t('enterprise.assessment.details')}
                </Button>
              </div>
              <p>
                {$t('enterprise.assessment.score')}: {record.finalScore ?? '—'} · {$t(trainingResultKey(record.result))}
              </p>
              <div class="space-y-1">
                {#each record.courses as course (course.id)}
                  <p class="text-sm">
                    {course.title} · {course.certificateAt ? $t('enterprise.assessment.certificate_count') : '—'}
                  </p>
                {/each}
              </div>
            </section>
          {/each}
        </div>
      {/if}
    {/snippet}
  </Page.Body>
</Page.Root>

<ScrollToTop label={$t('common.scroll_to_top')} />
