<script lang="ts">
  import { untrack } from 'svelte';
  import { currentOrg } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import { t } from '$lib/utils/functions/translations';
  import { UnsavedChanges } from '$features/ui';
  import { SurveyApi } from '$lib/features/survey/api/survey.svelte';
  import SurveySelect from '$lib/features/survey/components/survey-select.svelte';
  import { surveyAnswerLabel } from '$lib/features/survey/utils/survey-utils';
  import type { SurveyQuestionDraft, SurveyTemplateDraft, SurveyTaskDraft } from '$lib/features/survey/utils/types';
  import { Button } from '@cio/ui/base/button';
  import { InputField } from '@cio/ui/custom/input-field';
  import { TextareaField } from '@cio/ui/custom/textarea-field';
  import { CheckboxField } from '@cio/ui/custom/checkbox-field';
  import { ScrollToTop } from '@cio/ui/custom/scroll-to-top';
  import * as Field from '@cio/ui/base/field';
  import * as Page from '@cio/ui/base/page';

  const api = new SurveyApi();
  let loadedContext = '';
  let templateId = $state('');
  let templateDraft = $state<SurveyTemplateDraft>({ title: '', description: '', questions: [] });
  let templateFingerprint = $state('');
  let section = $state('templates');
  let taskTitle = $state('');
  let taskTemplate = $state('');
  let taskPurpose = $state('NEEDS');
  let taskCourse = $state('');
  let anonymous = $state(false);
  let audience = $state('TARGETED');
  let startsAt = $state('');
  let endsAt = $state('');
  let memberIds = $state<number[]>([]);
  let departmentIds = $state<string[]>([]);
  let recipientSearch = $state('');
  let taskSearch = $state('');
  let taskStatus = $state('ALL');
  let qrImage = $state('');
  let shareLink = $state('');
  const hasChanges = $derived(
    !!api.administration?.canManage && section === 'templates' && JSON.stringify(templateDraft) !== templateFingerprint
  );
  const taskList = $derived(
    (api.administration?.tasks ?? []).filter(
      (task) =>
        task.title.toLowerCase().includes(taskSearch.toLowerCase()) &&
        (taskStatus === 'ALL' || task.status === taskStatus)
    )
  );

  function resetTemplate() {
    templateId = '';
    templateDraft.title = '';
    templateDraft.description = '';
    templateDraft.questions = [];
    templateFingerprint = JSON.stringify(templateDraft);
  }

  $effect(() => {
    const context = `${$currentOrg.id}:${$profile.id}`;
    if (loadedContext === context) return;

    loadedContext = context;
    untrack(() => {
      resetTemplate();
      taskTitle = '';
      taskTemplate = '';
      taskPurpose = 'NEEDS';
      taskCourse = '';
      startsAt = '';
      endsAt = '';
      anonymous = false;
      audience = 'TARGETED';
      memberIds = [];
      departmentIds = [];
      recipientSearch = '';
      taskSearch = '';
      taskStatus = 'ALL';
      qrImage = '';
      shareLink = '';
      if ($currentOrg.id && $profile.id) void api.load($currentOrg.id, $profile.id, true);
      else api.clear();
    });
  });

  function newQuestion() {
    const question: SurveyQuestionDraft = {
      id: crypto.randomUUID(),
      title: '',
      type: 'TEXT',
      required: true,
      options: [],
      ratingMax: 5
    };
    templateDraft.questions.push(question);
  }

  function chooseTemplate(id: string, copy = false) {
    const template = api.templates?.templates.find((template) => template.id === id);
    if (!template) return;

    templateId = copy || template.status === 'PUBLISHED' ? '' : template.id;
    templateDraft.title = template.title;
    templateDraft.description = template.description;
    templateDraft.questions = structuredClone(template.questions);
    templateFingerprint = copy || template.status === 'PUBLISHED' ? '' : JSON.stringify(templateDraft);
    section = 'templates';
  }

  async function saveTemplate() {
    const saved = await api.saveTemplate($currentOrg.id, templateDraft, templateId || undefined);
    if (!saved) return;

    templateId = saved.id;
    templateFingerprint = JSON.stringify(templateDraft);
    await api.load($currentOrg.id, $profile.id, true);
  }

  async function publishTemplate() {
    if (!templateId || hasChanges) return;

    const published = await api.publishTemplate($currentOrg.id, templateId);
    if (published) {
      resetTemplate();
      await api.load($currentOrg.id, $profile.id, true);
    }
  }

  function toggleMember(id: number) {
    memberIds = memberIds.includes(id) ? memberIds.filter((memberId) => memberId !== id) : [...memberIds, id];
  }
  function toggleDepartment(id: string) {
    departmentIds = departmentIds.includes(id)
      ? departmentIds.filter((departmentId) => departmentId !== id)
      : [...departmentIds, id];
  }

  async function createTask() {
    if (!startsAt || !endsAt) {
      api.error = $t('survey.invalid_task');
      return;
    }

    const opensAt = new Date(startsAt).toISOString();
    const closesAt = new Date(endsAt).toISOString();
    const draft: SurveyTaskDraft = {
      title: taskTitle,
      templateId: taskTemplate,
      purpose: taskPurpose as SurveyTaskDraft['purpose'],
      courseId: taskPurpose === 'COURSE_EVALUATION' ? taskCourse || null : null,
      anonymous,
      audience: audience as SurveyTaskDraft['audience'],
      startsAt: opensAt,
      endsAt: closesAt,
      memberIds: audience === 'TARGETED' ? memberIds : [],
      departmentIds: audience === 'TARGETED' ? departmentIds : []
    };
    const task = await api.createTask($currentOrg.id, draft);
    if (!task) return;

    await api.load($currentOrg.id, $profile.id, true);
    await openTask(task.id);
  }

  async function openTask(id: string) {
    qrImage = '';
    shareLink = '';
    await api.openTask($currentOrg.id, id, api.administration?.canManage ?? false);
    section = 'tasks';
    if (!api.detail || api.detail.task.status === 'DRAFT') return;

    const context = loadedContext;
    const link = `${window.location.origin}/lms/surveys/${id}?organizationId=${encodeURIComponent($currentOrg.id)}`;
    try {
      const QRCode = await import('qrcode');
      const image = await QRCode.toDataURL(link, { width: 256, margin: 2 });
      if (context !== loadedContext || api.detail?.task.id !== id) return;

      shareLink = link;
      qrImage = image;
    } catch {
      if (context === loadedContext) api.error = $t('survey.request_failed');
    }
  }

  async function changeTask(action: 'publish' | 'close') {
    if (!api.detail) return;

    const id = api.detail.task.id;
    const changed = await api.changeTask($currentOrg.id, id, action);
    if (changed) {
      await api.load($currentOrg.id, $profile.id, true);
      await openTask(id);
    }
  }
