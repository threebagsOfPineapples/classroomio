<script lang="ts">
  import { untrack } from 'svelte';
  import { currentOrg } from '$lib/utils/store/org';
  import { t } from '$lib/utils/functions/translations';
  import { enterpriseApi } from '$lib/features/enterprise/api/enterprise.svelte';
  import { TrainingSessionApi } from '$lib/features/training-session/api/training-session.svelte';
  import { newSessionForm, sessionDraft, sessionEditorForm } from '$lib/features/training-session/utils/session-editor';
  import type { TrainingSessionCorrection } from '$lib/features/training-session/utils/types';
  import type { AvailableTrainingCourses, TrainingPlans } from '$lib/features/enterprise/utils/types';
  import { UnsavedChanges } from '$features/ui';
  import { Button } from '@cio/ui/base/button';
  import { InputField } from '@cio/ui/custom/input-field';
  import { TextareaField } from '@cio/ui/custom/textarea-field';
  import { CheckboxField } from '@cio/ui/custom/checkbox-field';
  import * as Page from '@cio/ui/base/page';
  import * as Field from '@cio/ui/base/field';
  import * as Select from '@cio/ui/base/select';
  import * as Dialog from '@cio/ui/base/dialog';

  const api = new TrainingSessionApi();
  let organizationId = $state('');
  let form = $state(newSessionForm());
  let memberIds = $state<number[]>([]);
  let departmentIds = $state<string[]>([]);
  let employeeSearch = $state('');
  let editing = $state(false);
  let editingId = $state('');
  let saved = $state('');
  let courses = $state<AvailableTrainingCourses>([]);
  let plans = $state<TrainingPlans>([]);
  let qrImage = $state('');
  let checkinLink = $state('');
  let pendingAction = $state<'PUBLISH' | 'CLOSE' | null>(null);
  let correctionMember = $state<number | null>(null);
  let correctionAction = $state<TrainingSessionCorrection['action']>('PRESENT');
  let correctionReason = $state('');
  const canManage = $derived(enterpriseApi.overview?.canManageTraining ?? false);
  const hasChanges = $derived(editing && saved !== JSON.stringify({ form, memberIds }));
  const departments = $derived(
    enterpriseApi.overview?.departments.filter((department) => department.status === 'ACTIVE') ?? []
  );

  async function load() {
    await enterpriseApi.load(organizationId);
    await api.load(organizationId);
    if (enterpriseApi.overview?.canManageTraining) {
      await api.loadCandidates(organizationId);
      const options = await api.operation(async () => {
        const [courseRows, planRows] = await Promise.all([
          enterpriseApi.request<AvailableTrainingCourses>(organizationId, '/training-courses'),
          enterpriseApi.request<TrainingPlans>(organizationId, '/plans')
        ]);
        return { courseRows, planRows };
      });
      if (options) {
        courses = options.courseRows;
        plans = options.planRows;
      }
    }
  }

  $effect(() => {
    const nextOrganizationId = $currentOrg.id;
    if (!nextOrganizationId || nextOrganizationId === organizationId) return;

    organizationId = nextOrganizationId;
    untrack(() => {
      editing = false;
      void load();
    });
  });

  async function select(sessionId: string) {
    editing = false;
    qrImage = '';
    checkinLink = '';
    api.filter.search = '';
    api.filter.status = 'ALL';
    await api.select(organizationId, sessionId);
  }

  async function openEditor(create = false) {
    if (create) {
      Object.assign(form, newSessionForm());
      memberIds = [];
      editingId = '';
    } else if (api.selected) {
      const sessionId = api.selected.session.id;
      api.filter.search = '';
      api.filter.status = 'ALL';
      const detail = await api.select(organizationId, sessionId);
      if (!detail) return;

      Object.assign(form, sessionEditorForm(detail));
      memberIds = detail.attendees.map((row) => row.attendance.memberId);
      editingId = detail.session.id;
    }
    departmentIds = [];
    api.preview = null;
    editing = true;
    saved = create ? '' : JSON.stringify({ form, memberIds });
  }

  function toggleMember(memberId: number) {
    memberIds = memberIds.includes(memberId)
      ? memberIds.filter((value) => value !== memberId)
      : [...memberIds, memberId];
    api.preview = null;
  }

  async function previewDepartments() {
    const preview = await api.previewAudience(organizationId, departmentIds, memberIds);
    if (preview) memberIds = preview.members.map((member) => member.memberId);
  }

  async function save() {
    const draft = sessionDraft(form, memberIds);
    if (!draft) {
      api.error = $t('training_sessions.errors.invalid_form');
      return;
    }

    const result = await api.save(organizationId, draft, editingId || undefined);
    if (result) {
      editing = false;
      saved = JSON.stringify({ form, memberIds });
    }
  }

  async function confirmAction() {
    if (!pendingAction || !api.selected) return;

    const result = await api.status(organizationId, api.selected.session.id, pendingAction);
    if (result) pendingAction = null;
  }

  async function token(issue: boolean) {
    if (!api.selected) return;

    qrImage = '';
    checkinLink = '';
    if (issue && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {
      api.error = $t('training_sessions.errors.localhost');
      return;
    }

    const result = await api.issueToken(organizationId, api.selected.session.id, issue);
    if (result?.token) {
      const url = new URL(`/lms/sessions/${api.selected.session.id}`, window.location.origin);
      url.searchParams.set('organizationId', organizationId);
      url.searchParams.set('token', result.token);
      checkinLink = url.toString();
      const { default: QRCode } = await import('qrcode');
      qrImage = await QRCode.toDataURL(checkinLink, { width: 280, margin: 2 });
    }
  }

  async function correct() {
    if (!api.selected || correctionMember === null || !correctionReason.trim()) return;

    const result = await api.correct(organizationId, api.selected.session.id, {
      memberId: correctionMember,
      action: correctionAction,
      reason: correctionReason.trim()
    });
    if (result) {
      correctionMember = null;
      correctionReason = '';
    }
  }
</script>

<UnsavedChanges when={hasChanges} />
<Page.Root class="mx-auto max-w-6xl px-4 sm:px-6">
  <Page.Header>
    <Page.HeaderContent
      ><Page.Title>{$t('training_sessions.title')}</Page.Title><Page.Subtitle
        >{$t('training_sessions.description')}</Page.Subtitle
      ></Page.HeaderContent
    >
    {#if canManage}<Button disabled={api.busy || hasChanges} onclick={() => openEditor(true)}
        >{$t('training_sessions.create')}</Button
      >{/if}
  </Page.Header>
  <Page.Body>
    {#snippet child()}
      {#if api.error}<p role="alert" class="rounded-lg border border-red-300 p-3 text-red-700">{api.error}</p>{/if}
      {#if api.loading}<p role="status">{$t('training_sessions.loading')}</p>{/if}
      <div class="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <section class="space-y-3">
          <Button variant="outline" disabled={api.loading || api.busy || hasChanges} onclick={load}
            >{$t('training_sessions.refresh')}</Button
          >
          {#if !api.loading && !api.sessions.length}<p class="ui:text-muted-foreground">
              {$t('training_sessions.empty')}
            </p>{/if}
          {#each api.sessions as session (session.id)}
            <Button
              variant={api.selected?.session.id === session.id ? 'secondary' : 'outline'}
              class="h-auto w-full justify-start p-3 text-left whitespace-normal"
              disabled={hasChanges || api.busy}
              onclick={() => select(session.id)}
            >
              <span
                ><span class="block font-semibold">{session.title}</span><span class="block text-sm"
                  >{$t(`training_sessions.status.${session.status}`)} · {new Date(
                    session.startAt
                  ).toLocaleString()}</span
                ></span
              >
            </Button>
          {/each}
        </section>
        <section class="min-w-0 space-y-5">
          {#if editing}
            <Field.Group>
              <Field.Set
                ><Field.Legend>{$t('training_sessions.basics')}</Field.Legend><Field.Group>
                  <InputField
                    name="training-session-title"
                    label={$t('training_sessions.session_title')}
                    bind:value={form.title}
                  />
                  <InputField
                    name="training-session-location"
                    label={$t('training_sessions.location')}
                    bind:value={form.location}
                  />
                  <TextareaField
                    name="training-session-instructor"
                    id="training-session-instructor"
                    aria-label={$t('training_sessions.instructor')}
                    label={$t('training_sessions.instructor')}
                    bind:value={form.instructor}
                  />
                  <Field.Field
                    ><Field.Label>{$t('training_sessions.course')}</Field.Label><Select.Root
                      type="single"
                      bind:value={form.courseId}
                      ><Select.Trigger aria-label={$t('training_sessions.course')}
                        >{$t('training_sessions.course')} · {courses.find((row) => row.id === form.courseId)?.title ??
                          $t('training_sessions.none')}</Select.Trigger
                      ><Select.Content
                        ><Select.Item value="">{$t('training_sessions.none')}</Select.Item
                        >{#each courses as course (course.id)}<Select.Item value={course.id}>{course.title}</Select.Item
                          >{/each}</Select.Content
                      ></Select.Root
                    ></Field.Field
                  >
                  <Field.Field
                    ><Field.Label>{$t('training_sessions.plan')}</Field.Label><Select.Root
                      type="single"
                      bind:value={form.planId}
                      ><Select.Trigger aria-label={$t('training_sessions.plan')}
                        >{$t('training_sessions.plan')} · {plans.find((row) => row.id === form.planId)?.name ??
                          $t('training_sessions.none')}</Select.Trigger
                      ><Select.Content
                        ><Select.Item value="">{$t('training_sessions.none')}</Select.Item
                        >{#each plans as plan (plan.id)}<Select.Item value={plan.id}>{plan.name}</Select.Item
                          >{/each}</Select.Content
                      ></Select.Root
                    ></Field.Field
                  >
                </Field.Group></Field.Set
              >
              <Field.Separator />
              <Field.Set
                ><Field.Legend>{$t('training_sessions.window')}</Field.Legend><Field.Group
                  class="grid gap-4 sm:grid-cols-2"
                >
                  <InputField
                    name="training-session-starts-at"
                    type="datetime-local"
                    label={$t('training_sessions.start')}
                    bind:value={form.startAt}
                  />
                  <InputField
                    name="training-session-ends-at"
                    type="datetime-local"
                    label={$t('training_sessions.end')}
                    bind:value={form.endAt}
                  />
                  <InputField
                    name="training-session-checkin-opens-at"
                    type="datetime-local"
                    label={$t('training_sessions.opens')}
                    bind:value={form.checkinOpensAt}
                  />
                  <InputField
                    name="training-session-checkin-closes-at"
                    type="datetime-local"
                    label={$t('training_sessions.closes')}
                    bind:value={form.checkinClosesAt}
                  />
                </Field.Group></Field.Set
              >
              <Field.Separator />
              <Field.Set
                ><Field.Legend>{$t('training_sessions.audience')}</Field.Legend><Field.Description
                  >{$t('training_sessions.audience_help')}</Field.Description
                ><Field.Group>
                  <div class="flex flex-wrap gap-3">
                    {#each departments as department (department.id)}<CheckboxField
                        name={`training-session-department-${department.id}`}
                        label={department.name}
                        checked={departmentIds.includes(department.id)}
                        onclick={() => {
                          departmentIds = departmentIds.includes(department.id)
                            ? departmentIds.filter((value) => value !== department.id)
                            : [...departmentIds, department.id];
                          api.preview = null;
                        }}
                      />{/each}
                  </div>
                  <Button variant="secondary" disabled={api.busy} onclick={previewDepartments}
                    >{$t('training_sessions.preview')}</Button
                  >
                  <InputField
                    name="training-session-candidate-search"
                    type="search"
                    label={$t('training_sessions.search')}
                    bind:value={employeeSearch}
                  />
                  <p>{$t('training_sessions.selected_count', { count: memberIds.length })}</p>
                  <div class="grid max-h-80 gap-3 overflow-y-auto sm:grid-cols-2">
                    {#each api.candidates.filter( (member) => [member.fullname, member.employeeNo, member.email, member.departmentName].some( (value) => value
                              ?.toLocaleLowerCase()
                              .includes(employeeSearch.toLocaleLowerCase()) ) ) as member (member.memberId)}<CheckboxField
                        name={`training-session-member-${member.memberId}`}
                        label={`${member.fullname ?? member.email ?? member.memberId} · ${member.departmentName ?? '—'}`}
                        checked={memberIds.includes(member.memberId)}
                        onclick={() => toggleMember(member.memberId)}
                      />{/each}
                  </div>
                  {#if api.preview}<div class="rounded-lg border p-3">
                      <p class="font-semibold">{$t('training_sessions.preview_count', { count: api.preview.count })}</p>
                      <ul class="max-h-48 overflow-auto">
                        {#each api.preview.members as member (member.memberId)}<li>
                            {member.fullname ?? member.email ?? member.memberId} · {member.departmentName ?? '—'}
                          </li>{/each}
                      </ul>
                    </div>{/if}
                </Field.Group></Field.Set
              >
            </Field.Group>
          {:else if api.selected}
            {@const detail = api.selected}
            <div class="rounded-lg border p-4">
              <h2 class="text-xl font-semibold">{detail.session.title}</h2>
              <p>{detail.session.location}</p>
              <p class="whitespace-pre-wrap">{detail.session.instructor}</p>
              <p>
                {$t(`training_sessions.status.${detail.session.status}`)} · {new Date(
                  detail.session.startAt
                ).toLocaleString()} — {new Date(detail.session.endAt).toLocaleString()}
              </p>
              <p>
                {$t('training_sessions.window')}: {new Date(detail.session.checkinOpensAt).toLocaleString()} — {new Date(
                  detail.session.checkinClosesAt
                ).toLocaleString()}
              </p>
            </div>
            {#if detail.canManage}<div class="flex flex-wrap gap-2">
                {#if detail.session.status === 'DRAFT'}<Button
                    variant="secondary"
                    disabled={api.busy}
                    onclick={() => openEditor()}>{$t('training_sessions.edit')}</Button
                  ><Button disabled={api.busy} onclick={() => (pendingAction = 'PUBLISH')}
                    >{$t('training_sessions.publish')}</Button
                  >{/if}
                {#if detail.session.status === 'PUBLISHED'}<Button
                    variant="secondary"
                    disabled={api.busy}
                    onclick={() => token(true)}>{$t('training_sessions.rotate')}</Button
                  ><Button variant="outline" disabled={api.busy} onclick={() => token(false)}
                    >{$t('training_sessions.revoke_code')}</Button
                  ><Button variant="outline" disabled={api.busy} onclick={() => (pendingAction = 'CLOSE')}
                    >{$t('training_sessions.close')}</Button
                  >{/if}
              </div>{/if}
            {#if qrImage}<div class="rounded-lg border p-4">
                <img src={qrImage} alt={$t('training_sessions.qr_alt')} width="280" height="280" />
                <p class="break-all">{checkinLink}</p>
                <p>{$t('training_sessions.qr_help')}</p>
                <p>
                  {$t('training_sessions.closes')}: {api.token?.expiresAt
                    ? new Date(api.token.expiresAt).toLocaleString()
                    : '—'}
                </p>
              </div>{/if}
            <p class="ui:bg-muted rounded-lg p-4">
              {$t('training_sessions.summary', {
                expected: detail.summary.expected,
                present: detail.summary.present,
                leave: detail.summary.leave,
                pending: detail.summary.pending,
                absent: detail.summary.absent
              })}<br />{$t('training_sessions.denominator')}
            </p>
            <div class="flex flex-wrap items-end gap-3">
              <InputField
                name="training-session-attendance-search"
                type="search"
                label={$t('training_sessions.search')}
                bind:value={api.filter.search}
              /><Field.Field
                ><Field.Label>{$t('training_sessions.attendance_status')}</Field.Label><Select.Root
                  type="single"
                  bind:value={api.filter.status}
                  ><Select.Trigger aria-label={$t('training_sessions.attendance_status')}
                    >{$t(`training_sessions.attendance.${api.filter.status}`)}</Select.Trigger
                  ><Select.Content
                    >{#each ['ALL', 'PENDING', 'PRESENT', 'LATE', 'LEAVE', 'ABSENT'] as status}<Select.Item
                        value={status}>{$t(`training_sessions.attendance.${status}`)}</Select.Item
                      >{/each}</Select.Content
                  ></Select.Root
                ></Field.Field
              ><Button
                variant="secondary"
                disabled={api.busy}
                onclick={() => api.select(organizationId, detail.session.id)}>{$t('training_sessions.filter')}</Button
              ><Button
                variant="outline"
                disabled={api.busy}
                onclick={() => api.export(organizationId, detail.session.id)}>{$t('training_sessions.export')}</Button
              >
            </div>
            <div class="overflow-auto">
              <table class="w-full text-left text-sm">
                <thead
                  ><tr
                    ><th class="p-3">{$t('training_sessions.employee')}</th><th class="p-3"
                      >{$t('training_sessions.department')}</th
                    ><th class="p-3">{$t('training_sessions.attendance_status')}</th><th class="p-3"
                      >{$t('training_sessions.time')}</th
                    >{#if detail.canManage}<th class="p-3">{$t('training_sessions.correction')}</th>{/if}</tr
                  ></thead
                ><tbody
                  >{#each detail.attendees as row (row.attendance.id)}<tr class="border-t"
                      ><td class="p-3"
                        >{row.fullname ?? row.email ?? row.attendance.memberId}<span
                          class="ui:text-muted-foreground block">{row.employeeNo}</span
                        ></td
                      ><td class="p-3">{row.departmentName ?? '—'}</td><td class="p-3"
                        >{$t(`training_sessions.attendance.${row.displayStatus}`)}</td
                      ><td class="p-3"
                        >{row.attendance.checkedInAt ? new Date(row.attendance.checkedInAt).toLocaleString() : '—'}</td
                      >{#if detail.canManage}<td class="p-3"
                          ><Button
                            size="sm"
                            variant="secondary"
                            disabled={api.busy || detail.session.status === 'DRAFT'}
                            onclick={() => {
                              correctionMember = row.attendance.memberId;
                              correctionAction = 'PRESENT';
                              correctionReason = '';
                            }}>{$t('training_sessions.correction')}</Button
                          ></td
                        >{/if}</tr
                    >{/each}</tbody
                >
              </table>
            </div>
            {#if !detail.attendees.length}<p>{$t('training_sessions.no_results')}</p>{/if}
            <p class="ui:text-muted-foreground text-sm">
              {$t('training_sessions.as_of')}: {new Date(detail.asOf).toLocaleString()}
            </p>
            <section class="space-y-2">
              <h3 class="font-semibold">{$t('training_sessions.audit')}</h3>
              {#each detail.audit as entry (entry.id)}<p class="text-sm">
                  {new Date(entry.createdAt).toLocaleString()} · {$t(`training_sessions.actions.${entry.action}`)} · {entry.targetMemberId ??
                    '—'} · {entry.reason ?? '—'}
                </p>{/each}
            </section>
          {:else}<p class="ui:text-muted-foreground">{$t('training_sessions.select')}</p>{/if}
        </section>
      </div>
    {/snippet}
  </Page.Body>
  <Page.SettingsActions
    {hasChanges}
    loading={api.busy}
    statusLabel={$t('common.unsaved_changes.label')}
    discardLabel={$t('common.discard')}
    saveLabel={$t('training_sessions.save')}
    onSave={save}
    onDiscard={() => {
      editing = false;
    }}
  />
</Page.Root>

<Dialog.Root
  open={pendingAction !== null}
  onOpenChange={(open) => {
    if (!open) pendingAction = null;
  }}
  ><Dialog.Content escapeKeydownBehavior="ignore" interactOutsideBehavior="ignore"
    ><Dialog.Header
      ><Dialog.Title
        >{$t(pendingAction === 'PUBLISH' ? 'training_sessions.publish' : 'training_sessions.close')}</Dialog.Title
      ><Dialog.Description
        >{$t(
          pendingAction === 'PUBLISH' ? 'training_sessions.publish_help' : 'training_sessions.close_help'
        )}</Dialog.Description
      ></Dialog.Header
    >
    <p>
      {api.selected?.session.title} · {$t('training_sessions.selected_count', {
        count: api.selected?.summary.expected ?? 0
      })}
    </p>
    {#if api.error}<p role="alert">{api.error}</p>{/if}<Dialog.Footer
      ><Button size="sm" variant="outline" disabled={api.busy} onclick={() => (pendingAction = null)}
        >{$t('app.cancel')}</Button
      ><Button size="sm" disabled={api.busy} onclick={confirmAction}>{$t('training_sessions.confirm')}</Button
      ></Dialog.Footer
    ></Dialog.Content
  ></Dialog.Root
>
<Dialog.Root
  open={correctionMember !== null}
  onOpenChange={(open) => {
    if (!open) correctionMember = null;
  }}
  ><Dialog.Content escapeKeydownBehavior="ignore" interactOutsideBehavior="ignore"
    ><Dialog.Header
      ><Dialog.Title>{$t('training_sessions.correction')}</Dialog.Title><Dialog.Description
        >{$t('training_sessions.correction_help')}</Dialog.Description
      ></Dialog.Header
    ><Field.Field
      ><Field.Label>{$t('training_sessions.correction')}</Field.Label><Select.Root
        type="single"
        bind:value={correctionAction}
        ><Select.Trigger aria-label={$t('training_sessions.correction')}
          >{$t(`training_sessions.correction_actions.${correctionAction}`)}</Select.Trigger
        ><Select.Content
          >{#each ['PRESENT', 'LEAVE', 'REVOKE'] as action}<Select.Item value={action}
              >{$t(`training_sessions.correction_actions.${action}`)}</Select.Item
            >{/each}</Select.Content
        ></Select.Root
      ></Field.Field
    ><TextareaField
      name="training-session-correction-reason"
      id="training-session-correction-reason"
      aria-label={$t('training_sessions.reason')}
      label={$t('training_sessions.reason')}
      bind:value={correctionReason}
    />{#if api.error}<p role="alert">
        {api.error}
      </p>{/if}<Dialog.Footer
      ><Button size="sm" variant="outline" disabled={api.busy} onclick={() => (correctionMember = null)}
        >{$t('app.cancel')}</Button
      ><Button size="sm" disabled={api.busy || !correctionReason.trim()} onclick={correct}
        >{$t('training_sessions.confirm')}</Button
      ></Dialog.Footer
    ></Dialog.Content
  ></Dialog.Root
>
