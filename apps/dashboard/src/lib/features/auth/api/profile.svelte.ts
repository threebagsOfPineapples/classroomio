import { BaseApiWithErrors, classroomio } from '$lib/utils/services/api';
import type { TLocale, TProfile } from '@cio/db/types';
import { ZChangeEmail, ZChangeLoginEmail, ZProfileUpdateForm } from '@cio/utils/validation/account';

import type { ChangeLoginEmailRequest, TChangeEmailForm, TProfileUpdateForm } from '../utils/types';
import { PUBLIC_IS_SELFHOSTED } from '$env/static/public';
import { get } from 'svelte/store';
import { authClient } from '$lib/utils/services/auth/client';
import { handleLocaleChange } from '$lib/utils/functions/translations';
import { mapZodErrorsToTranslations } from '$lib/utils/validation';
import { profile as profileStore, user } from '$lib/utils/store/user';
import { snackbar } from '$features/ui/snackbar/store';
import { t } from '$lib/utils/functions/translations';
import { uploadImage } from '$lib/utils/services/upload';

export class ProfileApi extends BaseApiWithErrors {
  private validateForm(fields: TProfileUpdateForm): boolean {
    const validationData = {
      fullname: fields.fullname,
      username: fields.username,
      locale: fields.locale
    };

    const result = ZProfileUpdateForm.safeParse(validationData);
    if (!result.success) {
      this.errors = mapZodErrorsToTranslations(result.error);
      return false;
    }
    return true;
  }

  private async updateUserInfo(fields: TProfileUpdateForm, avatarUrl?: string): Promise<void> {
    const userUpdates: { name?: string; image?: string } = {};

    userUpdates.name = fields.fullname;
    if (avatarUrl) {
      userUpdates.image = avatarUrl;
    }

    if (Object.keys(userUpdates).length > 0) {
      const { error: userError } = await authClient.updateUser(userUpdates);
      if (userError) throw userError;
    }
  }

  private buildProfileUpdates(
    fields: TProfileUpdateForm,
    locale: TLocale | undefined,
    avatarUrl?: string
  ): Partial<TProfile> {
    const profileUpdates: Partial<TProfile> = {};

    profileUpdates.fullname = fields.fullname;

    profileUpdates.username = fields.username;

    profileUpdates.locale = locale;

    if (avatarUrl) {
      profileUpdates.avatarUrl = avatarUrl;
    }

    return profileUpdates;
  }

  private async updateProfile(profileUpdates: Partial<TProfile>): Promise<void> {
    if (Object.keys(profileUpdates).length === 0) {
      return;
    }

    await this.execute<typeof classroomio.account.profile.$put>({
      requestFn: () => classroomio.account.profile.$put({ json: profileUpdates }),
      logContext: 'updating profile',
      onSuccess: (response) => {
        profileStore.update((_profile) => ({
          ..._profile,
          ...response.profile
        }));
      }
    });
  }

  private handleError(error: unknown): void {
    console.error(error);
    const message = error instanceof Error ? error.message : `${error}`;

    if (message.includes('profile_username_key')) {
      this.errors.username = t.get('snackbar.lms.error.username_exists');
      snackbar.error('snackbar.lms.error.username_exists');
    } else {
      this.errors.general = message;
      snackbar.error(`${t.get('snackbar.update_failed')}: ${message}`);
    }
  }

  async submit(fields: TProfileUpdateForm, hasLangChanged: boolean, locale?: TLocale) {
    if (!this.validateForm(fields)) {
      return;
    }

    try {
      this.isLoading = true;
      this.errors = {};
      this.success = false;

      // Handle avatar upload if provided
      let avatarUrl: string | undefined;
      if (fields.avatar instanceof File) {
        avatarUrl = await uploadImage(fields.avatar);
      }

      // Update user info via Better Auth (name and image)
      await this.updateUserInfo(fields, avatarUrl);

      // Update profile-specific fields via API route
      const profileUpdates = this.buildProfileUpdates(fields, locale, avatarUrl);
      await this.updateProfile(profileUpdates);

      // Handle locale change if needed
      if (hasLangChanged && locale) {
        handleLocaleChange(locale);
      }

      snackbar.success('snackbar.course_settings.success.update_successful');
      this.success = true;
    } catch (error) {
      this.handleError(error);
    } finally {
      this.isLoading = false;
    }
  }

  async changeEmail(fields: TChangeEmailForm) {
    this.success = false;
    this.errors = {};

    if (PUBLIC_IS_SELFHOSTED === 'true') {
      const result = ZChangeLoginEmail.safeParse(fields);
      if (!result.success) {
        this.errors = mapZodErrorsToTranslations(result.error);
        for (const issue of result.error.issues) {
          if (issue.message.startsWith('settings.') || issue.message.startsWith('validations.')) {
            this.errors[issue.path.join('.')] = t.get(issue.message);
          }
        }
        return;
      }

      const hasPassword = get(user).hasCredentialPassword;
      const passwordField = hasPassword ? 'currentPassword' : 'newPassword';
      if (!result.data[passwordField]) {
        this.errors[passwordField] = 'settings.profile.login_account.password_required';
        return;
      }

      await this.execute<ChangeLoginEmailRequest>({
        requestFn: async () => {
          const response = await classroomio.account['login-email'].$put({ json: result.data });
          if (response.status === 429) {
            throw new Error('settings.profile.login_account.rate_limit');
          }

          return response;
        },
        logContext: 'updating login email',
        onSuccess: async (response) => {
          profileStore.set(response.data.profile);
          user.update((currentUser) => ({
            ...currentUser,
            hasCredentialPassword: response.data.hasCredentialPassword
          }));
          await authClient.getSession({ query: { disableCookieCache: true } });
          snackbar.success('settings.profile.login_account.saved');
        },
        onError: (error) => {
          const message = typeof error === 'string' ? error : error.error;
          const field = typeof error === 'string' ? 'general' : error.field || 'general';
          this.errors[field] = message;
          snackbar.error(message);
        }
      });
      return;
    }

    const result = ZChangeEmail.safeParse({ newEmail: fields.newEmail });
    if (!result.success) {
      this.errors = mapZodErrorsToTranslations(result.error);
      return;
    }

    try {
      this.isLoading = true;
      this.errors = {};
      this.success = false;

      const { error } = await authClient.changeEmail({
        newEmail: fields.newEmail,
        callbackURL: fields.callbackURL
      });

      if (error) throw new Error(error.message);

      snackbar.success();
      this.success = true;
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : `${error}`;

      this.errors.email = message;
      snackbar.error(`${t.get('snackbar.update_failed')}: ${message}`);
    } finally {
      this.isLoading = false;
    }
  }
}

export const profileApi = new ProfileApi();
