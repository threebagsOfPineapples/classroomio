<script lang="ts">
  import { t } from '$lib/utils/functions/translations';
  import { Button } from '@cio/ui/base/button';
  import { InputField } from '@cio/ui/custom/input-field';
  import { TextareaField } from '@cio/ui/custom/textarea-field';
  import { CheckboxField } from '@cio/ui/custom/checkbox-field';
  import * as Field from '@cio/ui/base/field';
  import type { MentorshipApi } from '../api/mentorship.svelte';
  import { formatMentorshipDate } from '../utils/mentorship-utils';

  let { api }: { api: MentorshipApi } = $props();
  const detail = $derived(api.detail);
</script>

{#if detail}
  <section
    class="ui:border-border ui:bg-background rounded-lg border p-4 sm:p-6"
    aria-labelledby="mentorship-detail-title"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="mentorship-detail-title" class="text-xl font-semibold break-words">{detail.task.title}</h2>
        <p class="ui:text-muted-foreground mt-2 text-sm">
          {$t(`mentorship.state.${detail.task.state}`)} · {$t('mentorship.due_at')}: {formatMentorshipDate(
            detail.task.dueAt
          )}
        </p>
      </div>
      <Button variant="secondary" onclick={() => api.selectTask(detail.task.id)} disabled={api.busy}
        >{$t('mentorship.refresh')}</Button
      >
    </div>
    <dl class="mt-5 grid gap-4 sm:grid-cols-2">
      <div>
        <dt class="text-sm font-medium">{$t('mentorship.objective')}</dt>
        <dd class="mt-1 text-sm break-words whitespace-pre-wrap">{detail.task.objective}</dd>
      </div>
      <div>
        <dt class="text-sm font-medium">{$t('mentorship.criteria')}</dt>
        <dd class="mt-1 text-sm break-words whitespace-pre-wrap">{detail.task.scoringCriteria}</dd>
      </div>
      <div>
        <dt class="text-sm font-medium">{$t('mentorship.pass_score')}</dt>
        <dd class="mt-1 text-sm">{detail.task.passScore} / {detail.task.maxScore}</dd>
      </div>
      <div>
        <dt class="text-sm font-medium">{$t('mentorship.certifier')}</dt>
        <dd class="mt-1 text-sm">
          {$t(detail.task.certifier === 'MENTOR' ? 'mentorship.mentor' : 'mentorship.reviewer')}
        </dd>
      </div>
    </dl>
    <div class="ui:bg-muted mt-5 rounded-md p-4">
      <h3 class="font-medium">{$t('mentorship.prerequisites')}</h3>
      <p class="ui:text-muted-foreground mt-1 text-sm">{$t('mentorship.independent')}</p>
      {#if detail.task.exerciseId}
        <p class="ui:text-muted-foreground mt-1 text-sm">{$t('mentorship.exam_basis_notice')}</p>
        {#if !detail.evidence.examConfigurationUnchanged}<p class="ui:text-destructive mt-2 text-sm">
            {$t('mentorship.exam_changed')}
          </p>{/if}
      {/if}
      <div class="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div>
          {$t('mentorship.course')}: {#if !detail.task.courseId}{$t('mentorship.not_required')}{:else}{detail.evidence
              .courseProgress ?? '—'}% ·
            <a class="ui:text-primary underline" href={`/courses/${detail.task.courseId}`}
              >{$t('mentorship.open_course')}</a
            >{/if}
        </div>
        <div>
          {$t('mentorship.exam')}: {#if !detail.task.exerciseId}{$t('mentorship.not_required')}{:else}{detail.evidence
              .examScore ?? '—'} / {detail.evidence.examMaxScore ?? '—'} · {$t(
              detail.evidence.examPassed ? 'mentorship.passed' : 'mentorship.pending'
            )} ·
            <a
              class="ui:text-primary underline"
              href={`/courses/${detail.task.courseId}/exercises/${detail.task.exerciseId}`}
              >{$t('mentorship.open_exam')}</a
            >{/if}
        </div>
        <div>
          {$t('mentorship.certification')}: {$t(
            detail.task.state === 'CERTIFIED' ? 'mentorship.passed' : 'mentorship.pending'
          )}
        </div>
      </div>
    </div>

    {#if detail.permissions.submit && ['LEARNER_PENDING', 'RETURNED'].includes(detail.task.state)}
      <Field.Group class="mt-6">
        <Field.Set>
          <Field.Legend>{$t('mentorship.submit')}</Field.Legend>
          <Field.Description>{$t('mentorship.submit_notice')}</Field.Description>
          <TextareaField
            name="mentorship-submission-text"
            id="mentorship-submission-text"
            aria-label={$t('mentorship.submission_text')}
            label={$t('mentorship.submission_text')}
            bind:value={api.submissionText}
          />
          <CheckboxField
            name="mentorship-completion-confirmed"
            label={$t('mentorship.confirm_completion')}
            bind:checked={api.completionConfirmed}
            disabled={api.busy}
          />
        </Field.Set>
        <Button
          testId="mentorship-learner-submit"
          onclick={() => api.submit()}
          disabled={api.busy || !api.completionConfirmed}>{$t('mentorship.submit')}</Button
        >
      </Field.Group>
    {/if}

    {#if detail.permissions.review && detail.task.state === 'MENTOR_PENDING'}
      <Field.Group class="mt-6">
        <Field.Set>
          <Field.Legend>{$t('mentorship.mentor_review')}</Field.Legend>
          <Field.Description>{$t('mentorship.field_verification')}</Field.Description>
          <TextareaField
            name="mentorship-mentor-review-content"
            id="mentorship-mentor-review-content"
            aria-label={$t('mentorship.review_content')}
            label={$t('mentorship.review_content')}
            bind:value={api.reviewContent}
          />
          <div class="grid gap-3 sm:grid-cols-2">
            <InputField
              name="mentorship-review-score"
              label={$t('mentorship.score')}
              type="number"
              min={0}
              max={detail.task.maxScore}
              bind:value={api.reviewScore}
              isDisabled={api.busy}
            />
            <InputField
              name="mentorship-observed-at"
              label={$t('mentorship.observed_at')}
              type="datetime-local"
              bind:value={api.observedAt}
              isDisabled={api.busy}
            />
          </div>
        </Field.Set>
        <div class="flex flex-wrap justify-end gap-3">
          <Button size="sm" variant="outline" onclick={() => api.review('RETURN')} disabled={api.busy}
            >{$t('mentorship.return')}</Button
          >
          <Button size="sm" testId="mentorship-mentor-pass" onclick={() => api.review('PASS')} disabled={api.busy}
            >{$t('mentorship.pass_review')}</Button
          >
        </div>
      </Field.Group>
    {/if}

    {#if detail.permissions.supervisorReview && detail.task.state === 'SUPERVISOR_PENDING'}
      <Field.Group class="mt-6">
        <Field.Set>
          <Field.Legend>{$t('mentorship.supervisor_review')}</Field.Legend>
          <Field.Description>{$t('mentorship.return_to_learner')}</Field.Description>
          <TextareaField
            name="mentorship-supervisor-review-content"
            id="mentorship-supervisor-review-content"
            aria-label={$t('mentorship.review_content')}
            label={$t('mentorship.review_content')}
            bind:value={api.reviewContent}
          />
        </Field.Set>
        <div class="flex flex-wrap justify-end gap-3">
          <Button size="sm" variant="outline" onclick={() => api.supervisorReview('RETURN')} disabled={api.busy}
            >{$t('mentorship.return')}</Button
          >
          <Button
            size="sm"
            testId="mentorship-supervisor-pass"
            onclick={() => api.supervisorReview('PASS')}
            disabled={api.busy}>{$t('mentorship.pass_review')}</Button
          >
        </div>
      </Field.Group>
    {/if}

    {#if detail.permissions.certify && detail.task.state === 'READY_TO_CERTIFY'}
      <Field.Group class="mt-6">
        <Field.Set>
          <Field.Legend>{$t('mentorship.certification')}</Field.Legend>
          <Field.Description>{$t('mentorship.certification_notice')}</Field.Description>
          <TextareaField
            name="mentorship-certification-content"
            id="mentorship-certification-content"
            aria-label={$t('mentorship.certification_content')}
            label={$t('mentorship.certification_content')}
            bind:value={api.certificationContent}
          />
        </Field.Set>
        <Button
          testId="mentorship-certify"
          onclick={() => api.certify()}
          disabled={api.busy || !detail.evidence.courseComplete || !detail.evidence.examPassed}
          >{$t('mentorship.certify')}</Button
        >
      </Field.Group>
    {/if}

    {#if !detail.permissions.submit && !detail.permissions.review && !detail.permissions.supervisorReview && !detail.permissions.certify}
      <p class="ui:bg-muted ui:text-muted-foreground mt-5 rounded-md p-3 text-sm">{$t('mentorship.read_only')}</p>
    {/if}

    <h3 class="mt-7 font-semibold">{$t('mentorship.history')}</h3>
    {#if detail.history.submissions.length === 0}<p class="ui:text-muted-foreground mt-3 text-sm">
        {$t('mentorship.no_submissions')}
      </p>{/if}
    <div class="mt-3 space-y-4">
      {#each detail.history.submissions as submission (submission.id)}
        <article class="ui:border-border rounded-md border p-4">
          <h4 class="font-medium">
            {$t('mentorship.round')}
            {submission.round} · {formatMentorshipDate(submission.submittedAt)}
          </h4>
          <p class="mt-2 text-sm break-words whitespace-pre-wrap">{submission.content || $t('mentorship.confirmed')}</p>
          {#each detail.history.reviews.filter((review) => review.submissionId === submission.id) as review (review.id)}
            <div class="ui:border-border mt-3 border-t pt-3 text-sm">
              <p class="font-medium">
                {$t('mentorship.mentor_review')} · {$t(
                  review.decision === 'PASS' ? 'mentorship.passed' : 'mentorship.returned'
                )} · {review.score ?? '—'} / {detail.task.maxScore}
              </p>
              <p class="mt-1 break-words whitespace-pre-wrap">{review.content}</p>
              <p class="ui:text-muted-foreground mt-1">
                #{review.mentorMemberId} · {formatMentorshipDate(review.createdAt)}{#if review.observedAt}
                  · {$t('mentorship.observed_at')}: {formatMentorshipDate(review.observedAt)}{/if}
              </p>
              {#each detail.history.supervisorReviews.filter((supervisor) => supervisor.reviewId === review.id) as supervisor (supervisor.id)}
                <div class="ui:bg-muted mt-3 rounded-md p-3">
                  <p class="font-medium">
                    {$t('mentorship.supervisor_review')} · {$t(
                      supervisor.decision === 'PASS' ? 'mentorship.passed' : 'mentorship.returned'
                    )}
                  </p>
                  <p class="mt-1 break-words whitespace-pre-wrap">{supervisor.content}</p>
                  <p class="ui:text-muted-foreground mt-1">
                    #{supervisor.reviewerMemberId} · {formatMentorshipDate(supervisor.createdAt)}
                  </p>
                </div>
              {/each}
            </div>
          {/each}
          {#each detail.history.certifications.filter((certification) => certification.submissionId === submission.id) as certification (certification.id)}
            <div class="ui:bg-muted mt-3 rounded-md p-3 text-sm">
              <p class="font-medium">
                {$t('mentorship.certification')} · {formatMentorshipDate(certification.createdAt)}
              </p>
              <p class="mt-1 break-words whitespace-pre-wrap">{certification.content}</p>
            </div>
          {/each}
        </article>
      {/each}
      {#each detail.handovers as handover (handover.id)}
        <div class="ui:border-border rounded-md border p-3 text-sm">
          <p class="font-medium">{$t('mentorship.change_mentor')} · {formatMentorshipDate(handover.createdAt)}</p>
          <p class="mt-1 break-words whitespace-pre-wrap">{handover.reason}</p>
        </div>
      {/each}
    </div>
  </section>
{/if}
