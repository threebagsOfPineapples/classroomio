<script lang="ts">
  import { Switch } from '@cio/ui/base/switch';
  import { Label } from '@cio/ui/base/label';
  import { Button } from '@cio/ui/base/button';
  import { InputField } from '@cio/ui/custom/input-field';
  import { questionnaire } from './store';
  import { exerciseApi } from '$features/course/api';
  import { courseApi } from '$features/course/api';
  import { t } from '$lib/utils/functions/translations';
  import { snackbar } from '$features/ui/snackbar/store';
  import { slugifyTitle } from '@cio/utils/validation';
  import * as Select from '@cio/ui/base/select';

  type Props = {
    exerciseId: string;
    onBeforeSave?: () => Promise<boolean> | boolean;
    totalSubmissions?: number;
  };

  let { exerciseId, onBeforeSave = () => true, totalSubmissions = 0 }: Props = $props();

  let saving = $state(false);
  let slug = $state($questionnaire.slug ?? '');

  $effect(() => {
    slug = $questionnaire.slug ?? '';
  });

  const isPublicCourse = $derived(courseApi.course?.type === 'PUBLIC');

  function localDateTime(value: string | null | undefined) {
    if (!value) return '';

    const date = new Date(value);
    const localTime = date.getTime() - date.getTimezoneOffset() * 60_000;
    return new Date(localTime).toISOString().slice(0, 16);
  }

  function updateExamDate(field: 'opensAt' | 'closesAt', value: string) {
    const date = value ? new Date(value) : null;
    const isoValue = date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
    questionnaire.update((state) => ({ ...state, [field]: isoValue }));
  }

  async function saveSettings() {
    if (!courseApi.course?.id) return;
    const canSave = await onBeforeSave();
    if (!canSave) return;

    saving = true;

    const allowMultipleAttempts = $questionnaire.isExam
      ? ($questionnaire.maxAttempts ?? 1) > 1
      : !!$questionnaire.allowMultipleAttempts;
    const completionPolicy = $questionnaire.completionPolicy ?? 'submitted';
    const passThreshold = $questionnaire.passThreshold ?? 100;
    const isExam = !!$questionnaire.isExam;
    const opensAt = $questionnaire.opensAt ?? null;
    const closesAt = $questionnaire.closesAt ?? null;
    const maxAttempts = $questionnaire.maxAttempts ?? 1;
    const durationMinutes = $questionnaire.durationMinutes ?? null;
    const slugPayload = isPublicCourse && slug ? slug : undefined;

    await exerciseApi.update(courseApi.course.id, exerciseId, {
      allowMultipleAttempts,
      isExam,
      opensAt,
      closesAt,
      maxAttempts,
      durationMinutes,
      completionPolicy,
      passThreshold,
      slug: slugPayload
    });
    saving = false;

    if (exerciseApi.success) {
      snackbar.success('snackbar.exercise.success');
    }
  }
</script>

