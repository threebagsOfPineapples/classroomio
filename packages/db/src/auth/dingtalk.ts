import {
  ZDingtalkAppToken,
  ZDingtalkConfig,
  ZDingtalkMember,
  ZDingtalkPersonalInfo,
  ZDingtalkToken,
  ZDingtalkUserId,
  ZDingtalkDirectory,
  ZDingtalkRawRootDepartment,
  ZDingtalkRawDepartments,
  ZDingtalkRawEmployeePage,
  type TDingtalkRawEmployee,
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

async function postDingtalk(url: string, fields: Record<string, unknown>) {
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

export class DingtalkDirectoryError extends Error {
  constructor(public readonly code: 'permissions' | 'provider_error' | 'invalid_directory') {
    super(code);
  }
}

async function readDirectoryApi(config: TDingtalkConfig, path: string, fields: Record<string, unknown>) {
  const token = await getAppToken(config);
  const url = new URL(path, 'https://oapi.dingtalk.com');
  url.searchParams.set('access_token', token);
  const response = await postDingtalk(url.href, fields);
  if (!response || typeof response !== 'object' || !('errcode' in response) || response.errcode !== 0) {
    const message = response && typeof response === 'object' && 'errmsg' in response ? String(response.errmsg) : '';
    const missingPermission = message.includes('requiredScopes') || message.includes('60011');
    throw new DingtalkDirectoryError(missingPermission ? 'permissions' : 'provider_error');
  }

  if (!('result' in response)) throw new DingtalkDirectoryError('invalid_directory');

  return response.result;
}

export async function getDingtalkDirectory(config: TDingtalkConfig) {
  const rootResponse = await readDirectoryApi(config, '/topapi/v2/department/get', { dept_id: 1, language: 'zh_CN' });
  const parsedRoot = ZDingtalkRawRootDepartment.safeParse(rootResponse);
  if (!parsedRoot.success) throw new DingtalkDirectoryError('invalid_directory');

  const root = { ...parsedRoot.data, parent_id: 0 };
  if (root.dept_id !== 1) throw new DingtalkDirectoryError('invalid_directory');

  const departmentRows = [root];
  const knownDepartmentIds = new Set([root.dept_id]);
  const employeeRows = new Map<string, TDingtalkRawEmployee>();
  const deadline = Date.now() + 90_000;
  for (const departmentRow of departmentRows) {
    if (Date.now() > deadline || departmentRows.length > 1000) throw new DingtalkDirectoryError('invalid_directory');

    const childrenResponse = await readDirectoryApi(config, '/topapi/v2/department/listsub', {
      dept_id: departmentRow.dept_id,
      language: 'zh_CN'
    });
    const parsedChildren = ZDingtalkRawDepartments.safeParse(childrenResponse);
    if (!parsedChildren.success) throw new DingtalkDirectoryError('invalid_directory');

    const children = parsedChildren.data;
    for (const child of children) {
      if (knownDepartmentIds.has(child.dept_id) || child.parent_id !== departmentRow.dept_id)
        throw new DingtalkDirectoryError('invalid_directory');

      knownDepartmentIds.add(child.dept_id);
      departmentRows.push(child);
    }

    let cursor = 0;
    const visitedCursors = new Set<number>();
    while (true) {
      if (Date.now() > deadline || visitedCursors.has(cursor)) throw new DingtalkDirectoryError('invalid_directory');

      visitedCursors.add(cursor);
      const pageResponse = await readDirectoryApi(config, '/topapi/v2/user/list', {
        dept_id: departmentRow.dept_id,
        cursor,
        size: 100,
        contain_access_limit: false,
        language: 'zh_CN'
      });
      const parsedPage = ZDingtalkRawEmployeePage.safeParse(pageResponse);
      if (!parsedPage.success) throw new DingtalkDirectoryError('invalid_directory');

      const page = parsedPage.data;
      for (const employee of page.list) {
        const previous = employeeRows.get(employee.userid);
        if (previous && JSON.stringify(previous) !== JSON.stringify(employee))
          throw new DingtalkDirectoryError('invalid_directory');

        if (!employee.dept_id_list.includes(departmentRow.dept_id))
          throw new DingtalkDirectoryError('invalid_directory');

        employeeRows.set(employee.userid, employee);
        if (employeeRows.size > 10000) throw new DingtalkDirectoryError('invalid_directory');
      }

      if (!page.has_more) break;

      if (page.next_cursor === undefined || page.next_cursor <= cursor)
        throw new DingtalkDirectoryError('invalid_directory');

      cursor = page.next_cursor;
    }
  }

  const departments = departmentRows.map((row) => ({
    id: row.dept_id,
    parentId: row.dept_id === 1 ? 0 : row.parent_id,
    name: row.name,
    sort: row.order ?? 0
  }));
  const employees = [...employeeRows.values()].map((row) => {
    const employeeNo = row.job_number?.trim() || null;
    const position = row.title?.trim() || null;
    const companyEmail = row.org_email?.trim().toLowerCase() || null;
    return { userId: row.userid, name: row.name, employeeNo, position, companyEmail, departmentIds: row.dept_id_list };
  });
  return ZDingtalkDirectory.parse({ departments, employees });
}
