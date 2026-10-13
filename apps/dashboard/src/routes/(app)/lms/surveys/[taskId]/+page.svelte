<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';
  import { currentOrg } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import { t } from '$lib/utils/functions/translations';
  import { SurveyApi } from '$lib/features/survey/api/survey.svelte';
  import SurveySelect from '$lib/features/survey/components/survey-select.svelte';
  import type { SurveyAnswerDraft } from '$lib/features/survey/utils/types';
  import { Button } from '@cio/ui/base/button';
  import { TextareaField } from '@cio/ui/custom/textarea-field';
  import { CheckboxField } from '@cio/ui/custom/checkbox-field';
  import { ScrollToTop } from '@cio/ui/custom/scroll-to-top';
  import * as Page from '@cio/ui/base/page';
  import * as Field from '@cio/ui/base/field';
  const api = new SurveyApi();
  let loadedContext = '';
  let answers = $state<SurveyAnswerDraft>({});
  let confirmed = $state(false);
  const organizationId = $derived(page.url.searchParams.get('organizationId') || $currentOrg.id);
  const taskId = $derived(page.params.taskId ?? '');
  const editable = $derived(!!api.active && !api.active.submitted && api.active.window === 'OPEN' && !api.busy);

  async function load() {
    const context = loadedContext;
    api.setContext(organizationId, $profile.id);
    const survey = await api.openMine(organizationId, taskId);
    if (survey && context === loadedContext) answers = structuredClone(survey.answers);
  }

  $effect(() => {
    const context = `${organizationId}:${$profile.id}:${taskId}`;
    if (loadedContext === context) return;

    loadedContext = context;
    untrack(() => {
      answers = {};
      confirmed = false;
      api.clear();
      if (organizationId && $profile.id && taskId) void load();
    });
  });

  function textValue(questionId: string) {
    const value = answers[questionId];
    return typeof value === 'string' ? value : '';
  }
  function selected(questionId: string, optionId: string) {
    const value = answers[questionId];
    return Array.isArray(value) && value.includes(optionId);
  }
  function toggle(questionId: string, optionId: string) {
    const value = answers[questionId];
    const choices = Array.isArray(value) ? value : [];
    answers[questionId] = choices.includes(optionId) ? choices.filter((id) => id !== optionId) : [...choices, optionId];
  }

  async function submit() {
    const result = await api.write(organizationId, taskId, answers, true);
    if (result?.submitted) {
      answers = {};
      confirmed = false;
    }
  }
</script>

