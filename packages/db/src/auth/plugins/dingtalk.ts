import { APIError, createAuthEndpoint, getSessionFromCtx } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import type { BetterAuthPlugin } from 'better-auth';
import { randomBytes } from 'node:crypto';
import { ZDingtalkStart, ZDingtalkState, type TDingtalkError } from '@cio/utils/validation/auth/dingtalk';
import {
  bindDingtalkMember,
  consumeDingtalkState,
  findDingtalkMember,
  getDingtalkMember,
  saveDingtalkState
} from '../../queries/auth/dingtalk';
import {
  DingtalkError,
  getDingtalkAuthorizeUrl,
  getDingtalkConfig,
  getDingtalkEmployee,
  getDingtalkIdentity,
  isActiveDingtalkMember
} from '../dingtalk';

function requireConfig() {
  const config = getDingtalkConfig();
  if (!config) throw new DingtalkError('disabled');

  return config;
}

function requireActiveMember(record: Awaited<ReturnType<typeof getDingtalkMember>>[number] | undefined) {
  if (!record || !isActiveDingtalkMember(record)) throw new DingtalkError('member_inactive');

  return record;
}

function errorCode(error: unknown): TDingtalkError {
  if (error instanceof DingtalkError) return error.code;
  if (error && typeof error === 'object' && 'cause' in error) {
    const cause = error.cause;
    if (cause && typeof cause === 'object' && 'code' in cause && cause.code === '23505') return 'account_conflict';
  }

  return 'provider_error';
}

export function dingtalk() {
  return {
    id: 'dingtalk',
    endpoints: {
      dingtalkConfig: createAuthEndpoint(
        '/dingtalk/config',
        { method: 'GET', query: ZDingtalkStart.pick({ organizationId: true }) },
        async (context) => {
          const config = getDingtalkConfig();
          const enabled =
            !!config && (!context.query.organizationId || config.organizationId === context.query.organizationId);
          return context.json({ enabled });
        }
      ),
      dingtalkStart: createAuthEndpoint(
        '/dingtalk/start',
        { method: 'POST', body: ZDingtalkStart, requireHeaders: true },
        async (context) => {
          try {
            const config = requireConfig();
            const origin = new URL(config.redirectUri).origin;
            if (
              context.headers?.get('origin') !== origin ||
              (context.body.organizationId && context.body.organizationId !== config.organizationId)
            ) {
              throw new DingtalkError('wrong_company');
            }

            let profileId: string | null = null;
            if (context.body.intent === 'link') {
              const current = await getSessionFromCtx(context, { disableCookieCache: true });
              if (!current || Date.now() - new Date(current.session.createdAt).getTime() > 5 * 60_000) {
                throw new DingtalkError('reauth_required');
              }

              const [record] = await getDingtalkMember(config.organizationId, current.user.id);
              requireActiveMember(record);
              profileId = current.user.id;
            }

            const state = randomBytes(32).toString('hex');
            await saveDingtalkState(state, {
              organizationId: config.organizationId,
              intent: context.body.intent,
              profileId,
              clientId: config.clientId,
              corpId: config.corpId
            });
            const secure = origin.startsWith('https:');
            const cookie = context.context.createAuthCookie('dingtalk_state', {
              path: '/',
              httpOnly: true,
              sameSite: 'lax',
              secure,
              maxAge: 300
            });
            context.setCookie(cookie.name, state, cookie.attributes);
            const url = getDingtalkAuthorizeUrl(config, state);
            return context.json({ url });
          } catch (error) {
            const code = errorCode(error);
            throw new APIError('FORBIDDEN', { code, message: code });
          }
        }
      ),
      dingtalkCallback: createAuthEndpoint('/dingtalk/callback', { method: 'GET' }, async (context) => {
        let destination = '/login';
        try {
          const config = requireConfig();
          const origin = new URL(config.redirectUri).origin;
          destination = `${origin}/login`;
          const url = new URL(context.request?.url ?? config.redirectUri);
          const state = url.searchParams.get('state') ?? '';
          const secure = origin.startsWith('https:');
          const cookie = context.context.createAuthCookie('dingtalk_state', {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure,
            maxAge: 300
          });
          if (!/^[a-f0-9]{64}$/.test(state) || context.getCookie(cookie.name) !== state) {
            throw new DingtalkError('invalid_state');
          }

          context.setCookie(cookie.name, '', { ...cookie.attributes, maxAge: 0 });
          const serialized = await consumeDingtalkState(state);
          if (!serialized) throw new DingtalkError('invalid_state');

          const stored = ZDingtalkState.parse(JSON.parse(serialized));
          if (
            stored.organizationId !== config.organizationId ||
            stored.corpId !== config.corpId ||
            stored.clientId !== config.clientId
          ) {
            throw new DingtalkError('invalid_state');
          }

          if (stored.intent === 'link') destination = `${origin}/lms/settings/integrations`;

          const code = url.searchParams.get('authCode');
          if (!code || code.length > 2048 || url.searchParams.has('error')) throw new DingtalkError('provider_error');

          const employee = await getDingtalkIdentity(config, code);
          if (stored.intent === 'link') {
            const current = await getSessionFromCtx(context, { disableCookieCache: true });
            if (
              !current ||
              current.user.id !== stored.profileId ||
              Date.now() - new Date(current.session.createdAt).getTime() > 10 * 60_000
            ) {
              throw new DingtalkError('reauth_required');
            }

            const result = await bindDingtalkMember(
              config.organizationId,
              current.user.id,
              config.corpId,
              employee.userId
            );
            if (result !== 'linked') throw new DingtalkError(result);

            destination += '?dingtalk_linked=1';
          } else {
            const [record] = await findDingtalkMember(config.organizationId, config.corpId, employee.userId);
            if (!record) throw new DingtalkError('link_required');

            requireActiveMember(record);
            const session = await context.context.internalAdapter.createSession(record.user.id);
            if (!session) throw new DingtalkError('member_inactive');

            await setSessionCookie(context, { session, user: record.user });
            destination = `${origin}/lms`;
          }
        } catch (error) {
          const code = errorCode(error);
          const separator = destination.includes('?') ? '&' : '?';
          destination += `${separator}dingtalk_error=${code}`;
        }

        context.setHeader('Cache-Control', 'no-store');
        context.setHeader('Referrer-Policy', 'no-referrer');
        return context.redirect(destination);
      }),
      dingtalkEmployee: createAuthEndpoint(
        '/dingtalk/employee',
        { method: 'GET', requireHeaders: true },
        async (context) => {
          try {
            const config = requireConfig();
            const current = await getSessionFromCtx(context, { disableCookieCache: true });
            if (!current) throw new DingtalkError('reauth_required');

            const [record] = await getDingtalkMember(config.organizationId, current.user.id);
            const active = requireActiveMember(record);
            context.setHeader('Cache-Control', 'no-store');
            if (active.member.externalSource !== `dingtalk:${config.corpId}` || !active.member.externalId) {
              return context.json({ linked: false, employee: null });
            }

            const employee = await getDingtalkEmployee(config, active.member.externalId);
            return context.json({ linked: true, employee });
          } catch (error) {
            const code = errorCode(error);
            throw new APIError('FORBIDDEN', { code, message: code });
          }
        }
      )
    }
  } satisfies BetterAuthPlugin;
}
