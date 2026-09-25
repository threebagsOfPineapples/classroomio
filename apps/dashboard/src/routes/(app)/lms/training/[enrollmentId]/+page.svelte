<script lang="ts">
  import { page } from '$app/state';
  import { currentOrg } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import { t } from '$lib/utils/functions/translations';
  import { AssessmentApi } from '$lib/features/enterprise/api/assessment.svelte';
  import type { TrainingEvaluationDraft } from '$lib/features/enterprise/utils/types';
  import { Button } from '@cio/ui/base/button';
  import { InputField } from '@cio/ui/custom/input-field';
  import { TextareaField } from '@cio/ui/custom/textarea-field';
  import * as Field from '@cio/ui/base/field';
  import * as Page from '@cio/ui/base/page';

  const assessmentApi = new AssessmentApi();

  let lastLoadKey = '';
  let message = $state('');
  let evaluation = $state<TrainingEvaluationDraft>({
    contentRating: 5,
    instructorRating: 5,
    usefulnessRating: 5,
    difficultyRating: 3,
    satisfactionRating: 5,
    helpfulContent: '',
    improvements: '',
    suggestions: ''
  });

  async function loadEnrollment(organizationId: string, enrollmentId: string, loadKey: string) {
    await assessmentApi.loadDetail(organizationId, enrollmentId);
    if (lastLoadKey !== loadKey || assessmentApi.detail?.scheme?.status !== 'PUBLISHED') return;

    await assessmentApi.recalculate(organizationId, enrollmentId);
  }

  $effect(() => {
    const organizationId = $currentOrg.id;
    const profileId = $profile.id;
    const enrollmentId = page.params.enrollmentId;
    if (!organizationId || !profileId || !enrollmentId) return;

    const loadKey = `${organizationId}:${profileId}:${enrollmentId}`;
    if (lastLoadKey === loadKey) return;

    lastLoadKey = loadKey;
    assessmentApi.detail = null;
    void loadEnrollment(organizationId, enrollmentId, loadKey);
  });

  async function submitEvaluation() {
    const organizationId = $currentOrg.id;
    const enrollmentId = page.params.enrollmentId;
    if (!organizationId || !enrollmentId) return;

    const saved = await assessmentApi.evaluate(organizationId, enrollmentId, evaluation);
    if (saved) message = $t('enterprise.assessment.submitted');
  }

  async function refreshAssessment() {
    const organizationId = $currentOrg.id;
    const enrollmentId = page.params.enrollmentId;
    if (!organizationId || !enrollmentId) return;

    await assessmentApi.recalculate(organizationId, enrollmentId);
  }
</script>

<svelte:head>
  <title>{$t('enterprise.assessment.details')}</title>
</svelte:head>

<Page.Root role="main" class="mx-auto max-w-4xl px-6">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>{$t('enterprise.assessment.details')}</Page.Title>
      <Page.Subtitle>{assessmentApi.detail?.plan.name ?? $t('enterprise.my_training.title')}</Page.Subtitle>
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
      {#if message}<p role="status" class="rounded-md bg-green-50 p-3 text-green-700">{message}</p>{/if}
      {#if assessmentApi.loading}<p>{$t('enterprise.loading')}</p>{/if}
      {#if assessmentApi.detail}
        <div class="space-y-6 pb-8">
          <section class="space-y-3 rounded-lg border p-5">
            <h2 class="text-lg font-semibold">{$t('enterprise.assessment.score')}</h2>
            {#if assessmentApi.detail.scheme?.status === 'PUBLISHED'}
              <Button variant="secondary" size="sm" disabled={assessmentApi.busy} onclick={refreshAssessment}>
                {$t('enterprise.assessment.recalculate')}
              </Button>
            {/if}
            <p>{assessmentApi.detail.score?.finalScore ?? '—'} · {assessmentApi.detail.score?.result ?? 'PENDING'}</p>
            <p>
              {$t('enterprise.my_training.progress')}: {assessmentApi.detail.enrollment.progressPercent === null
                ? '—'
                : `${assessmentApi.detail.enrollment.progressPercent}%`}
            </p>
            {#each assessmentApi.detail.scheme?.items ?? [] as item (item.id)}
              {@const detail = assessmentApi.detail.score?.details.find((candidate) => candidate.itemId === item.id)}
              <p>{item.name}: {detail?.rawScore ?? '—'} / {item.maxScore} · {detail?.weightedScore ?? '—'}</p>
            {/each}
          </section>

          {#if assessmentApi.detail.evaluation}
            <p>{$t('enterprise.assessment.submitted')}</p>
          {:else if assessmentApi.detail.enrollment.status === 'COMPLETED'}
            <section class="space-y-4 rounded-lg border p-5">
              <h2 class="text-lg font-semibold">{$t('enterprise.assessment.evaluate')}</h2>
              <Field.Group>
                <Field.Set>
                  <Field.Legend>{$t('enterprise.assessment.evaluate')}</Field.Legend>
                  <div class="grid gap-3 sm:grid-cols-2">
                    <InputField
                      label={$t('enterprise.assessment.content_rating')}
                      type="number"
                      min={1}
                      max={5}
                      bind:value={evaluation.contentRating}
                    />
                    <InputField
                      label={$t('enterprise.assessment.instructor_rating')}
                      type="number"
                      min={1}
                      max={5}
                      bind:value={evaluation.instructorRating}
                    />
                    <InputField
                      label={$t('enterprise.assessment.usefulness_rating')}
                      type="number"
                      min={1}
                      max={5}
                      bind:value={evaluation.usefulnessRating}
                    />
                    <InputField
                      label={$t('enterprise.assessment.difficulty_rating')}
                      type="number"
                      min={1}
                      max={5}
                      bind:value={evaluation.difficultyRating}
                    />
                    <InputField
                      label={$t('enterprise.assessment.satisfaction_rating')}
                      type="number"
                      min={1}
                      max={5}
                      bind:value={evaluation.satisfactionRating}
                    />
                  </div>
                  <TextareaField
                    label={$t('enterprise.assessment.helpful_content')}
                    bind:value={evaluation.helpfulContent}
                  />
                  <TextareaField
                    label={$t('enterprise.assessment.improvements')}
                    bind:value={evaluation.improvements}
                  />
                  <TextareaField label={$t('enterprise.assessment.suggestions')} bind:value={evaluation.suggestions} />
                </Field.Set>
              </Field.Group>
              <Button disabled={assessmentApi.busy} onclick={submitEvaluation}
                >{$t('enterprise.assessment.evaluate')}</Button
              >
            </section>
          {/if}
        </div>
      {/if}
    {/snippet}
  </Page.Body>
</Page.Root>
