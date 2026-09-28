import * as z from 'zod';
import { ZPassword } from '@cio/utils/validation/auth/password';
import { authClient } from '$lib/utils/services/auth/client';

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
