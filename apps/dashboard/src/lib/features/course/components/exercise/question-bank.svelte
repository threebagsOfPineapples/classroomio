<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import * as Dialog from '@cio/ui/base/dialog';
  import { Button } from '@cio/ui/base/button';
  import { CheckboxField } from '@cio/ui/custom/checkbox-field';
  import { InputField } from '@cio/ui/custom/input-field';
  import { QuestionBankApi } from '$features/course/api/question-bank.svelte';
  import { t } from '$lib/utils/functions/translations';
  import { getQuestionTypeOptionById, getExerciseEditorQuestionTypeLabel } from './question-type-utils';

  let { courseId }: { courseId: string } = $props();
  const bank = new QuestionBankApi();
  const selected = new SvelteSet<number>();
  let open = $state(false);
  let search = $state('');
  let page = $state(1);
  let importing = $state(false);

  async function loadPage(nextPage: number) {
    if (bank.isLoading || importing) return;

    selected.clear();
    page = nextPage;
    await bank.load(courseId, search, page);
  }

  async function showBank() {
    open = true;
    search = '';
    await loadPage(1);
  }

  async function importQuestions() {
    if (importing || !selected.size) return;

    importing = true;
    const entries = bank.entries.filter((entry) => selected.has(entry.id));
    const imported = await bank.importSelected(entries);
    importing = false;
    if (imported) open = false;
  }
</script>

<Button variant="outline" size="sm" onclick={showBank}>{$t('course.question_bank.open')}</Button>
<Dialog.Root bind:open>
  <Dialog.Content class="max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>{$t('course.question_bank.title')}</Dialog.Title>
      <Dialog.Description>{$t('course.question_bank.description')}</Dialog.Description>
    </Dialog.Header>
    <form
      class="flex items-end gap-2"
      onsubmit={(event) => {
        event.preventDefault();
        void loadPage(1);
      }}
    >
      <InputField
        bind:value={search}
        label={$t('course.question_bank.search')}
        className="flex-1"
        maxLength={100}
        isDisabled={importing}
      />
      <Button type="submit" variant="secondary" size="sm" disabled={bank.isLoading || importing}>
        {$t('course.question_bank.search')}
      </Button>
    </form>
    <div class="max-h-[50vh] space-y-3 overflow-y-auto">
      {#if bank.isLoading}
        <p class="ui:text-muted-foreground text-sm">{$t('course.question_bank.loading')}</p>
      {:else if bank.error}
        <p class="text-sm text-red-600">{$t('course.question_bank.failed')}</p>
      {:else if !bank.entries.length}
        <p class="ui:text-muted-foreground text-sm">{$t('course.question_bank.empty')}</p>
      {:else}
        {#each bank.entries as entry (entry.id)}
          {@const questionType = getQuestionTypeOptionById(entry.questionTypeId)}
          <div class="ui:border-border rounded-md border p-3">
            <CheckboxField
              label={entry.title || '—'}
              checked={selected.has(entry.id)}
              disabled={importing}
              onclick={() => {
                if (selected.has(entry.id)) selected.delete(entry.id);
                else selected.add(entry.id);
              }}
            />
            <p class="ui:text-muted-foreground mt-1 text-xs">
              {entry.courseTitle} / {entry.exerciseTitle} · {getExerciseEditorQuestionTypeLabel(questionType)}
            </p>
          </div>
        {/each}
      {/if}
    </div>
    <div class="flex justify-between gap-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={page === 1 || bank.isLoading || importing}
        onclick={() => loadPage(page - 1)}
      >
        {$t('course.sidebar.footer_nav.previous')}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={bank.entries.length < 50 || bank.isLoading || importing}
        onclick={() => loadPage(page + 1)}
      >
        {$t('course.sidebar.footer_nav.next')}
      </Button>
    </div>
    <Dialog.Footer>
      <Button variant="outline" size="sm" disabled={importing} onclick={() => (open = false)}>{$t('app.cancel')}</Button
      >
      <Button size="sm" disabled={!selected.size || bank.isLoading || importing} onclick={importQuestions}>
        {$t('course.question_bank.import')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
