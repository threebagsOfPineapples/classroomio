import {
  ZDingtalkAppToken,
  ZDingtalkConfig,
  ZDingtalkMember,
  ZDingtalkPersonalInfo,
  ZDingtalkToken,
  ZDingtalkUserId,
  type TDingtalkConfig,
  type TDingtalkError
} from '@cio/utils/validation/auth/dingtalk';
import { createHash } from 'node:crypto';
import type { getDingtalkMember } from '../queries/auth/dingtalk';

export class DingtalkError extends Error {
  constructor(public readonly code: TDingtalkError) {
    super(code);
  }
}

export function isActiveDingtalkMember(record: Awaited<ReturnType<typeof getDingtalkMember>>[number] | undefined) {
  if (!record) return false;

  const banExpired = !!record.user.banExpires && record.user.banExpires.getTime() < Date.now();
  return (
    record.member.status === 'ACTIVE' &&
    record.member.employmentStatus !== 'TERMINATED' &&
    (!record.user.banned || banExpired) &&
    !record.user.isAnonymous
  );
}

export function getDingtalkConfig(environment = process.env): TDingtalkConfig | null {
  if (environment.DINGTALK_ENABLED !== 'true') return null;

  const result = ZDingtalkConfig.safeParse({
    corpId: environment.DINGTALK_CORP_ID,
    clientId: environment.DINGTALK_CLIENT_ID,
    clientSecret: environment.DINGTALK_CLIENT_SECRET,
    organizationId: environment.DINGTALK_ORGANIZATION_ID,
    redirectUri: environment.DINGTALK_REDIRECT_URI
  });
  if (!result.success) return null;

  const dashboardOrigin = environment.DASHBOARD_ORIGIN;
  if (!dashboardOrigin || new URL(result.data.redirectUri).origin !== dashboardOrigin.replace(/\/$/, '')) return null;

  return result.data;
}

export function getDingtalkAuthorizeUrl(config: TDingtalkConfig, state: string) {
  const url = new URL('https://login.dingtalk.com/oauth2/auth');
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid corpid',
    prompt: 'consent',
    state
  }).toString();
  return url.href;
}

async function requestDingtalk(url: string, options: RequestInit): Promise<unknown> {
  try {
    const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new DingtalkError('provider_error');

    return await response.json();
  } catch {
    if (url.startsWith('https://oapi.dingtalk.com/')) appToken = null;

    throw new DingtalkError('provider_error');
  }
}

async function postDingtalk(url: string, fields: Record<string, string>) {
  const body = JSON.stringify(fields);
  return requestDingtalk(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
}

let appToken: { key: string; value: string; expiresAt: number } | null = null;

async function getAppToken(config: TDingtalkConfig) {
  const key = createHash('sha256').update(config.clientId).update(config.clientSecret).digest('hex');
  if (appToken?.key === key && appToken.expiresAt > Date.now()) return appToken.value;

  const response = await postDingtalk('https://api.dingtalk.com/v1.0/oauth2/accessToken', {
    appKey: config.clientId,
    appSecret: config.clientSecret
  });
  const parsed = ZDingtalkAppToken.safeParse(response);
  if (!parsed.success) throw new DingtalkError('provider_error');

  const expiresAt = Date.now() + Math.max(0, parsed.data.expireIn - 60) * 1000;
  appToken = { key, value: parsed.data.accessToken, expiresAt };
  return appToken.value;
}

export async function getDingtalkEmployee(config: TDingtalkConfig, userId: string) {
  const token = await getAppToken(config);
  const url = new URL('https://oapi.dingtalk.com/topapi/v2/user/get');
  url.searchParams.set('access_token', token);
  const response = await postDingtalk(url.href, { userid: userId, language: 'zh_CN' });
  const parsed = ZDingtalkMember.safeParse(response);
  if (!parsed.success || parsed.data.result.userid !== userId) {
    appToken = null;
    throw new DingtalkError('provider_error');
  }

  const employee = parsed.data.result;
  return {
    userId: employee.userid,
    unionId: employee.unionid,
    name: employee.name,
    mobile: employee.mobile || null,
    companyEmail: employee.org_email || null,
    employeeNo: employee.job_number || null,
    position: employee.title || null,
    departmentIds: employee.dept_id_list ?? []
  };
}

export async function getDingtalkIdentity(config: TDingtalkConfig, code: string) {
  const tokenResponse = await postDingtalk('https://api.dingtalk.com/v1.0/oauth2/userAccessToken', {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    code,
    grantType: 'authorization_code'
  });
  const token = ZDingtalkToken.safeParse(tokenResponse);
  if (!token.success) throw new DingtalkError('provider_error');
  if (token.data.corpId !== config.corpId) throw new DingtalkError('wrong_company');

  const personalResponse = await requestDingtalk('https://api.dingtalk.com/v1.0/contact/users/me', {
    headers: { 'x-acs-dingtalk-access-token': token.data.accessToken }
  });
  const personal = ZDingtalkPersonalInfo.safeParse(personalResponse);
  if (!personal.success) throw new DingtalkError('provider_error');

  const appAccessToken = await getAppToken(config);
  const lookupUrl = new URL('https://oapi.dingtalk.com/topapi/user/getbyunionid');
  lookupUrl.searchParams.set('access_token', appAccessToken);
  const lookupResponse = await postDingtalk(lookupUrl.href, { unionid: personal.data.unionId });
  const lookup = ZDingtalkUserId.safeParse(lookupResponse);
  if (!lookup.success) {
    appToken = null;
    throw new DingtalkError('provider_error');
  }

  const employee = await getDingtalkEmployee(config, lookup.data.result.userid);
  if (employee.unionId !== personal.data.unionId) throw new DingtalkError('provider_error');

  return employee;
}