<div class="max-w-xl space-y-6">
  {#if !isPublicCourse || $questionnaire.isExam}
    <div class="space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <div class="flex items-center justify-between gap-4">
        <Label for="exam-mode" class="text-sm font-medium dark:text-gray-100">
          {$t('course.navItem.lessons.exercises.all_exercises.settings_exam_mode')}
        </Label>
        <Switch
          id="exam-mode"
          checked={!!$questionnaire.isExam}
          onCheckedChange={(checked) => questionnaire.update((state) => ({ ...state, isExam: checked }))}
        />
      </div>
      {#if $questionnaire.isExam}
        <InputField
          type="datetime-local"
          label={$t('course.navItem.lessons.exercises.all_exercises.settings_exam_opens')}
          value={localDateTime($questionnaire.opensAt)}
          onInputChange={(event) => updateExamDate('opensAt', event.currentTarget.value)}
        />
        <InputField
          type="datetime-local"
          label={$t('course.navItem.lessons.exercises.all_exercises.settings_exam_closes')}
          value={localDateTime($questionnaire.closesAt)}
          onInputChange={(event) => updateExamDate('closesAt', event.currentTarget.value)}
        />
        <InputField
          type="number"
          min="1"
          label={$t('course.navItem.lessons.exercises.all_exercises.settings_exam_max_attempts')}
          value={String($questionnaire.maxAttempts ?? 1)}
          onInputChange={(event) =>
            questionnaire.update((state) => ({ ...state, maxAttempts: Number(event.currentTarget.value) }))}
        />
        <InputField
          type="number"
          min="1"
          label={$t('course.navItem.lessons.exercises.all_exercises.settings_exam_duration')}
          value={$questionnaire.durationMinutes == null ? '' : String($questionnaire.durationMinutes)}
          onInputChange={(event) =>
            questionnaire.update((state) => ({
              ...state,
              durationMinutes: event.currentTarget.value ? Number(event.currentTarget.value) : null
            }))}
        />
        <p class="ui:text-muted-foreground text-sm">
          {$t('course.navItem.lessons.exercises.all_exercises.settings_exam_window_helper')}
        </p>
      {/if}
    </div>
  {/if}

  {#if !$questionnaire.isExam}
    <div
      class="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"
    >
      <div class="space-y-1">
        <Label for="allow-multiple" class="text-sm font-medium dark:text-gray-100">
          {$t('course.navItem.lessons.exercises.all_exercises.settings_allow_multiple')}
        </Label>
        <p class="ui:text-muted-foreground text-sm">
          {$t('course.navItem.lessons.exercises.all_exercises.settings_allow_multiple_helper')}
        </p>
      </div>
      <Switch
        id="allow-multiple"
        checked={!!$questionnaire.allowMultipleAttempts}
        onCheckedChange={(checked) => {
          questionnaire.update((q) => ({ ...q, allowMultipleAttempts: checked }));
        }}
      />
    </div>
  {/if}

  <div class="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
    <Label class="mb-2 block text-sm font-medium dark:text-gray-100">
      {$t('course.navItem.lessons.exercises.all_exercises.settings_completion_policy')}
    </Label>
    <Select.Root
      type="single"
      value={$questionnaire.completionPolicy ?? 'submitted'}
      onValueChange={(value) => {
        if (value === 'submitted' || value === 'passed') {
          questionnaire.update((state) => ({ ...state, completionPolicy: value }));
        }
      }}
    >
      <Select.Trigger class="w-full">
        {($questionnaire.completionPolicy ?? 'submitted') === 'passed'
          ? $t('course.navItem.lessons.exercises.all_exercises.settings_completion_passed')
          : $t('course.navItem.lessons.exercises.all_exercises.settings_completion_submitted')}
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="submitted">
          {$t('course.navItem.lessons.exercises.all_exercises.settings_completion_submitted')}
        </Select.Item>
        <Select.Item value="passed">
          {$t('course.navItem.lessons.exercises.all_exercises.settings_completion_passed')}
        </Select.Item>
      </Select.Content>
    </Select.Root>

    {#if ($questionnaire.completionPolicy ?? 'submitted') === 'passed'}
      <div class="mt-4 space-y-3">
        <div class="space-y-2 text-sm">
          <p class="ui:text-muted-foreground">
            {$t('course.navItem.lessons.exercises.all_exercises.settings_completion_passed_helper')}
          </p>
          <p class="text-amber-700 dark:text-amber-300">
            {$t('course.navItem.lessons.exercises.all_exercises.settings_manual_grading_warning')}
          </p>
          {#if !$questionnaire.allowMultipleAttempts}
            <p class="text-amber-700 dark:text-amber-300">
              {$t('course.navItem.lessons.exercises.all_exercises.settings_single_attempt_warning')}
            </p>
          {/if}
          {#if totalSubmissions > 0}
            <p class="text-amber-700 dark:text-amber-300">
              {$t('course.navItem.lessons.exercises.all_exercises.settings_existing_submissions_warning')}
            </p>
          {/if}
        </div>
        <InputField
          type="number"
          label={$t('course.navItem.lessons.exercises.all_exercises.settings_pass_threshold')}
          value={String($questionnaire.passThreshold ?? 100)}
          onInputChange={(event) => {
            const parsed = Number(event.currentTarget.value);
            if (!Number.isNaN(parsed)) {
              questionnaire.update((state) => ({ ...state, passThreshold: parsed }));
            }
          }}
        />
      </div>
    {/if}
  </div>

  {#if isPublicCourse}
    <div class="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <InputField
        label={$t('course.navItem.settings.slug.label')}
        helperMessage={$t('course.navItem.settings.slug.description')}
        value={slug}
        placeholder={slugifyTitle($questionnaire.title ?? '')}
        onInputChange={(e) => {
          slug = e.currentTarget.value;
        }}
        errorMessage={exerciseApi.errors.slug}
      />
    </div>
  {/if}

  <Button onclick={saveSettings} loading={saving} disabled={!courseApi.course?.id}>
    {$t('course.navItem.lessons.exercises.all_exercises.settings_save')}
  </Button>
</div>
