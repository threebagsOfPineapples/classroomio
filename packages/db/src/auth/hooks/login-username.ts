import { APIError } from 'better-auth/api';
import { getLoginEmailByUsername } from '../../queries/auth/login-account';
import type { AuthMiddlewareContext } from './index';

export async function resolveLoginUsername(context: AuthMiddlewareContext) {
  if (
    process.env.PUBLIC_IS_SELFHOSTED !== 'true' ||
    context.path !== '/sign-in/email' ||
    typeof context.body?.email !== 'string' ||
    typeof context.body?.password !== 'string' ||
    context.body.email.includes('@')
  ) {
    return;
  }

  const username = context.body.email.trim();
  const email = username.length > 0 && username.length <= 256 ? await getLoginEmailByUsername(username) : undefined;
  if (!email) {
    await context.context.password.hash(context.body.password);
    throw new APIError('UNAUTHORIZED', { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' });
  }

  return { context: { body: { ...context.body, email } } };
}
