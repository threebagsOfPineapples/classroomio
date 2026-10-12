import * as z from 'zod';
import { ZPassword } from '../auth/password';

export const ZUpdateProfile = z.object({
  fullname: z.string().min(3).optional(),
  username: z.string().min(3).optional(),
  locale: z.enum(['en', 'hi', 'fr', 'pt', 'de', 'vi', 'ru', 'es', 'pl', 'da', 'zh']).optional(),
  avatarUrl: z.url().optional()
});

export type TUpdateProfile = z.infer<typeof ZUpdateProfile>;

// Form validation schema - requires fullname and username
export const ZProfileUpdateForm = ZUpdateProfile.extend({
  fullname: z.string().min(5),
  username: z.string().min(1)
});

export type TProfileUpdateForm = z.infer<typeof ZProfileUpdateForm>;

// Email change validation schema
export const ZChangeEmail = z.object({
  newEmail: z.email()
});

export type TChangeEmail = z.infer<typeof ZChangeEmail>;

export const ZChangeLoginEmail = z
  .object({
    newEmail: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email())
      .refine((email) => !email.endsWith('@zz-train.invalid'), {
        message: 'settings.profile.login_account.reserved_email'
      }),
    currentPassword: z.string().max(128).optional(),
    newPassword: ZPassword.max(128)
      .refine((password) => new TextEncoder().encode(password).length <= 72, {
        message: 'settings.profile.login_account.password_too_long'
      })
      .optional(),
    confirmPassword: z.string().max(128).optional()
  })
  .refine((fields) => fields.newPassword === fields.confirmPassword, {
    path: ['confirmPassword'],
    message: 'validations.confirm_password.not_match'
  });

export type TChangeLoginEmail = z.infer<typeof ZChangeLoginEmail>;
