<script lang="ts">
  import { page } from '$app/state';
  import type { TLocale } from '@cio/db/types';
  import { profile, user } from '$lib/utils/store/user';
  import { PUBLIC_IS_SELFHOSTED } from '$env/static/public';
  import { CircleCheckBig } from '@lucide/svelte';
  import { profileApi } from '$features/auth/api/profile.svelte';
  import { t } from '$lib/utils/functions/translations';
  import { Input } from '@cio/ui/base/input';
  import { Button } from '@cio/ui/base/button';
  import { UploadImage, UnsavedChanges } from '$features/ui';
  import * as Field from '@cio/ui/base/field';

  interface Props {
    hasUnsavedChanges?: boolean;
  }

  let { hasUnsavedChanges = $bindable(false) }: Props = $props();

  let avatar = $state<string | File | undefined>();
  let hasLangChanged = $state(false);
  let locale = $derived<TLocale | undefined>($profile.locale || undefined);
  let savedFullname = $state('');
  let savedUsername = $state('');
  let savedLocale = $state<TLocale | undefined>(undefined);
  let capturedProfileId = $state<string | null>(null);
  const isSelfHosted = PUBLIC_IS_SELFHOSTED === 'true';
  const displayEmail = $derived(
    $profile.email?.toLowerCase().endsWith('@zz-train.invalid') ? '' : $profile.email || ''
  );
  let email = $derived(displayEmail);
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let isChangingEmail = $state(false);
  let emailChangeInitiated = $state(false);

  export async function handleUpdate() {
    if (
      isSelfHosted &&
      (email.trim().toLowerCase() !== displayEmail.trim().toLowerCase() || newPassword || confirmPassword)
    ) {
      await profileApi.changeEmail({
        newEmail: email,
        currentPassword: $user.hasCredentialPassword ? currentPassword : undefined,
        newPassword: $user.hasCredentialPassword ? undefined : newPassword,
        confirmPassword: $user.hasCredentialPassword ? undefined : confirmPassword
      });
      if (!profileApi.success) {
        return;
      }

      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
      email = displayEmail;
    }

    if (
      isSelfHosted &&
      $profile.fullname === savedFullname &&
      $profile.username === savedUsername &&
      locale === savedLocale &&
      !avatar
    ) {
      hasUnsavedChanges = false;
      return;
    }

    await profileApi.submit(
      {
        fullname: $profile.fullname,
        username: $profile.username,
        locale,
        avatar
      },
      hasLangChanged,
      locale
    );

    if (profileApi.success) {
      hasUnsavedChanges = false;
      avatar = undefined;
      captureSavedFields();
    }
  }

  async function handleEmailChange() {
    if (email === $profile.email) {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('trigger', 'app');

    await profileApi.changeEmail({
      newEmail: email,
      callbackURL: url.toString()
    });

    if (profileApi.success) {
      isChangingEmail = false;
      emailChangeInitiated = true;
      // Reset email field to current email after successful change request
      email = $profile.email || '';
    }
  }

  const isVerificationSent = $derived(page.url.searchParams.get('trigger') === 'app');

  function captureSavedFields() {
    savedFullname = $profile.fullname;
    savedUsername = $profile.username;
    savedLocale = $profile.locale || undefined;
  }

  $effect(() => {
    if (!$profile.id) return;

    if (capturedProfileId !== $profile.id) {
      capturedProfileId = $profile.id;
      captureSavedFields();
    }
  });

  export function handleDiscard() {
    $profile.fullname = savedFullname;
    $profile.username = savedUsername;
    $profile.locale = savedLocale;
    avatar = undefined;
    hasLangChanged = false;
    hasUnsavedChanges = false;
    profileApi.errors = {};
    email = displayEmail;
    currentPassword = '';
    newPassword = '';
    confirmPassword = '';
  }
</script>

<UnsavedChanges bind:hasUnsavedChanges />

<Field.Group class="w-full max-w-md! px-2">
  <Field.Set>
    <Field.Legend>{$t('settings.profile.profile_picture.heading')}</Field.Legend>
    <Field.Field>
      <UploadImage
        bind:avatar
        src={$profile.avatarUrl}
        widthHeight="w-16 h-16 lg:w-24 lg:h-24"
        isDisabled={profileApi.isLoading}
        change={() => (hasUnsavedChanges = true)}
      />
    </Field.Field>
  </Field.Set>

  <Field.Separator />

  <Field.Set>
    <Field.Legend>{$t('settings.profile.personal_information.heading')}</Field.Legend>

    {#if !isSelfHosted && isVerificationSent}
      <div class="flex items-center gap-2 rounded-md border border-gray-200 p-2 text-green-500">
        <CircleCheckBig class="size-8" />
        <p class="text-sm">{$t('settings.profile.personal_information.email_change_verification_sent')}</p>
      </div>
    {/if}

    <Field.Group>
      <Field.Field>
        <Field.Label for="profile-fullname">{$t('settings.profile.personal_information.full_name')}</Field.Label>
        <Input
          id="profile-fullname"
          name="fullname"
          autocomplete="name"
          bind:value={$profile.fullname}
          oninput={() => (hasUnsavedChanges = true)}
        />
        {#if profileApi.errors.fullname}
          <Field.Error>{$t(profileApi.errors.fullname)}</Field.Error>
        {/if}
      </Field.Field>
      <Field.Field>
        <Field.Label for="profile-username">{$t('settings.profile.personal_information.username')}</Field.Label>
        <Input
          id="profile-username"
          name="username"
          autocomplete="username"
          bind:value={$profile.username}
          oninput={() => (hasUnsavedChanges = true)}
        />
        {#if profileApi.errors.username}
          <Field.Error>{$t(profileApi.errors.username)}</Field.Error>
        {/if}
      </Field.Field>
      <Field.Field>
        <Field.Label for="profile-email"
          >{$t(
            isSelfHosted ? 'settings.profile.login_account.email' : 'settings.profile.personal_information.email'
          )}</Field.Label
        >
        <Input
          id="profile-email"
          name="email"
          autocomplete="email"
          bind:value={email}
          class="w-full"
          type="email"
          disabled={profileApi.isLoading}
          oninput={() => {
            if (isSelfHosted) {
              hasUnsavedChanges = true;
              return;
            }

            if (email !== $profile.email) {
              isChangingEmail = true;
              emailChangeInitiated = false;
            }
          }}
        />
        {#if profileApi.errors.newEmail}
          <Field.Error>{$t(profileApi.errors.newEmail)}</Field.Error>
        {/if}
        {#if isSelfHosted}
          <Field.Description>{$t('settings.profile.login_account.description')}</Field.Description>
        {/if}
        {#if !isSelfHosted && isChangingEmail && email !== $profile.email}
          <div class="mt-2 flex gap-2">
            <Button
              variant="default"
              class="text-sm"
              loading={profileApi.isLoading}
              disabled={profileApi.isLoading}
              onclick={handleEmailChange}
            >
              {$t('settings.profile.personal_information.confirm')}
            </Button>
            <Button
              variant="ghost"
              class="ui:text-primary text-sm"
              disabled={profileApi.isLoading}
              onclick={() => {
                email = $profile.email || '';
                isChangingEmail = false;
                emailChangeInitiated = false;
                profileApi.errors.newEmail = '';
              }}
            >
              {$t('settings.profile.personal_information.cancel')}
            </Button>
          </div>
        {/if}
        {#if !isSelfHosted && emailChangeInitiated}
          <div class="mt-2 flex items-center gap-2 rounded-md border border-gray-200 p-2 text-amber-500">
            <CircleCheckBig class="size-8" />
            <p class="text-sm">{$t('settings.profile.personal_information.email_change_verification_note')}</p>
          </div>
        {/if}
      </Field.Field>
      {#if isSelfHosted && $user.hasCredentialPassword && email.trim().toLowerCase() !== displayEmail
            .trim()
            .toLowerCase()}
        <Field.Field>
          <Field.Label for="profile-current-password"
            >{$t('settings.profile.login_account.current_password')}</Field.Label
          >
          <Input
            id="profile-current-password"
            type="password"
            autocomplete="current-password"
            bind:value={currentPassword}
            disabled={profileApi.isLoading}
            oninput={() => (hasUnsavedChanges = true)}
          />
          {#if profileApi.errors.currentPassword}
            <Field.Error>{$t(profileApi.errors.currentPassword)}</Field.Error>
          {/if}
        </Field.Field>
      {:else if isSelfHosted && !$user.hasCredentialPassword}
        <Field.Field>
          <Field.Label for="profile-new-password">{$t('settings.profile.login_account.new_password')}</Field.Label>
          <Input
            id="profile-new-password"
            type="password"
            autocomplete="new-password"
            bind:value={newPassword}
            disabled={profileApi.isLoading}
            oninput={() => (hasUnsavedChanges = true)}
          />
          <Field.Description>{$t('settings.profile.login_account.first_password')}</Field.Description>
          {#if profileApi.errors.newPassword}
            <Field.Error>{$t(profileApi.errors.newPassword)}</Field.Error>
          {/if}
        </Field.Field>
        <Field.Field>
          <Field.Label for="profile-confirm-password"
            >{$t('settings.profile.login_account.confirm_password')}</Field.Label
          >
          <Input
            id="profile-confirm-password"
            type="password"
            autocomplete="new-password"
            bind:value={confirmPassword}
            disabled={profileApi.isLoading}
            oninput={() => (hasUnsavedChanges = true)}
          />
          {#if profileApi.errors.confirmPassword}
            <Field.Error>{$t(profileApi.errors.confirmPassword)}</Field.Error>
          {/if}
        </Field.Field>
      {/if}
      {#if profileApi.errors.general}
        <Field.Error>{$t(profileApi.errors.general)}</Field.Error>
      {/if}
    </Field.Group>
  </Field.Set>
</Field.Group>