</script>

<svelte:head><title>{$t('survey.admin_title')}</title></svelte:head>
<UnsavedChanges hasUnsavedChanges={hasChanges} />
<Page.Root class="mx-auto max-w-6xl px-4 sm:px-6">
  <Page.Header
    ><Page.HeaderContent
      ><Page.Title>{$t('survey.admin_title')}</Page.Title><Page.Subtitle>{$t('survey.admin_subtitle')}</Page.Subtitle
      ></Page.HeaderContent
    ></Page.Header
  >
  <Page.Body>
    {#snippet child()}
      {#if api.error}<p role="alert" class="rounded-md bg-red-50 p-3 text-red-700">{api.error}</p>{/if}
      {#if api.loading}<p role="status">{$t('survey.loading')}</p>{/if}
      <div class="flex flex-wrap gap-2 py-4">
        {#if api.administration?.canManage}<Button
            variant={section === 'templates' ? 'default' : 'secondary'}
            onclick={() => (section = 'templates')}>{$t('survey.templates')}</Button
          ><Button variant={section === 'new-task' ? 'default' : 'secondary'} onclick={() => (section = 'new-task')}
            >{$t('survey.new_task')}</Button
          >{/if}
        <Button variant={section === 'tasks' ? 'default' : 'secondary'} onclick={() => (section = 'tasks')}
          >{$t('survey.tasks')}</Button
        >
        <Button
          variant="outline"
          disabled={api.loading || api.busy}
          onclick={() => api.load($currentOrg.id, $profile.id, true)}>{$t('survey.refresh')}</Button
        >
      </div>
      {#if section === 'templates' && api.administration?.canManage}
        <div class="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div class="space-y-3">
            <Button variant="secondary" onclick={resetTemplate}>{$t('survey.new_template')}</Button>
            {#each api.templates?.templates ?? [] as template}<div
                class="ui:border-border space-y-2 rounded-lg border p-3"
              >
                <p class="font-semibold">{template.title}</p>
                <p class="ui:text-muted-foreground text-sm">
                  {$t(`survey.status_${template.status.toLowerCase()}`)} · {template.version}
                </p>
                <div class="flex gap-2">
                  <Button size="sm" variant="outline" disabled={api.busy} onclick={() => chooseTemplate(template.id)}
                    >{$t(template.status === 'DRAFT' ? 'survey.edit' : 'survey.copy')}</Button
                  >{#if template.status === 'DRAFT'}<Button
                      size="sm"
                      variant="secondary"
                      onclick={() => chooseTemplate(template.id, true)}>{$t('survey.copy')}</Button
                    >{/if}
                </div>
              </div>{/each}
          </div>
          <Field.Group>
            <Field.Set
              ><Field.Legend>{$t('survey.template_content')}</Field.Legend><Field.Description
                >{$t('survey.template_immutable')}</Field.Description
              ><Field.Group>
                <InputField
                  name="survey-template-title"
                  label={$t('survey.title')}
                  bind:value={templateDraft.title}
                  isDisabled={api.busy}
                />
                <TextareaField
                  name="survey-template-description"
                  id="survey-template-description"
                  aria-label={$t('survey.description')}
                  label={$t('survey.description')}
                  bind:value={templateDraft.description}
                  disabled={api.busy}
                />
              </Field.Group></Field.Set
            >
            <Field.Separator />
            <Field.Set
              ><Field.Legend>{$t('survey.questions')}</Field.Legend><Field.Group>
                {#each templateDraft.questions as question, questionIndex (question.id)}
                  <div class="ui:border-border space-y-4 rounded-xl border p-4">
                    <InputField
                      name={`survey-question-${question.id}-title`}
                      label={`${questionIndex + 1}. ${$t('survey.question_title')}`}
                      bind:value={question.title}
                      isDisabled={api.busy}
                    />
                    <SurveySelect
                      label={$t('survey.question_type')}
                      bind:value={question.type}
                      disabled={api.busy}
                      options={['SINGLE', 'MULTIPLE', 'RATING', 'TEXT'].map((value) => ({
                        value,
                        label: $t(`survey.type_${value.toLowerCase()}`)
                      }))}
                    />
                    <CheckboxField
                      name={`survey-question-${question.id}-required`}
                      label={$t('survey.required')}
                      bind:checked={question.required}
                      disabled={api.busy}
                    />
                    {#if question.type === 'RATING'}<InputField
                        name={`survey-question-${question.id}-rating-max`}
                        type="number"
                        label={$t('survey.rating_max')}
                        bind:value={question.ratingMax}
                        min={2}
                        max={10}
                        isDisabled={api.busy}
                      />{/if}
                    {#if question.type === 'SINGLE' || question.type === 'MULTIPLE'}
                      {#each question.options as option, optionIndex (option.id)}<div class="flex items-end gap-2">
                          <div class="min-w-0 flex-1">
                            <InputField
                              name={`survey-question-${question.id}-option-${option.id}`}
                              label={`${$t('survey.option')} ${optionIndex + 1}`}
                              bind:value={option.label}
                              isDisabled={api.busy}
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={api.busy}
                            onclick={() =>
                              (question.options = question.options.filter((item) => item.id !== option.id))}
                            >{$t('survey.remove')}</Button
                          >
                        </div>{/each}
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={api.busy}
                        onclick={() => question.options.push({ id: crypto.randomUUID(), label: '' })}
                        >{$t('survey.add_option')}</Button
                      >
                    {/if}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={api.busy}
                      onclick={() =>
                        (templateDraft.questions = templateDraft.questions.filter((item) => item.id !== question.id))}
                      >{$t('survey.remove_question')}</Button
                    >
                  </div>
                {/each}
                <div class="flex gap-2">
                  <Button variant="secondary" disabled={api.busy} onclick={newQuestion}
                    >{$t('survey.add_question')}</Button
                  ><Button disabled={api.busy || !templateId || hasChanges} onclick={publishTemplate}
                    >{$t('survey.publish_template')}</Button
                  >
                </div>
              </Field.Group></Field.Set
            >
          </Field.Group>
        </div>
      {:else if section === 'new-task' && api.administration?.canManage}
        <div class="mx-auto max-w-3xl space-y-6">
          <Field.Group>
            <Field.Set
              ><Field.Legend>{$t('survey.task_settings')}</Field.Legend><Field.Group>
                <InputField
                  name="survey-task-title"
                  label={$t('survey.title')}
                  bind:value={taskTitle}
                  isDisabled={api.busy}
                />
                <SurveySelect
                  label={$t('survey.template')}
                  bind:value={taskTemplate}
                  options={(api.templates?.templates ?? [])
                    .filter((template) => template.status === 'PUBLISHED')
                    .map((template) => ({ value: template.id, label: template.title }))}
                  disabled={api.busy}
                />
                <SurveySelect
                  label={$t('survey.purpose')}
                  bind:value={taskPurpose}
                  options={['NEEDS', 'COURSE_EVALUATION'].map((value) => ({
                    value,
                    label: $t(`survey.purpose_${value.toLowerCase()}`)
                  }))}
                  disabled={api.busy}
                />
                {#if taskPurpose === 'COURSE_EVALUATION'}<SurveySelect
                    label={$t('survey.course')}
                    bind:value={taskCourse}
                    options={(api.templates?.courses ?? []).map((course) => ({
                      value: course.id,
                      label: course.title
                    }))}
                    disabled={api.busy}
                  />{/if}
                <div class="grid gap-4 sm:grid-cols-2">
                  <InputField
                    name="survey-task-starts-at"
                    type="datetime-local"
                    label={$t('survey.starts_at')}
                    bind:value={startsAt}
                    isDisabled={api.busy}
                  /><InputField
                    name="survey-task-ends-at"
                    type="datetime-local"
                    label={$t('survey.ends_at')}
                    bind:value={endsAt}
                    isDisabled={api.busy}
                  />
                </div>
                <CheckboxField
                  name="survey-task-anonymous"
                  label={$t('survey.anonymous')}
                  bind:checked={anonymous}
                  disabled={api.busy}
                /><Field.Description>{$t('survey.anonymous_policy')}</Field.Description>
              </Field.Group></Field.Set
            ><Field.Separator />
            <Field.Set
              ><Field.Legend>{$t('survey.recipients')}</Field.Legend><Field.Description
                >{$t('survey.snapshot_policy')}</Field.Description
              ><Field.Group>
                <SurveySelect
                  label={$t('survey.audience')}
                  bind:value={audience}
                  options={['TARGETED', 'ORGANIZATION'].map((value) => ({
                    value,
                    label: $t(`survey.audience_${value.toLowerCase()}`)
                  }))}
                  disabled={api.busy}
                />
                {#if audience === 'TARGETED'}
                  <div class="grid gap-4 sm:grid-cols-2">
                    <div class="space-y-1">
                      <p class="font-medium">{$t('survey.departments')}</p>
                      {#each api.templates?.departments ?? [] as department}<CheckboxField
                          name={`survey-recipient-department-${department.id}`}
                          label={department.name}
                          checked={departmentIds.includes(department.id)}
                          disabled={api.busy}
                          onclick={() => toggleDepartment(department.id)}
                        />{/each}
                    </div>
                    <div class="space-y-2">
                      <InputField
                        name="survey-recipient-search"
                        type="search"
                        label={$t('survey.search_recipients')}
                        bind:value={recipientSearch}
                      />
                      <div class="max-h-80 overflow-y-auto">
                        {#each (api.templates?.members ?? []).filter( (member) => `${member.fullname ?? ''} ${member.employeeNo ?? ''} ${member.position ?? ''}`
                              .toLowerCase()
                              .includes(recipientSearch.toLowerCase()) ) as member}<CheckboxField
                            name={`survey-recipient-member-${member.id}`}
                            label={`${member.fullname ?? member.employeeNo ?? member.id}${member.employeeNo ? ` (${member.employeeNo})` : ''}`}
                            checked={memberIds.includes(member.id)}
                            disabled={api.busy}
                            onclick={() => toggleMember(member.id)}
                          />{/each}
                      </div>
                    </div>
                  </div>
                {:else}<Field.Description>{$t('survey.no_denominator')}</Field.Description>{/if}
              </Field.Group></Field.Set
            >
          </Field.Group><Button disabled={api.busy} onclick={createTask}>{$t('survey.create_draft')}</Button>
        </div>
      {:else if section === 'tasks'}
        <div class="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <div class="space-y-3">
            <InputField
              name="survey-task-search"
              type="search"
              label={$t('survey.search_tasks')}
              bind:value={taskSearch}
            /><SurveySelect
              label={$t('survey.status')}
              bind:value={taskStatus}
              options={['ALL', 'DRAFT', 'PUBLISHED', 'CLOSED'].map((value) => ({
                value,
                label: $t(`survey.status_${value.toLowerCase()}`)
              }))}
            />
            {#each taskList as task}<Button
                class="h-auto w-full justify-start py-3 text-left whitespace-normal"
                variant="secondary"
                disabled={api.busy}
                onclick={() => openTask(task.id)}
                >{task.title} · {$t(`survey.status_${task.status.toLowerCase()}`)}</Button
              >{:else}<p>{$t('survey.empty')}</p>{/each}
          </div>
          <div class="space-y-5">
            {#if api.report}
              <h2 class="text-xl font-semibold">{api.report.task.title}</h2>
              <p class="ui:text-muted-foreground">
                {$t(`survey.purpose_${api.report.task.purpose.toLowerCase()}`)} · {$t(
                  api.report.task.anonymous ? 'survey.anonymous' : 'survey.named'
                )}
              </p>
              <p>
                {new Date(api.report.task.startsAt).toLocaleString()} — {new Date(
                  api.report.task.endsAt
                ).toLocaleString()}
              </p>
              {#if api.detail?.task.status === 'DRAFT'}<p>
                  {$t('survey.preview_recipients')}: {api.detail.recipients.length}
                </p>
                <div class="max-h-52 overflow-y-auto rounded-lg border p-3">
                  {#each api.detail.recipients as recipient}<p class="text-sm">
                      {recipient.fullname ??
                        recipient.employeeNo ??
                        ('memberId' in recipient ? recipient.memberId : recipient.id)}
                    </p>{/each}
                </div>
                <Button disabled={api.busy} onclick={() => changeTask('publish')}>{$t('survey.confirm_publish')}</Button
                >
              {:else}
                {#if api.detail?.task.status === 'PUBLISHED'}<Button
                    variant="outline"
                    disabled={api.busy}
                    onclick={() => changeTask('close')}>{$t('survey.close_task')}</Button
                  >{/if}
                {#if qrImage}<div class="space-y-2 rounded-lg border p-4">
                    <img src={qrImage} width="256" height="256" alt={$t('survey.qr_alt')} /><InputField
                      name="survey-share-link"
                      label={$t('survey.share_link')}
                      value={shareLink}
                      isDisabled
                    />
                    <a
                      class="ui:text-primary block text-sm break-all underline"
                      href={shareLink}
                      target="_blank"
                      rel="noreferrer">{$t('survey.fill')}</a
                    >
                    <p class="ui:text-muted-foreground text-sm">{$t('survey.link_policy')}</p>
                  </div>{/if}
                <div class="ui:bg-muted rounded-lg p-4">
                  <p>{$t('survey.submitted')}: {api.report.recovery.submitted}</p>
                  {#if api.report.recovery.invited !== null}<p>{$t('survey.invited')}: {api.report.recovery.invited}</p>
                    <p>
                      {$t('survey.recovery')}: {api.report.recovery.rate === null
                        ? '—'
                        : `${(api.report.recovery.rate * 100).toFixed(1)}%`}
                    </p>{:else}<p>{$t('survey.no_denominator')}</p>{/if}
                  <p class="text-sm">{$t('survey.observed_at')}: {new Date(api.report.observedAt).toLocaleString()}</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={api.busy}
                    onclick={() => api.download($currentOrg.id, api.report!.task.id, 'participation')}
                    >{$t('survey.export_participation')}</Button
                  ><Button
                    variant="secondary"
                    disabled={api.busy || !api.report.answersVisible}
                    onclick={() => api.download($currentOrg.id, api.report!.task.id, 'answers')}
                    >{$t('survey.export_answers')}</Button
                  >
                </div>
                <h3 class="font-semibold">{$t('survey.not_submitted')}</h3>
                <div class="max-h-64 overflow-y-auto rounded-lg border p-3">
                  {#each api.report.participants.filter((participant) => !participant.submitted) as participant}<p>
                      {participant.fullname ?? participant.email ?? participant.employeeNo}
                    </p>{:else}<p>{$t('survey.empty')}</p>{/each}
                </div>
                {#if !api.report.answersVisible}<p class="ui:bg-muted rounded-lg p-4">
                    {$t('survey.anonymous_policy')}
                  </p>{/if}
                {#each api.report.summary as item}<section class="space-y-2 rounded-lg border p-4">
                    <h3 class="font-semibold">{item.question.title}</h3>
                    <p>{$t('survey.valid_answers')}: {item.validAnswers}</p>
                    {#each item.options as option}<p>
                        {option.label}: {option.count} ({option.rate === null
                          ? '—'
                          : `${(option.rate * 100).toFixed(1)}%`})
                      </p>{/each}{#if item.question.type === 'MULTIPLE'}<p class="text-sm">
                        {$t('survey.multiple_policy')}
                      </p>{/if}{#if item.question.type === 'RATING'}<p>
                        {$t('survey.average')}: {item.average?.toFixed(2) ?? '—'} (1–{item.question.ratingMax})
                      </p>
                      {#each item.distribution as bucket}<p>
                          {bucket.rating}: {bucket.count}
                        </p>{/each}{/if}{#each item.texts as text}<p class="whitespace-pre-wrap">
                        {text}
                      </p>{/each}{#if item.question.type === 'TEXT' && api.report.task.anonymous}<p>
                        {$t('survey.anonymous_text_hidden')}
                      </p>{/if}
                  </section>{/each}
                {#if !api.report.task.anonymous}
                  <h3 class="font-semibold">{$t('survey.named')}</h3>
                  {#each api.report.namedAnswers as answer}
                    {@const participant = api.report.participants.find(
                      (participant) => participant.memberId === answer.memberId
                    )}
                    <section class="ui:border-border space-y-3 rounded-lg border p-4">
                      <h4 class="font-semibold">
                        {participant?.fullname ?? participant?.employeeNo ?? participant?.email}
                      </h4>
                      {#each api.report.summary as item}<div>
                          <p class="ui:text-muted-foreground text-sm">{item.question.title}</p>
                          <p class="whitespace-pre-wrap">{surveyAnswerLabel(item.question, answer.answers)}</p>
                        </div>{/each}
                    </section>
                  {/each}
                {/if}
              {/if}
            {/if}
          </div>
        </div>
      {/if}
    {/snippet}
  </Page.Body>
  <Page.SettingsActions
    {hasChanges}
    loading={api.busy}
    statusLabel={$t('common.unsaved_changes.label')}
    discardLabel={$t('common.discard')}
    saveLabel={$t('common.save_changes')}
    onSave={saveTemplate}
    onDiscard={resetTemplate}
  />
</Page.Root>
<ScrollToTop label={$t('common.scroll_to_top')} />
