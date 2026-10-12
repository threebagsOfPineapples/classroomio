import * as z from 'zod';
import { ZPassword } from '@cio/utils/validation/auth/password';
import { authClient } from '$lib/utils/services/auth/client';
import { classroomio, type InferRequestType } from '$lib/utils/services/api';
import type { TProfileUpdateForm as TProfileUpdateFormSchema } from '@cio/utils/validation/account';

export type TProfileUpdateForm = Omit<TProfileUpdateFormSchema, 'avatarUrl'> & {
  avatar?: string | File;
};
export type ChangeLoginEmailRequest = (typeof classroomio.account)['login-email']['$put'];
export type TChangeEmailForm = InferRequestType<ChangeLoginEmailRequest>['json'] & { callbackURL?: string };

export type DingtalkEmployeeRequest = typeof authClient.dingtalk.employee;
export type DingtalkEmployeeResponse = NonNullable<Awaited<ReturnType<DingtalkEmployeeRequest>>['data']>;
export type DingtalkEmployee = Extract<DingtalkEmployeeResponse, { linked: boolean }>['employee'];

export const ZForgotPasswordForm = z.object({
  email: z.email()
});
export type TForgotPasswordForm = z.infer<typeof ZForgotPasswordForm>;

export const ZResetPasswordForm = z.object({
  password: ZPassword,
  confirmPassword: ZPassword,
  token: z.string()
});
export type TResetPasswordForm = z.infer<typeof ZResetPasswordForm>;