<svelte:head><title>{api.active?.task.title ?? $t('survey.my_title')}</title></svelte:head>
<Page.Root class="mx-auto max-w-2xl px-4 pb-12">
  <Page.Header
    ><Page.HeaderContent><Page.Title>{api.active?.task.title ?? $t('survey.my_title')}</Page.Title></Page.HeaderContent
    ><Page.Action><Button variant="secondary" href="/lms/surveys">{$t('survey.back')}</Button></Page.Action
    ></Page.Header
  >
  <Page.Body
    >{#snippet child()}
      {#if api.error}<div role="alert" class="space-y-3 rounded-lg bg-red-50 p-4 text-red-700">
          <p>{api.error}</p>
          <Button variant="outline" disabled={api.busy} onclick={load}>{$t('survey.retry')}</Button>
        </div>{/if}
      {#if api.notice}<p role="status" class="ui:bg-muted rounded-lg p-4">{api.notice}</p>{/if}
      {#if api.busy && !api.active}<p role="status">{$t('survey.loading')}</p>{/if}
      {#if api.active}
        {#if api.active.submitted}<section role="status" class="ui:bg-muted space-y-3 rounded-xl p-6">
            <h2 class="text-xl font-semibold">{$t('survey.receipt')}</h2>
            <p>{$t('survey.receipt_description')}</p>
            <p>{api.active.task.title}</p>
          </section>
        {:else if api.active.window !== 'OPEN'}<section role="status" class="ui:bg-muted space-y-3 rounded-xl p-6">
            <h2 class="text-xl font-semibold">
              {$t(api.active.window === 'CLOSED' ? 'survey.closed' : 'survey.not_open')}
            </h2>
            <p>
              {new Date(api.active.task.startsAt).toLocaleString()} — {new Date(
                api.active.task.endsAt
              ).toLocaleString()}
            </p>
          </section>
        {:else}
          <div class="space-y-5">
            <section class="ui:bg-muted space-y-3 rounded-xl p-4">
              <p>
                {$t(`survey.purpose_${api.active.task.purpose.toLowerCase()}`)} · {$t(
                  api.active.task.anonymous ? 'survey.anonymous' : 'survey.named'
                )}
              </p>
              <p class="whitespace-pre-wrap">{api.active.template.description}</p>
              <p class="text-sm">
                {$t(api.active.task.anonymous ? 'survey.anonymous_learner' : 'survey.named_learner')}
              </p>
              <p class="text-sm">{$t('survey.ends_at')}: {new Date(api.active.task.endsAt).toLocaleString()}</p>
            </section>
            <Field.Group
              >{#each api.active.template.questions as question, questionIndex (question.id)}
                <Field.Set class="ui:border-border rounded-xl border p-4"
                  ><Field.Legend
                    >{questionIndex + 1}. {question.title}{question.required
                      ? ` (${$t('survey.required')})`
                      : ''}</Field.Legend
                  ><Field.Group>
                    {#if question.type === 'TEXT'}<TextareaField
                        name={`survey-response-question-${question.id}`}
                        id={`survey-response-question-${question.id}`}
                        aria-label={$t('survey.your_answer')}
                        label={$t('survey.your_answer')}
                        value={textValue(question.id)}
                        disabled={!editable}
                        oninput={(event) => (answers[question.id] = event.currentTarget.value)}
                      />
                    {:else if question.type === 'SINGLE'}<SurveySelect
                        label={$t('survey.your_answer')}
                        options={question.options.map((option) => ({ value: option.id, label: option.label }))}
                        disabled={!editable}
                        bind:value={() => textValue(question.id), (value) => (answers[question.id] = value)}
                      />
                    {:else if question.type === 'MULTIPLE'}<Field.Description
                        >{$t('survey.choose_multiple')}</Field.Description
                      >{#each question.options as option}<CheckboxField
                          name={`survey-response-question-${question.id}-option-${option.id}`}
                          label={option.label}
                          checked={selected(question.id, option.id)}
                          disabled={!editable}
                          onclick={() => toggle(question.id, option.id)}
                        />{/each}
                    {:else}<div class="flex flex-wrap gap-2" role="group" aria-label={question.title}>
                        {#each Array.from({ length: question.ratingMax }, (_, index) => index + 1) as rating}<Button
                            class="min-h-11 min-w-11"
                            variant={answers[question.id] === rating ? 'default' : 'secondary'}
                            aria-pressed={answers[question.id] === rating}
                            disabled={!editable}
                            onclick={() => (answers[question.id] = rating)}>{rating}</Button
                          >{/each}
                      </div>{/if}
                  </Field.Group></Field.Set
                >
              {/each}</Field.Group
            >
            <div class="space-y-4">
              <p class="ui:text-muted-foreground text-sm">{$t('survey.final_policy')}</p>
              <CheckboxField
                name="survey-submission-confirmed"
                label={$t('survey.confirm_submission')}
                bind:checked={confirmed}
                disabled={api.busy}
              />
              <div class="flex flex-wrap gap-3">
                <Button
                  class="min-h-11"
                  variant="secondary"
                  disabled={!editable}
                  onclick={() => api.write(organizationId, taskId, answers, false)}>{$t('survey.save_draft')}</Button
                ><Button class="min-h-11" disabled={!editable || !confirmed} onclick={submit}
                  >{$t(api.busy ? 'survey.saving' : 'survey.submit')}</Button
                >
              </div>
            </div>
          </div>
        {/if}
      {/if}
    {/snippet}</Page.Body
  >
</Page.Root>
<ScrollToTop label={$t('common.scroll_to_top')} />
