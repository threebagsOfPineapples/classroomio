<script lang="ts">
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { Badge } from '@cio/ui/base/badge';
  import { Label } from '@cio/ui/base/label';
  import { Switch } from '@cio/ui/base/switch';
  import * as RadioGroup from '@cio/ui/base/radio-group';
  import * as Select from '@cio/ui/base/select';
  import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
  import XIcon from '@lucide/svelte/icons/x';

  import ReorderMaterialTabs from '$features/course/components/reorder-material-tabs.svelte';
  import CertificateDeadlineRequiredDialog from '$features/course/components/certificate-deadline-required-dialog.svelte';
  import { CourseTagPicker } from '$features/course/components';
  import { IconButton } from '@cio/ui/custom/icon-button';
  import { TextareaField } from '@cio/ui/custom/textarea-field';
  import { InputField } from '@cio/ui/custom/input-field';
  import { Input } from '@cio/ui/base/input';
  import * as Field from '@cio/ui/base/field';
  import {
    UnsavedChanges,
    UploadWidget,
    TextEditor,
    AttentionHighlight,
    SettingsCard,
    SettingsSeparator
  } from '$features/ui';
  import { Button } from '@cio/ui/base/button';

  import { settings } from '$features/course/utils/settings-store';
  import { getOrderedNavigableContent } from '$features/course/utils/content';
  import { getInternalCourseUrl, copyInternalCourseUrl } from '$features/course/utils/course-preview';
  import Copy from '@lucide/svelte/icons/copy';
  import * as Alert from '@cio/ui/base/alert';
  import LockOpenIcon from '@lucide/svelte/icons/lock-open';
  import type { TCourseType } from '@cio/db/types';
  import type { Course } from '../utils/types';
  import { t } from '$lib/utils/functions/translations';
  import { isObject } from '$lib/utils/functions/isObject';
  import { snackbar } from '$features/ui/snackbar/store';
  import { isPublishedComplianceMissingDeadline } from '@cio/utils/functions';
  import { DEFAULT_COMPLIANCE_SETTINGS } from '../utils/compliance-utils';
  import { ContentType } from '@cio/utils/constants/content';
  import { DeleteModal } from '$features/ui';
  import { contentApi, courseApi } from '$features/course/api';
  import { collectLockedContentItems } from '$features/course/utils/content-lock-utils';
  import { tagApi } from '$features/tag/api';
  import { uploadImage } from '$lib/utils/services/upload';
  import { handleOpenWidget } from '$features/ui/course-landing-page/store';
  import { currentOrgPath } from '$lib/utils/store/org';
  import { page } from '$app/stores';
  import { ROUTE_NAME, ROUTE_SECTIONS } from '$lib/routing/routes';

  interface Props {
    hasUnsavedChanges?: boolean;
  }

  let { hasUnsavedChanges = $bindable(false) }: Props = $props();

  let isLoading = $state(false);
  let isDeleting = $state(false);
  let openCertificateDeadlineDialog = $state(false);
  let completionDeadlineTrigger = $state(0);
  let errors: {
    title: string | undefined;
    description: string | undefined;
  } = $state({
    title: undefined,
    description: undefined
  });
  let avatar: string | undefined;
  let openDeleteModal = $state(false);
  let selectedTagIds = $state<string[]>([]);
  let initialTagIds = $state<string[]>([]);
  let loadedCourseTagsForId = $state<string | null>(null);
  let initializedCourseId = $state<string | null>(null);
  let isTagPopoverOpen = $state(false);

  function normalizeTagIds(tagIds: string[]) {
    return Array.from(new Set(tagIds));
  }

  function areSameTagIds(a: string[], b: string[]) {
    if (a.length !== b.length) {
      return false;
    }

    const left = [...a].sort();
    const right = [...b].sort();

    return left.every((value, index) => value === right[index]);
  }

  async function loadCourseTags(courseId: string) {
    loadedCourseTagsForId = courseId;

    await Promise.all([tagApi.getTagGroups(), tagApi.getCourseTags(courseId)]);

    const assignedTagIds = normalizeTagIds(tagApi.courseTags.map((tag) => tag.id));
    selectedTagIds = assignedTagIds;
    initialTagIds = assignedTagIds;
  }

  function toggleTagSelection(tagId: string) {
    const selected = new Set(selectedTagIds);

    if (selected.has(tagId)) {
      selected.delete(tagId);
    } else {
      selected.add(tagId);
    }

    selectedTagIds = Array.from(selected);
    hasUnsavedChanges = true;
  }

  function removeSelectedTag(tagId: string) {
    selectedTagIds = selectedTagIds.filter((id) => id !== tagId);
    hasUnsavedChanges = true;
  }

  function widgetControl() {
    $handleOpenWidget.open = !$handleOpenWidget.open;
  }

  const deleteBannerImage = () => {
    $settings.logo = '';
    hasUnsavedChanges = true;
  };

  let isUnlockingAll = $state(false);

  const lockedContentItems = $derived(collectLockedContentItems(courseApi.course));
  const isLiveClassCourse = $derived(courseApi.course?.type === 'LIVE_CLASS');
  const showLockedContentNotice = $derived($settings.isPublished && lockedContentItems.length > 0);

  async function handleUnlockAllContent() {
    const courseId = courseApi.course?.id;
    if (!courseId || lockedContentItems.length === 0 || isUnlockingAll) return;

    isUnlockingAll = true;
    const itemsToUnlock = [...lockedContentItems];
    const didUnlock = await contentApi.updateContent(
      courseId,
      itemsToUnlock.map((item) => ({ id: item.id, type: item.type, isUnlocked: true }))
    );

    if (didUnlock) {
      for (const item of itemsToUnlock) {
        courseApi.updateContentItem(item.id, item.type, { isUnlocked: true });
      }
      snackbar.success('snackbar.course_settings.success.unlocked_all_content');
    }

    isUnlockingAll = false;
  }

  async function handleDeleteCourse() {
    if (!courseApi.course) return;

    isDeleting = true;

    await courseApi.delete(courseApi.course.id);
    if (courseApi.success) {
      goto($currentOrgPath + '/courses');
    }

    isDeleting = false;
  }

  function onPublishToggle(checked: boolean) {
    if (!checked) {
      $settings.isPublished = false;
      hasUnsavedChanges = true;
      return;
    }

    if (
      isPublishedComplianceMissingDeadline({
        type: $settings.type,
        isPublished: true,
        deadline: $settings.certificate.deadline
      })
    ) {
      openCertificateDeadlineDialog = true;
      return;
    }

    // Otherwise, publish normally
    $settings.isPublished = true;
    $settings.status = 'ACTIVE';
    hasUnsavedChanges = true;
  }

  function goToCompletionDeadline() {
    openCertificateDeadlineDialog = false;
    completionDeadlineTrigger += 1;
  }

  export async function handleSave() {
    if (!$settings.courseTitle) {
      errors.title = $t('snackbar.course_settings.error.title');
      return;
    }

    if (!$settings.courseDescription) {
      errors.description = $t('snackbar.course_settings.error.description');
      return;
    }

    try {
      let logoUrl = $settings.logo;

      // Upload image if avatar is provided
      if (avatar) {
        logoUrl = await uploadImage(new File([avatar], avatar));
      }

      if (!courseApi.course) return;

      if (
        isPublishedComplianceMissingDeadline({
          type: $settings.type,
          isPublished: $settings.isPublished,
          deadline: $settings.certificate.deadline
        })
      ) {
        openCertificateDeadlineDialog = true;
        return;
      }

      const metadataPayload = {
        ...(isObject(courseApi.course.metadata) ? courseApi.course.metadata : {}),
        lessonTabsOrder: $settings.tabs,
        grading: $settings.grading,
        lessonDownload: $settings.lessonDownload,
        allowSelfEnrollment: $settings.allowSelfEnrollment,
        isContentGroupingEnabled: $settings.isContentGroupingEnabled,
        progressionMode: $settings.progressionMode,
        commentsEnabled: $settings.commentsEnabled,
        welcomeEmailMessage: $settings.welcomeEmailMessage?.trim() ? $settings.welcomeEmailMessage : null
      } as NonNullable<Course['metadata']>;

      const updatedCourse = {
        title: $settings.courseTitle,
        description: $settings.courseDescription,
        type: $settings.type,
        logo: logoUrl,
        isPublished: $settings.isPublished,
        status: $settings.status,
        difficulty: $settings.difficulty,
        learningMinutes: $settings.learningMinutes,
        credit: $settings.credit,
        targetAudience: $settings.targetAudience.trim() || null,
        required: $settings.required,
        metadata: metadataPayload,
        slug: courseApi.course.slug ?? undefined,
        compliance:
          $settings.type === 'COMPLIANCE' ? (courseApi.course.compliance ?? DEFAULT_COMPLIANCE_SETTINGS) : undefined,
        certificate: {
          ...(courseApi.course.certificate ?? {}),
          deadline: $settings.certificate.deadline,
          threshold: $settings.certificate.threshold,
          requiredExerciseId: $settings.certificate.requiredExerciseId,
          exerciseMinScorePercent: $settings.certificate.requiredExerciseId
            ? $settings.certificate.exerciseMinScorePercent
            : null
        }
      };

      const normalizedSelectedTagIds = normalizeTagIds(selectedTagIds);
      const hasTagChanges = !areSameTagIds(normalizedSelectedTagIds, initialTagIds);

      const updatePayload = {
        ...updatedCourse,
        ...(hasTagChanges ? { tagIds: normalizedSelectedTagIds } : {})
      };

      const response = await courseApi.update(courseApi.course.id, updatePayload, {
        showSuccessToast: !hasTagChanges
      });

      if (courseApi.success && response) {
        if (hasTagChanges) {
          initialTagIds = normalizedSelectedTagIds;
          selectedTagIds = normalizedSelectedTagIds;
        }

        hasUnsavedChanges = false;
      }
    } catch (error) {
      console.error(error);
      snackbar.error();
    }
  }

  async function setDefault(course: Course) {
    if (!course || !Object.keys(course).length) return;

    untrack(() => {
      settings.set({
        courseTitle: course.title,
        type: (course.type as TCourseType) || 'SELF_PACED',
        courseDescription: course.description,
        logo: course.logo || '',
        tabs: course.metadata?.lessonTabsOrder || $settings.tabs,
        grading: !!course.metadata?.grading,
        lessonDownload: !!course.metadata?.lessonDownload,
        isPublished: !!course.isPublished,
        status: course.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
        difficulty:
          course.difficulty === 'BEGINNER' || course.difficulty === 'INTERMEDIATE' || course.difficulty === 'ADVANCED'
            ? course.difficulty
            : null,
        learningMinutes: course.learningMinutes ?? null,
        credit: course.credit ?? null,
        targetAudience: course.targetAudience ?? '',
        required: course.required ?? null,
        allowSelfEnrollment: course.metadata?.allowSelfEnrollment ?? false,
        isContentGroupingEnabled: course.metadata?.isContentGroupingEnabled ?? true,
        progressionMode: course.metadata?.progressionMode ?? 'free',
        commentsEnabled: course.metadata?.commentsEnabled ?? true,
        callout: normalizeCallout(course.callout),
        welcomeEmailMessage: course.metadata?.welcomeEmailMessage ?? '',
        certificate: {
          deadline: course.certificate?.deadline ?? null,
          threshold: typeof course.certificate?.threshold === 'number' ? course.certificate.threshold : 100,
          requiredExerciseId: course.certificate?.requiredExerciseId ?? null,
          exerciseMinScorePercent:
            typeof course.certificate?.exerciseMinScorePercent === 'number'
              ? course.certificate.exerciseMinScorePercent
              : course.certificate?.requiredExerciseId
                ? 100
                : null
        }
      });
    });
  }

  export function handleDiscard() {
    if (!courseApi.course) return;

    setDefault(courseApi.course);
    selectedTagIds = [...initialTagIds];
    avatar = undefined;
    errors = { title: undefined, description: undefined };
    delete courseApi.errors.type;
    hasUnsavedChanges = false;
  }

  function normalizeCallout(value: unknown): typeof $settings.callout {
    if (!value || typeof value !== 'object') return null;

    const candidate = value as Record<string, unknown>;
    if (
      typeof candidate.title !== 'string' ||
      typeof candidate.description !== 'string' ||
      typeof candidate.buttonLabel !== 'string' ||
      typeof candidate.buttonUrl !== 'string'
    ) {
      return null;
    }

    const animation =
      candidate.animation === 'dotted' || candidate.animation === 'none' || candidate.animation === 'waves'
        ? candidate.animation
        : 'waves';

    return {
      title: candidate.title,
      description: candidate.description,
      buttonLabel: candidate.buttonLabel,
      buttonUrl: candidate.buttonUrl,
      animation
    };
  }

  // Initialize course from page data
  $effect(() => {
    const courseData = $page.data?.course;
    const courseId = $page.data?.courseId;
    if (courseData && courseId && !courseApi.course) {
      courseApi.course = courseData;
    }
  });

  $effect(() => {
    const course = courseApi.course;
    if (course?.id && initializedCourseId !== course.id) {
      initializedCourseId = course.id;
      setDefault(course);
    }
  });

  $effect(() => {
    const courseId = courseApi.course?.id;

    if (!courseId || loadedCourseTagsForId === courseId) {
      return;
    }

    loadCourseTags(courseId);
  });

  const selectedTagChips = $derived.by(() => {
    const allTags = tagApi.tagGroups.flatMap((group) =>
      group.tags.map((tag) => ({
        ...tag,
        category: group.name
      }))
    );

    const tagById = new Map(allTags.map((tag) => [tag.id, tag]));

    const selected: (typeof allTags)[number][] = [];

    for (const tagId of selectedTagIds) {
      const existing = tagById.get(tagId);
      if (existing) {
        selected.push(existing);
        continue;
      }

      const assigned = tagApi.courseTags.find((tag) => tag.id === tagId);
      if (assigned) {
        selected.push({
          ...assigned,
          category: '',
          courseCount: 1
        });
      }
    }

    return selected;
  });

  const hasAnyTagsCreated = $derived(tagApi.tagGroups.some((group) => group.tags.length > 0));

  const courseLink = $derived(courseApi.course?.id ? getInternalCourseUrl(courseApi.course.id) : '');

  const certExercises = $derived(
    getOrderedNavigableContent(courseApi.course).filter((item) => item.type === ContentType.Exercise)
  );

  const finalExerciseTitle = $derived(
    certExercises.find((item) => item.id === $settings.certificate.requiredExerciseId)?.title
  );

  function isoToDatetimeLocal(iso: string | null | undefined): string {
    if (!iso) return '';

    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';

    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function onCompletionDeadlineChange(e: Event) {
    const value = (e.currentTarget as HTMLInputElement).value;
    $settings.certificate.deadline = value ? new Date(value).toISOString() : null;
    delete courseApi.errors['certificate.deadline'];
    hasUnsavedChanges = true;
  }

  function onThresholdInput(e: Event) {
    const value = Number((e.currentTarget as HTMLInputElement).value);
    $settings.certificate.threshold = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 100;
    delete courseApi.errors['certificate.threshold'];
    hasUnsavedChanges = true;
  }

  function onFinalExerciseChange(value: string) {
    $settings.certificate.requiredExerciseId = value && value !== 'none' ? value : null;

    if (!$settings.certificate.requiredExerciseId) {
      $settings.certificate.exerciseMinScorePercent = null;
    } else if (typeof $settings.certificate.exerciseMinScorePercent !== 'number') {
      $settings.certificate.exerciseMinScorePercent = 100;
    }

    delete courseApi.errors['certificate.requiredExerciseId'];
    delete courseApi.errors['certificate.exerciseMinScorePercent'];
    hasUnsavedChanges = true;
  }

  function onMinExerciseScoreInput(e: Event) {
    const value = Number((e.currentTarget as HTMLInputElement).value);
    $settings.certificate.exerciseMinScorePercent = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 100;
    delete courseApi.errors['certificate.exerciseMinScorePercent'];
    hasUnsavedChanges = true;
  }
</script>

<UnsavedChanges bind:hasUnsavedChanges />

<DeleteModal onDelete={handleDeleteCourse} bind:open={openDeleteModal} />

<CertificateDeadlineRequiredDialog bind:open={openCertificateDeadlineDialog} onGoToDeadline={goToCompletionDeadline} />

<div class="flex w-full flex-col gap-8">
  <SettingsCard id="general" title={$t('course.navItem.settings.general_card_title')}>
    <Field.Group>
      <Field.Field id="cover-image" class="scroll-mt-24">
        <div class="flex flex-col items-start gap-4 sm:flex-row">
          <img
            alt={$t('course.navItem.settings.cover_image')}
            src={$settings.logo ? $settings.logo : '/images/classroomio-course-img-template.jpg'}
            class="h-[120px] w-[168px] rounded-md border object-cover"
          />
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <Field.Label>
              <a href="#cover-image" class="hover:underline">{$t('course.navItem.settings.cover_image')}</a>
            </Field.Label>
            <Field.Description>{$t('course.navItem.settings.optional_image')}</Field.Description>
            <div class="flex items-center gap-2">
              <Button variant="secondary" onclick={widgetControl}>
                {$t('course.navItem.settings.replace')}
              </Button>
              <Button variant="outline" onclick={deleteBannerImage}>
                {$t('course.navItem.settings.remove')}
              </Button>
            </div>
          </div>
        </div>
        {#if $handleOpenWidget.open}
          <UploadWidget
            bind:imageURL={$settings.logo}
            onchange={() => {
              hasUnsavedChanges = true;
            }}
          />
        {/if}
      </Field.Field>

      <div id="course-title" class="scroll-mt-24">
        <InputField
          label={$t('course.navItem.settings.course_title')}
          placeholder={$t('course.navItem.settings.course_title_placeholder')}
          className="w-full"
          isRequired
          bind:value={$settings.courseTitle}
          errorMessage={errors?.title || courseApi.errors?.title}
          onInputChange={() => {
            errors.title = undefined;
            delete courseApi.errors.title;
            hasUnsavedChanges = true;
          }}
        />
      </div>

      <div id="course-description" class="scroll-mt-24">
        <TextareaField
          label={$t('course.navItem.settings.course_description')}
          placeholder={$t('course.navItem.settings.placeholder')}
          className="w-full"
          isRequired
          bind:value={$settings.courseDescription}
          errorMessage={errors?.description || courseApi.errors?.description}
          oninput={() => {
            errors.description = undefined;
            delete courseApi.errors.description;
            hasUnsavedChanges = true;
          }}
          onchange={() => {
            errors.description = undefined;
            delete courseApi.errors.description;
            hasUnsavedChanges = true;
          }}
        />
      </div>

      <Field.Field id="share" class="scroll-mt-24">
        <Field.Label>{$t('enterprise.course.internal_link')}</Field.Label>
        <Field.Description>{$t('enterprise.course.internal_link_description')}</Field.Description>
        <div class="flex items-center justify-between gap-2 rounded-md border p-2">
          <p class="min-w-0 truncate text-sm">{courseLink}</p>
          <div class="flex shrink-0 items-center gap-1">
            <IconButton
              variant="secondary"
              href={courseLink}
              target="_blank"
              rel="noopener noreferrer"
              tooltip={$t('course.navItem.settings.open_link')}
              disabled={!courseLink}
            >
              <ArrowUpRightIcon size={16} />
            </IconButton>
            <IconButton
              variant="secondary"
              onclick={() => courseApi.course?.id && copyInternalCourseUrl(courseApi.course.id)}
              disabled={!courseLink}
              tooltip={$t('course.navItem.settings.copy_link')}
            >
              <Copy size={16} />
            </IconButton>
          </div>
        </div>
      </Field.Field>

      <Field.Field id="tags" class="scroll-mt-24">
        <Field.Label>
          <a href="#tags" class="hover:underline">{$t('course.navItem.settings.tags.title')}</a>
        </Field.Label>
        <Field.Description>{$t('course.navItem.settings.tags.description')}</Field.Description>
        <div class="space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            {#if !selectedTagChips.length && !hasAnyTagsCreated}
              <p class="ui:text-muted-foreground text-sm">{$t('course.navItem.settings.tags.none_created')}</p>
            {:else if !selectedTagChips.length}
              <p class="ui:text-muted-foreground text-sm">{$t('course.navItem.settings.tags.empty')}</p>
            {:else}
              {#each selectedTagChips as tag (tag.id)}
                <Badge variant="outline" class="flex items-center gap-2">
                  <span
                    class="inline-block h-2.5 w-2.5 rounded-full border"
                    style={`background-color: ${tag.color}`}
                    aria-hidden="true"
                  ></span>
                  <span>{tag.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    class="h-5 w-5"
                    onclick={() => removeSelectedTag(tag.id)}
                  >
                    <XIcon />
                  </Button>
                </Badge>
              {/each}
            {/if}

            <CourseTagPicker
              tagGroups={tagApi.tagGroups}
              {selectedTagIds}
              bind:open={isTagPopoverOpen}
              onTagToggle={toggleTagSelection}
              onTagCreated={toggleTagSelection}
            />
          </div>
        </div>
      </Field.Field>

      <SettingsSeparator />

      <Field.Field id="welcome-email" class="scroll-mt-24">
        <Field.Label>
          <a href="#welcome-email" class="hover:underline">{$t('course.navItem.settings.welcome_email.title')}</a>
        </Field.Label>
        <Field.Description>{$t('course.navItem.settings.welcome_email.description')}</Field.Description>
        <TextEditor
          content={$settings.welcomeEmailMessage}
          placeholder={$t('course.navItem.settings.welcome_email.placeholder')}
          class="w-full"
          editorClass="h-auto! max-h-[200px] min-h-[120px]"
          onChange={(text) => {
            $settings.welcomeEmailMessage = text;
            hasUnsavedChanges = true;
          }}
        />
      </Field.Field>
    </Field.Group>
  </SettingsCard>

  <SettingsCard id="enterprise-course" title={$t('course.navItem.settings.enterprise.title')}>
    <Field.Group>
      <Field.Field>
        <Field.Label>{$t('course.navItem.settings.enterprise.status')}</Field.Label>
        <Select.Root
          type="single"
          value={$settings.status}
          onValueChange={(value) => {
            if (value !== 'ACTIVE' && value !== 'ARCHIVED') return;

            $settings.status = value;
            if (value === 'ARCHIVED') $settings.isPublished = false;
            hasUnsavedChanges = true;
          }}
        >
          <Select.Trigger class="w-full">
            {$t(`course.navItem.settings.enterprise.${$settings.status.toLowerCase()}`)}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="ACTIVE" label={$t('course.navItem.settings.enterprise.active')}>
              {$t('course.navItem.settings.enterprise.active')}
            </Select.Item>
            <Select.Item value="ARCHIVED" label={$t('course.navItem.settings.enterprise.archived')}>
              {$t('course.navItem.settings.enterprise.archived')}
            </Select.Item>
          </Select.Content>
        </Select.Root>
      </Field.Field>

      <Field.Field>
        <Field.Label>{$t('course.navItem.settings.enterprise.difficulty')}</Field.Label>
        <Select.Root
          type="single"
          value={$settings.difficulty ?? 'none'}
          onValueChange={(value) => {
            if (value !== 'none' && value !== 'BEGINNER' && value !== 'INTERMEDIATE' && value !== 'ADVANCED') return;

            $settings.difficulty = value === 'none' ? null : value;
            hasUnsavedChanges = true;
          }}
        >
          <Select.Trigger class="w-full">
            {$settings.difficulty
              ? $t(`course.creator.level.${$settings.difficulty.toLowerCase()}`)
              : $t('course.navItem.settings.enterprise.unspecified')}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="none" label={$t('course.navItem.settings.enterprise.unspecified')}>
              {$t('course.navItem.settings.enterprise.unspecified')}
            </Select.Item>
            <Select.Item value="BEGINNER" label={$t('course.creator.level.beginner')}>
              {$t('course.creator.level.beginner')}
            </Select.Item>
            <Select.Item value="INTERMEDIATE" label={$t('course.creator.level.intermediate')}>
              {$t('course.creator.level.intermediate')}
            </Select.Item>
            <Select.Item value="ADVANCED" label={$t('course.creator.level.advanced')}>
              {$t('course.creator.level.advanced')}
            </Select.Item>
          </Select.Content>
        </Select.Root>
      </Field.Field>

      <Field.Field>
        <Field.Label for="course-learning-minutes"
          >{$t('course.navItem.settings.enterprise.learning_minutes')}</Field.Label
        >
        <Input
          id="course-learning-minutes"
          type="number"
          min={0}
          max={100000}
          value={$settings.learningMinutes?.toString() ?? ''}
          oninput={(event) => {
            const value = event.currentTarget.value;
            $settings.learningMinutes = value === '' ? null : Number(value);
            hasUnsavedChanges = true;
          }}
        />
      </Field.Field>

      <Field.Field>
        <Field.Label for="course-credit">{$t('course.navItem.settings.enterprise.credit')}</Field.Label>
        <Input
          id="course-credit"
          type="number"
          min={0}
          max={1000}
          step="0.1"
          value={$settings.credit?.toString() ?? ''}
          oninput={(event) => {
            const value = event.currentTarget.value;
            $settings.credit = value === '' ? null : Number(value);
            hasUnsavedChanges = true;
          }}
        />
      </Field.Field>

      <TextareaField
        label={$t('course.navItem.settings.enterprise.target_audience')}
        bind:value={$settings.targetAudience}
        oninput={() => (hasUnsavedChanges = true)}
      />

      <Field.Field orientation="horizontal">
        <Field.Content>
          <Field.Label for="course-required">{$t('course.navItem.settings.enterprise.required')}</Field.Label>
          <Field.Description>{$t('course.navItem.settings.enterprise.required_description')}</Field.Description>
        </Field.Content>
        <Switch
          id="course-required"
          checked={$settings.required ?? false}
          onCheckedChange={(checked) => {
            $settings.required = checked;
            hasUnsavedChanges = true;
          }}
        />
      </Field.Field>
    </Field.Group>
  </SettingsCard>

  <AttentionHighlight id="course-type" scrollBlock="center" class="scroll-mt-24">
    <SettingsCard hash="course-type" title={$t('course.navItem.settings.type')}>
      <Field.Group>
        <Field.Field>
          <Select.Root
            type="single"
            value={$settings.type}
            onValueChange={(value) => {
              if (value !== 'SELF_PACED' && value !== 'LIVE_CLASS' && value !== 'COMPLIANCE') return;

              $settings.type = value as TCourseType;
              delete courseApi.errors.type;
              hasUnsavedChanges = true;
            }}
          >
            <Select.Trigger class="w-full">
              {$settings.type === 'PUBLIC'
                ? $t('enterprise.course.legacy_public')
                : $t(`course.navItem.settings.${$settings.type.toLowerCase()}`)}
            </Select.Trigger>
            <Select.Content>
              <Select.Group>
                <Select.Item value="SELF_PACED" label={$t('course.navItem.settings.self_paced')}>
                  {$t('course.navItem.settings.self_paced')}
                </Select.Item>
                <Select.Item value="LIVE_CLASS" label={$t('course.navItem.settings.live_class')}>
                  {$t('course.navItem.settings.live_class')}
                </Select.Item>
                <Select.Item value="COMPLIANCE" label={$t('course.navItem.settings.compliance')}>
                  {$t('course.navItem.settings.compliance')}
                </Select.Item>
                {#if courseApi.course?.type === 'PUBLIC'}
                  <Select.Item value="PUBLIC" label={$t('enterprise.course.legacy_public')} disabled>
                    {$t('enterprise.course.legacy_public')}
                  </Select.Item>
                {/if}
              </Select.Group>
            </Select.Content>
          </Select.Root>
        </Field.Field>

        {#if courseApi.errors.type}
          <p class="ui:text-destructive/90 mt-2 text-sm">{courseApi.errors.type}</p>
        {/if}

        <AttentionHighlight
          id={ROUTE_SECTIONS[ROUTE_NAME.COURSE_SETTINGS].COMPLETION_DEADLINE}
          trigger={completionDeadlineTrigger}
          class="scroll-mt-24"
        >
          <Field.Field class="scroll-mt-24">
            <Field.Label>
              <a href="#{ROUTE_SECTIONS[ROUTE_NAME.COURSE_SETTINGS].COMPLETION_DEADLINE}" class="hover:underline">
                {$t('course.navItem.settings.completion_deadline_label')}
              </a>
            </Field.Label>
            <Input
              id="course-completion-deadline"
              type="datetime-local"
              class="w-full"
              value={isoToDatetimeLocal($settings.certificate.deadline)}
              onchange={onCompletionDeadlineChange}
            />
            <Field.Description>{$t('course.navItem.settings.completion_deadline_helper')}</Field.Description>
            {#if courseApi.errors['certificate.deadline']}
              <Field.Error>{courseApi.errors['certificate.deadline']}</Field.Error>
            {/if}
          </Field.Field>
        </AttentionHighlight>

        <Field.Field id="completion-threshold" class="scroll-mt-24">
          <Field.Label for="course-completion-threshold">
            <a href="#completion-threshold" class="hover:underline">{$t('course.certification.threshold_label')}</a>
          </Field.Label>
          <Input
            id="course-completion-threshold"
            type="number"
            min={0}
            max={100}
            class="w-full"
            value={String($settings.certificate.threshold)}
            oninput={onThresholdInput}
          />
          <Field.Description>{$t('course.certification.threshold_helper')}</Field.Description>
          {#if courseApi.errors['certificate.threshold']}
            <Field.Error>{courseApi.errors['certificate.threshold']}</Field.Error>
          {/if}
        </Field.Field>

        <Field.Field id="final-exercise" class="scroll-mt-24">
          <Field.Label>
            <a href="#final-exercise" class="hover:underline">{$t('course.certification.final_exercise_label')}</a>
          </Field.Label>
          <Select.Root
            type="single"
            value={$settings.certificate.requiredExerciseId ?? 'none'}
            onValueChange={onFinalExerciseChange}
          >
            <Select.Trigger class="w-full">
              {finalExerciseTitle ?? $t('course.certification.final_exercise_none')}
            </Select.Trigger>
            <Select.Content>
              <Select.Group>
                <Select.Item value="none" label={$t('course.certification.final_exercise_none')}>
                  {$t('course.certification.final_exercise_none')}
                </Select.Item>
                {#each certExercises as item (item.id)}
                  <Select.Item value={item.id} label={item.title}>
                    {item.title}
                  </Select.Item>
                {/each}
              </Select.Group>
            </Select.Content>
          </Select.Root>
          <Field.Description>{$t('course.certification.final_exercise_helper')}</Field.Description>
          <Field.Description>{$t('course.certification.final_exercise_multiple_attempts_note')}</Field.Description>
        </Field.Field>

        {#if $settings.certificate.requiredExerciseId}
          <Field.Field id="min-exercise-score" class="scroll-mt-24">
            <Field.Label for="course-min-exercise-score">
              <a href="#min-exercise-score" class="hover:underline"
                >{$t('course.certification.min_exercise_score_label')}</a
              >
            </Field.Label>
            <Input
              id="course-min-exercise-score"
              type="number"
              min={0}
              max={100}
              class="w-full"
              value={String($settings.certificate.exerciseMinScorePercent ?? 100)}
              oninput={onMinExerciseScoreInput}
            />
            <Field.Description>{$t('course.certification.min_exercise_score_helper')}</Field.Description>
            {#if courseApi.errors['certificate.exerciseMinScorePercent']}
              <Field.Error>{courseApi.errors['certificate.exerciseMinScorePercent']}</Field.Error>
            {/if}
          </Field.Field>
        {/if}
      </Field.Group>
    </SettingsCard>
  </AttentionHighlight>

  <SettingsCard id="content" title={$t('course.navItem.settings.content_card_title')}>
    <Field.Group>
      <Field.Field id="lesson-tabs" class="scroll-mt-24">
        <Field.Label>
          <a href="#lesson-tabs" class="hover:underline">{$t('course.navItem.settings.order')}</a>
        </Field.Label>
        <Field.Description>{$t('course.navItem.settings.drag')}</Field.Description>
        <ReorderMaterialTabs
          onchange={() => {
            hasUnsavedChanges = true;
          }}
        />
      </Field.Field>

      <SettingsSeparator />

      <Field.Field class="scroll-mt-24" orientation="horizontal">
        <Field.Content>
          <Field.Label for="content-grouping">
            <a href="#content-grouping" class="hover:underline"
              >{$t('course.navItem.settings.content_grouping_title')}</a
            >
          </Field.Label>
          <Field.Description>{$t('course.navItem.settings.content_grouping_description')}</Field.Description>
        </Field.Content>
        <Switch
          id="content-grouping"
          checked={$settings.isContentGroupingEnabled}
          onCheckedChange={(checked) => {
            $settings.isContentGroupingEnabled = checked;
            hasUnsavedChanges = true;
          }}
        />
      </Field.Field>

      <SettingsSeparator />

      <Field.Field id="progression-mode" class="scroll-mt-24">
        <Field.Label>
          <a href="#progression-mode" class="hover:underline">{$t('course.navItem.settings.progression_mode_title')}</a>
        </Field.Label>
        <Field.Description>{$t('course.navItem.settings.progression_mode_description')}</Field.Description>
        <RadioGroup.Root
          value={$settings.progressionMode}
          onValueChange={(value) => {
            if (value === 'free' || value === 'sequential') {
              $settings.progressionMode = value;
              hasUnsavedChanges = true;
            }
          }}
        >
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <RadioGroup.Item value="free" id="progression-free" />
              <Label for="progression-free">{$t('course.navItem.settings.progression_mode_free')}</Label>
            </div>
            <div class="flex items-center gap-2">
              <RadioGroup.Item value="sequential" id="progression-sequential" />
              <Label for="progression-sequential">{$t('course.navItem.settings.progression_mode_sequential')}</Label>
            </div>
          </div>
        </RadioGroup.Root>
      </Field.Field>

      <SettingsSeparator />

      <AttentionHighlight id={ROUTE_SECTIONS[ROUTE_NAME.COURSE_SETTINGS].COURSE_COMMENTS} class="scroll-mt-24">
        <Field.Field orientation="horizontal" class="scroll-mt-24">
          <Field.Content>
            <Field.Label>
              <a href="#{ROUTE_SECTIONS[ROUTE_NAME.COURSE_SETTINGS].COURSE_COMMENTS}" class="hover:underline"
                >{$t('course.navItem.settings.comments.title')}</a
              >
            </Field.Label>
            <Field.Description>{$t('course.navItem.settings.comments.description')}</Field.Description>
          </Field.Content>
          <Switch
            id="course-comments"
            checked={$settings.commentsEnabled}
            onCheckedChange={(checked) => {
              $settings.commentsEnabled = checked;
              hasUnsavedChanges = true;
            }}
          />
        </Field.Field>
      </AttentionHighlight>
    </Field.Group>
  </SettingsCard>

  <SettingsCard id="access" title={$t('course.navItem.settings.access_card_title')}>
    <Field.Group>
      <Field.Set id="publish" class="scroll-mt-24">
        <AttentionHighlight id="publish">
          <Field.Field orientation="horizontal">
            <Field.Content>
              <Field.Label for="is-published">
                <a href="#publish" class="hover:underline">{$t('course.navItem.settings.publish')}</a>
              </Field.Label>
              <Field.Description>{$t('course.navItem.settings.determines')}</Field.Description>
            </Field.Content>
            <Switch id="is-published" checked={$settings.isPublished} onCheckedChange={onPublishToggle} />
          </Field.Field>
        </AttentionHighlight>

        {#if showLockedContentNotice}
          <Alert.Root variant={isLiveClassCourse ? 'information' : 'warning'}>
            <LockOpenIcon />
            <Alert.Title>
              {$t('course.navItem.settings.locked_content.title', { count: lockedContentItems.length })}
            </Alert.Title>
            <Alert.Description>
              {isLiveClassCourse
                ? $t('course.navItem.settings.locked_content.description_live')
                : $t('course.navItem.settings.locked_content.description')}
              <Button
                variant="outline"
                size="sm"
                class="mt-2 w-fit"
                loading={isUnlockingAll}
                disabled={isUnlockingAll}
                onclick={handleUnlockAllContent}
              >
                {$t('course.navItem.settings.locked_content.unlock_all')}
              </Button>
            </Alert.Description>
          </Alert.Root>
        {/if}
      </Field.Set>

      <SettingsSeparator />

      <Field.Field class="scroll-mt-24" orientation="horizontal">
        <Field.Content>
          <Field.Label for="lesson-download">
            <a href="#lesson-download" class="hover:underline">{$t('course.navItem.settings.lesson_download')}</a>
          </Field.Label>
          <Field.Description>{$t('course.navItem.settings.available')}</Field.Description>
        </Field.Content>
        <Switch
          id="lesson-download"
          checked={$settings.lessonDownload}
          onCheckedChange={(checked) => {
            $settings.lessonDownload = checked;
            hasUnsavedChanges = true;
          }}
        />
      </Field.Field>
    </Field.Group>
  </SettingsCard>

  <SettingsCard
    id="delete"
    title={$t('course.navItem.settings.delete')}
    description={$t('course.navItem.settings.delete_text')}
  >
    <Button
      variant="destructive"
      onclick={() => (openDeleteModal = true)}
      loading={isDeleting}
      disabled={isDeleting}
      class="w-fit!"
    >
      {$t('course.navItem.settings.delete')}
    </Button>
  </SettingsCard>
</div>
