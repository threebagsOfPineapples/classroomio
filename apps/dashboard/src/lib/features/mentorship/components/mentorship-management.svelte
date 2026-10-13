<script lang="ts">
  import { t } from '$lib/utils/functions/translations';
  import { Button } from '@cio/ui/base/button';
  import { InputField } from '@cio/ui/custom/input-field';
  import { TextareaField } from '@cio/ui/custom/textarea-field';
  import { CheckboxField } from '@cio/ui/custom/checkbox-field';
  import * as Field from '@cio/ui/base/field';
  import MentorshipSelect from './mentorship-select.svelte';
  import type { MentorshipApi } from '../api/mentorship.svelte';
  import { memberChoices } from '../utils/mentorship-utils';

  let { api }: { api: MentorshipApi } = $props();
  const members = $derived(memberChoices(api.options?.members ?? []));
  const mentors = $derived(memberChoices((api.options?.members ?? []).filter((member) => member.mentorQualified)));
  const supervisors = $derived(
    memberChoices((api.options?.members ?? []).filter((member) => member.supervisorQualified))
  );
  const filteredMembers = $derived(
    members.filter((member) => member.label.toLowerCase().includes(api.binding.search.trim().toLowerCase()))
  );
  const currentRelations = $derived(
    api.relations.filter((row) => row.relation.status === 'ACTIVE' && Date.parse(row.relation.endsAt) > Date.now())
  );
  const relationChoices = $derived(
    currentRelations.map((row) => ({
      value: row.relation.id,
      label: `${row.learnerName ?? row.relation.learnerMemberId} → ${row.mentorName ?? row.relation.mentorMemberId}`
    }))
  );
</script>

<div class="grid gap-4 lg:grid-cols-2">
  <details class="ui:border-border rounded-lg border p-4">
    <summary class="cursor-pointer py-2 font-semibold">{$t('mentorship.bind')}</summary>
    <Field.Group class="mt-4">
      <Field.Set>
        <Field.Legend>{$t('mentorship.relationship')}</Field.Legend>
        <Field.Description>{$t('mentorship.mentor_qualification')}</Field.Description>
        <Field.Group>
          <MentorshipSelect
            label={$t('mentorship.mentor')}
            bind:value={api.binding.mentorMemberId}
            options={mentors}
            placeholder={$t('mentorship.select')}
            disabled={api.busy}
          />
          <MentorshipSelect
            label={$t('mentorship.plan')}
            bind:value={api.binding.planId}
            options={(api.options?.plans ?? []).map((plan) => ({ value: plan.id, label: plan.name }))}
            placeholder={$t('mentorship.optional')}
            disabled={api.busy}
          />
          <div class="grid gap-3 sm:grid-cols-2">
            <InputField
              name="mentorship-binding-starts-at"
              label={$t('mentorship.starts_at')}
              type="datetime-local"
              bind:value={api.binding.startsAt}
              isDisabled={api.busy}
            />
            <InputField
              name="mentorship-binding-ends-at"
              label={$t('mentorship.ends_at')}
              type="datetime-local"
              bind:value={api.binding.endsAt}
              isDisabled={api.busy}
            />
          </div>
        </Field.Group>
      </Field.Set>
      <Field.Separator />
      <Field.Set>
        <Field.Legend>{$t('mentorship.learners')} ({api.binding.learnerMemberIds.length})</Field.Legend>
        <InputField
          name="mentorship-binding-search"
          label={$t('mentorship.search_people')}
          bind:value={api.binding.search}
        />
        <div class="ui:border-border max-h-64 overflow-y-auto rounded-md border p-2">
          {#each filteredMembers as member (member.value)}
            <CheckboxField
              name={`mentorship-binding-learner-${member.value}`}
              label={member.label}
              checked={api.binding.learnerMemberIds.includes(Number(member.value))}
              onclick={() => api.toggleLearner(Number(member.value))}
              disabled={api.busy || member.value === api.binding.mentorMemberId}
            />
          {/each}
        </div>
      </Field.Set>
      <Button
        testId="mentorship-bind-submit"
        onclick={() => api.bind()}
        disabled={api.busy || api.binding.learnerMemberIds.length === 0}>{$t('mentorship.bind')}</Button
      >
    </Field.Group>
  </details>

  <details class="ui:border-border rounded-lg border p-4">
    <summary class="cursor-pointer py-2 font-semibold">{$t('mentorship.assign')}</summary>
    <Field.Group class="mt-4">
      <Field.Set>
        <Field.Legend>{$t('mentorship.task_configuration')}</Field.Legend>
        <Field.Group>
          <InputField
            name="mentorship-task-title"
            label={$t('mentorship.task_title')}
            bind:value={api.taskDraft.title}
            isRequired
            isDisabled={api.busy}
          />
          <TextareaField
            name="mentorship-task-objective"
            id="mentorship-task-objective"
            aria-label={$t('mentorship.objective')}
            label={$t('mentorship.objective')}
            bind:value={api.taskDraft.objective}
          />
          <TextareaField
            name="mentorship-task-scoring-criteria"
            id="mentorship-task-scoring-criteria"
            aria-label={$t('mentorship.criteria')}
            label={$t('mentorship.criteria')}
            bind:value={api.taskDraft.scoringCriteria}
          />
          <InputField
            name="mentorship-task-due-at"
            label={$t('mentorship.due_at')}
            type="datetime-local"
            bind:value={api.taskDraft.dueAt}
            isDisabled={api.busy}
          />
          <MentorshipSelect
            label={$t('mentorship.submission_type')}
            bind:value={api.taskDraft.submissionType}
            options={[
              { value: 'TEXT', label: $t('mentorship.type_text') },
              { value: 'CONFIRMATION', label: $t('mentorship.type_confirmation') }
            ]}
            placeholder={$t('mentorship.select')}
            disabled={api.busy}
          />
          <div class="grid gap-3 sm:grid-cols-2">
            <InputField
              name="mentorship-task-max-score"
              label={$t('mentorship.max_score')}
              type="number"
              min={1}
              max={10000}
              bind:value={api.taskDraft.maxScore}
              isDisabled={api.busy}
            />
            <InputField
              name="mentorship-task-pass-score"
              label={$t('mentorship.pass_score')}
              type="number"
              min={0}
              max={api.taskDraft.maxScore}
              bind:value={api.taskDraft.passScore}
              isDisabled={api.busy}
            />
          </div>
        </Field.Group>
      </Field.Set>
      <Field.Separator />
      <Field.Set>
        <Field.Legend>{$t('mentorship.prerequisites')}</Field.Legend>
        <Field.Description>{$t('mentorship.independent')}</Field.Description>
        <Field.Description>{$t('mentorship.exam_basis_notice')}</Field.Description>
        <Field.Group>
          <MentorshipSelect
            label={$t('mentorship.course')}
            bind:value={api.taskDraft.courseId}
            options={(api.options?.courses ?? []).map((course) => ({
              value: course.id,
              label: course.title ?? course.id
            }))}
            placeholder={$t('mentorship.optional')}
            disabled={api.busy}
          />
          <MentorshipSelect
            label={$t('mentorship.exam')}
            bind:value={api.taskDraft.exerciseId}
            options={(api.options?.exercises ?? [])
              .filter((exam) => exam.courseId === api.taskDraft.courseId)
              .map((exam) => ({ value: exam.id, label: exam.title ?? exam.id }))}
            placeholder={$t('mentorship.optional')}
            disabled={api.busy || !api.taskDraft.courseId}
          />
        </Field.Group>
      </Field.Set>
      <Field.Separator />
      <Field.Set>
        <Field.Legend>{$t('mentorship.review_configuration')}</Field.Legend>
        {#if api.taskDraft.exerciseId && api.options?.exercises.find((exam) => exam.id === api.taskDraft.exerciseId)?.passThreshold === null}
          <p role="alert" class="ui:text-destructive text-sm">{$t('mentorship.exam_threshold_required')}</p>
        {/if}
        <CheckboxField
          name="mentorship-task-requires-supervisor"
          label={$t('mentorship.requires_supervisor')}
          bind:checked={api.taskDraft.requiresSupervisorReview}
          disabled={api.busy}
        />
        {#if api.taskDraft.requiresSupervisorReview}
          <Field.Description>{$t('mentorship.reviewer_scope')}</Field.Description>
          <MentorshipSelect
            label={$t('mentorship.reviewer')}
            bind:value={api.taskDraft.reviewerMemberId}
            options={supervisors}
            placeholder={$t('mentorship.select')}
            disabled={api.busy}
          />
          <MentorshipSelect
            label={$t('mentorship.certifier')}
            bind:value={api.taskDraft.certifier}
            options={[
              { value: 'MENTOR', label: $t('mentorship.mentor') },
              { value: 'REVIEWER', label: $t('mentorship.reviewer') }
            ]}
            placeholder={$t('mentorship.select')}
            disabled={api.busy}
          />
        {:else}
          <p class="ui:text-muted-foreground text-sm">{$t('mentorship.mentor_certifies')}</p>
        {/if}
      </Field.Set>
      <Field.Separator />
      <Field.Set>
        <Field.Legend>{$t('mentorship.assignment_targets')} ({api.taskDraft.relationIds.length})</Field.Legend>
        <div class="ui:border-border max-h-64 overflow-y-auto rounded-md border p-2">
          {#each relationChoices as relation (relation.value)}
            <CheckboxField
              name={`mentorship-task-relation-${relation.value}`}
              label={relation.label}
              checked={api.taskDraft.relationIds.includes(relation.value)}
              onclick={() => api.toggleRelation(relation.value)}
              disabled={api.busy}
            />
          {/each}
          {#if relationChoices.length === 0}<p class="ui:text-muted-foreground p-2 text-sm">
              {$t('mentorship.no_relations')}
            </p>{/if}
        </div>
      </Field.Set>
      <Button
        testId="mentorship-task-create"
        onclick={() => api.assign()}
        disabled={api.busy || api.taskDraft.relationIds.length === 0}>{$t('mentorship.assign')}</Button
      >
    </Field.Group>
  </details>

  <details class="ui:border-border rounded-lg border p-4 lg:col-span-2">
    <summary class="cursor-pointer py-2 font-semibold">{$t('mentorship.change_mentor')}</summary>
    <Field.Group class="mt-4">
      <Field.Description>{$t('mentorship.handover_notice')}</Field.Description>
      <div class="grid gap-4 sm:grid-cols-2">
        <MentorshipSelect
          label={$t('mentorship.relationship')}
          bind:value={api.selectedRelationId}
          options={relationChoices}
          placeholder={$t('mentorship.select')}
          disabled={api.busy}
        />
        <MentorshipSelect
          label={$t('mentorship.new_mentor')}
          bind:value={api.replacementMentorId}
          options={mentors}
          placeholder={$t('mentorship.select')}
          disabled={api.busy}
        />
      </div>
      <TextareaField
        name="mentorship-handover-reason"
        id="mentorship-handover-reason"
        aria-label={$t('mentorship.handover_reason')}
        label={$t('mentorship.handover_reason')}
        bind:value={api.replacementReason}
      />
      <Button onclick={() => api.changeMentor()} disabled={api.busy || !api.selectedRelationId}
        >{$t('mentorship.change_mentor')}</Button
      >
    </Field.Group>
  </details>
</div>
