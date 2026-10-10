import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { betterAuth } from '../../../../packages/db/node_modules/better-auth/dist/auth/minimal.mjs';
import {
  memoryAdapter,
  type MemoryDB
} from '../../../../packages/db/node_modules/better-auth/dist/adapters/memory-adapter/index.mjs';
import { dingtalk } from '@cio/db/auth/plugins/dingtalk';
import {
  getDingtalkConfig,
  getDingtalkIdentity,
  getDingtalkEmployee,
  isActiveDingtalkMember
} from '@cio/db/auth/dingtalk';
import * as queries from '@cio/db/queries/auth/dingtalk';

vi.mock('@cio/db/queries/auth/dingtalk', () => ({
  bindDingtalkMember: vi.fn(),
  consumeDingtalkState: vi.fn(),
  findDingtalkMember: vi.fn(),
  getDingtalkMember: vi.fn(),
  saveDingtalkState: vi.fn()
}));

const origin = 'http://localhost:4173';
const organizationId = '2b8f4a1c-6d3e-4b2a-9f7e-1c4d8a6e9b0f';
const profileId = '3c9052de-7e4f-4c3a-8d8e-2d5e9b7f1a3c';
const testConfig = {
  DINGTALK_ENABLED: 'true',
  DINGTALK_CORP_ID: 'test-company',
  DINGTALK_CLIENT_ID: 'test-client',
  DINGTALK_CLIENT_SECRET: 'test-secret',
  DINGTALK_ORGANIZATION_ID: organizationId,
  DINGTALK_REDIRECT_URI: `${origin}/api/auth/dingtalk/callback`,
  DASHBOARD_ORIGIN: origin
};

function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
}

async function createTestAuth() {
  const database: MemoryDB = { user: [], account: [], session: [], verification: [] };
  const auth = betterAuth({
    baseURL: origin,
    secret: 'dingtalk-test-secret-at-least-thirty-two-characters',
    trustedOrigins: [origin],
    database: memoryAdapter(database),
    emailAndPassword: { enabled: true },
    plugins: [dingtalk()],
    rateLimit: { enabled: false },
    advanced: { database: { generateId: () => crypto.randomUUID() } },
    logger: { disabled: true }
  });
  const context = await auth.$context;
  const user = await context.internalAdapter.createUser({
    id: profileId,
    name: 'Training Admin',
    email: 'dingtalk-test@example.test',
    emailVerified: false
  });
  const password = await context.password.hash('existing-password-123');
  await context.internalAdapter.createAccount({
    providerId: 'credential',
    accountId: user.id,
    userId: user.id,
    password
  });
  const record = {
    member: {
      id: 7,
      profileId: user.id,
      organizationId,
      roleId: 1,
      status: 'ACTIVE',
      employmentStatus: 'ACTIVE',
      externalSource: 'dingtalk:test-company',
      externalId: 'staff-7'
    },
    user
  };
  vi.mocked(queries.findDingtalkMember).mockResolvedValue([record] as never);
  vi.mocked(queries.getDingtalkMember).mockResolvedValue([record] as never);
  return { auth, context, database, record };
}

function request(path: string, body?: object, cookie = '', requestOrigin = origin) {
  const headers = new Headers({ origin: requestOrigin });
  if (cookie) headers.set('cookie', cookie);
  if (body) headers.set('content-type', 'application/json');

  const serialized = body ? JSON.stringify(body) : undefined;
  return new Request(`${origin}/api/auth${path}`, { method: body ? 'POST' : 'GET', headers, body: serialized });
}

async function startLogin(auth: Awaited<ReturnType<typeof createTestAuth>>['auth'], intent = 'login', cookie = '') {
  const response = await auth.handler(request('/dingtalk/start', { organizationId, intent }, cookie));
  const result = await response.json();
  const state = result.url ? new URL(result.url).searchParams.get('state') : null;
  return { response, result, state, cookie: `${cookie}; ${cookies(response)}` };
}

describe('DingTalk company identity and account permissions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    for (const [key, value] of Object.entries(testConfig)) vi.stubEnv(key, value);

    const states = new Map<string, unknown>();
    vi.mocked(queries.saveDingtalkState).mockImplementation(async (state, value) => {
      states.set(state, value);
    });
    vi.mocked(queries.consumeDingtalkState).mockImplementation(async (state) => {
      const value = states.get(state);
      states.delete(state);
      return value ? JSON.stringify(value) : null;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        const payload = url.includes('/userAccessToken')
          ? { accessToken: 'personal-token', corpId: 'test-company' }
          : url.includes('/users/me')
            ? { unionId: 'union-7' }
            : url.includes('/oauth2/accessToken')
              ? { accessToken: 'app-token', expireIn: 7200 }
              : url.includes('/getbyunionid')
                ? { errcode: 0, result: { userid: 'staff-7' } }
                : {
                    errcode: 0,
                    result: {
                      userid: 'staff-7',
                      unionid: 'union-7',
                      name: 'Employee',
                      job_number: 'E007',
                      title: 'Trainer',
                      dept_id_list: [8]
                    }
                  };
        return Response.json(payload);
      })
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('stays disabled until the credentials, organization and callback origin are complete', () => {
    expect(getDingtalkConfig({})).toBeNull();
    expect(getDingtalkConfig({ ...testConfig, DINGTALK_CLIENT_SECRET: '' })).toBeNull();
    expect(
      getDingtalkConfig({ ...testConfig, DINGTALK_REDIRECT_URI: 'https://other.example/api/auth/dingtalk/callback' })
    ).toBeNull();
    expect(
      getDingtalkConfig({
        ...testConfig,
        DINGTALK_REDIRECT_URI: `${origin}/api/auth/dingtalk/callback?next=https://other.example`
      })
    ).toBeNull();
    expect(getDingtalkConfig(testConfig)).not.toBeNull();
  });

  it('permits same-origin private network HTTP callbacks and rejects public HTTP callbacks', () => {
    for (const hostname of ['10.60.6.101', '172.16.0.1', '172.31.255.254', '192.168.1.2']) {
      const dashboardOrigin = `http://${hostname}:3082`;
      expect(
        getDingtalkConfig({
          ...testConfig,
          DASHBOARD_ORIGIN: dashboardOrigin,
          DINGTALK_REDIRECT_URI: `${dashboardOrigin}/proxy/api/auth/dingtalk/callback`
        })
      ).not.toBeNull();
    }

    for (const hostname of ['example.com', '8.8.8.8', '172.15.0.1', '172.32.0.1', '192.169.1.2', '10.example.com']) {
      const dashboardOrigin = `http://${hostname}:3082`;
      expect(
        getDingtalkConfig({
          ...testConfig,
          DASHBOARD_ORIGIN: dashboardOrigin,
          DINGTALK_REDIRECT_URI: `${dashboardOrigin}/proxy/api/auth/dingtalk/callback`
        })
      ).toBeNull();
    }
  });

  it('reads company details, leaves missing values unavailable and never substitutes personal email', async () => {
    const employee = await getDingtalkIdentity(getDingtalkConfig(testConfig)!, 'test-code');
    expect(employee).toMatchObject({
      userId: 'staff-7',
      unionId: 'union-7',
      employeeNo: 'E007',
      mobile: null,
      companyEmail: null
    });
    const exchange = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes('/userAccessToken'));
    expect(JSON.parse(String(exchange?.[1]?.body))).toMatchObject({
      code: 'test-code',
      grantType: 'authorization_code'
    });
  });

  it('rejects another company before reading or binding a member', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ accessToken: 'personal-token', corpId: 'other-company' }));
    await expect(getDingtalkIdentity(getDingtalkConfig(testConfig)!, 'test-code')).rejects.toMatchObject({
      code: 'wrong_company'
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(queries.bindDingtalkMember).not.toHaveBeenCalled();
  });

  it('rejects provider errors, missing identity and inconsistent union IDs', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ code: 'Forbidden', message: 'sensitive provider error' }, { status: 403 })
    );
    await expect(getDingtalkIdentity(getDingtalkConfig(testConfig)!, 'test-code')).rejects.toMatchObject({
      message: 'provider_error'
    });
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ accessToken: 'personal-token' }));
    await expect(getDingtalkIdentity(getDingtalkConfig(testConfig)!, 'test-code')).rejects.toMatchObject({
      code: 'provider_error'
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ accessToken: 'personal-token', corpId: 'test-company' }))
      .mockResolvedValueOnce(Response.json({ unionId: 'different-person' }));
    await expect(getDingtalkIdentity(getDingtalkConfig(testConfig)!, 'test-code')).rejects.toMatchObject({
      code: 'provider_error'
    });
  });

  it('reveals no configuration secrets and hides login for another organization', async () => {
    const { auth } = await createTestAuth();
    const response = await auth.handler(request(`/dingtalk/config?organizationId=${organizationId}`));
    expect(await response.json()).toEqual({ enabled: true });
    const publicLogin = await auth.handler(request('/dingtalk/config'));
    expect(await publicLogin.json()).toEqual({ enabled: true });
    const publicStart = await auth.handler(request('/dingtalk/start', { intent: 'login' }));
    expect(publicStart.status).toBe(200);
    const other = await auth.handler(request('/dingtalk/config?organizationId=4da163ef-8050-4d4b-9c9f-3e6fac802b4d'));
    expect(await other.json()).toEqual({ enabled: false });
  });

  it('refreshes the cached application token after a company API rejects it', async () => {
    const config = getDingtalkConfig(testConfig)!;
    await getDingtalkEmployee(config, 'staff-7');
    vi.mocked(fetch).mockClear();
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ errcode: 40014 }));
    await expect(getDingtalkEmployee(config, 'staff-7')).rejects.toMatchObject({ code: 'provider_error' });
    await getDingtalkEmployee(config, 'staff-7');
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/oauth2/accessToken'))).toBe(true);
  });

  it('rejects an untrusted start origin and organization mismatch', async () => {
    const { auth } = await createTestAuth();
    const foreign = await auth.handler(
      request('/dingtalk/start', { organizationId, intent: 'login' }, '', 'https://attacker.example')
    );
    expect(foreign.status).toBe(403);
    const wrongOrg = await auth.handler(request('/dingtalk/start', { organizationId: profileId, intent: 'login' }));
    expect(wrongOrg.status).toBe(403);
    expect(queries.saveDingtalkState).not.toHaveBeenCalled();
  });

  it('requires both browser state and a one-time server state before creating a session', async () => {
    const { auth, database } = await createTestAuth();
    const start = await startLogin(auth);
    expect(start.response.status).toBe(200);
    const callback = `/dingtalk/callback?authCode=test-code&state=${start.state}`;
    const missingCookie = await auth.handler(request(callback));
    expect(missingCookie.headers.get('location')).toContain('dingtalk_error=invalid_state');
    expect(database.session).toHaveLength(0);
    const response = await auth.handler(request(callback, undefined, start.cookie));
    expect(response.headers.get('location')).toBe(`${origin}/lms`);
    expect(cookies(response)).toContain('session_token');
    expect(database.session).toHaveLength(1);
    const replay = await auth.handler(request(callback, undefined, start.cookie));
    expect(replay.headers.get('location')).toContain('dingtalk_error=invalid_state');
    expect(database.session).toHaveLength(1);
    expect(database.account).toHaveLength(1);
    expect(database.user[0]).toMatchObject({ emailVerified: false });
    expect(queries.bindDingtalkMember).not.toHaveBeenCalled();
  });

  it.each(['unlinked', 'deactivated', 'terminated', 'banned', 'anonymous'])(
    'does not grant a session to a %s account',
    async (status) => {
      const { auth, database, record } = await createTestAuth();
      const changed = structuredClone(record);
      if (status === 'deactivated') changed.member.status = 'DEACTIVATED';
      if (status === 'terminated') changed.member.employmentStatus = 'TERMINATED';
      if (status === 'banned') Object.assign(changed.user, { banned: true });
      if (status === 'anonymous') Object.assign(changed.user, { isAnonymous: true });
      vi.mocked(queries.findDingtalkMember).mockResolvedValue(status === 'unlinked' ? [] : ([changed] as never));
      const start = await startLogin(auth);
      const response = await auth.handler(
        request(`/dingtalk/callback?authCode=test-code&state=${start.state}`, undefined, start.cookie)
      );
      expect(response.headers.get('location')).toContain(
        `dingtalk_error=${status === 'unlinked' ? 'link_required' : 'member_inactive'}`
      );
      expect(database.session).toHaveLength(0);
      expect(database.user).toHaveLength(1);
      expect(queries.bindDingtalkMember).not.toHaveBeenCalled();
    }
  );

  it('requires a fresh existing session to link and passes the exact account identity to the binding transaction', async () => {
    const { auth } = await createTestAuth();
    const anonymous = await startLogin(auth, 'link');
    expect(anonymous.response.status).toBe(403);
    vi.mocked(queries.bindDingtalkMember).mockResolvedValue('linked');
    const login = await auth.handler(
      request('/sign-in/email', { email: 'dingtalk-test@example.test', password: 'existing-password-123' })
    );
    const sessionCookie = cookies(login);
    const start = await startLogin(auth, 'link', sessionCookie);
    expect(start.response.status).toBe(200);
    const response = await auth.handler(
      request(`/dingtalk/callback?authCode=test-code&state=${start.state}`, undefined, start.cookie)
    );
    expect(response.headers.get('location')).toBe(`${origin}/lms/settings/integrations?dingtalk_linked=1`);
    expect(queries.bindDingtalkMember).toHaveBeenCalledWith(organizationId, profileId, 'test-company', 'staff-7');
  });

  it('rejects binding after the original account signs out and never exposes employee details without a session', async () => {
    const { auth } = await createTestAuth();
    const login = await auth.handler(
      request('/sign-in/email', { email: 'dingtalk-test@example.test', password: 'existing-password-123' })
    );
    const sessionCookie = cookies(login);
    const start = await startLogin(auth, 'link', sessionCookie);
    const response = await auth.handler(
      request(`/dingtalk/callback?authCode=test-code&state=${start.state}`, undefined, cookies(start.response))
    );
    expect(response.headers.get('location')).toContain('dingtalk_error=reauth_required');
    expect(queries.bindDingtalkMember).not.toHaveBeenCalled();
    const employee = await auth.handler(request('/dingtalk/employee'));
    expect(employee.status).toBe(403);
  });

  it('requires recent authentication rather than accepting an old session for binding', async () => {
    const { auth, database } = await createTestAuth();
    const login = await auth.handler(
      request('/sign-in/email', { email: 'dingtalk-test@example.test', password: 'existing-password-123' })
    );
    database.session[0].createdAt = new Date(Date.now() - 6 * 60_000);
    const start = await startLogin(auth, 'link', cookies(login));
    expect(start.response.status).toBe(403);
    expect(start.result).toMatchObject({ code: 'reauth_required' });
    expect(queries.saveDingtalkState).not.toHaveBeenCalled();
  });

  it('keeps temporary bans effective until their expiry', async () => {
    const { record } = await createTestAuth();
    Object.assign(record.user, { banned: true, banExpires: new Date(Date.now() + 60_000) });
    expect(isActiveDingtalkMember(record as never)).toBe(false);
    Object.assign(record.user, { banExpires: new Date(Date.now() - 1000) });
    expect(isActiveDingtalkMember(record as never)).toBe(true);
  });

  it('returns a binding conflict without altering either account', async () => {
    const { auth, database } = await createTestAuth();
    const login = await auth.handler(
      request('/sign-in/email', { email: 'dingtalk-test@example.test', password: 'existing-password-123' })
    );
    const start = await startLogin(auth, 'link', cookies(login));
    vi.mocked(queries.bindDingtalkMember).mockRejectedValue({ cause: { code: '23505' } });
    const response = await auth.handler(
      request(`/dingtalk/callback?authCode=test-code&state=${start.state}`, undefined, start.cookie)
    );
    expect(response.headers.get('location')).toContain('dingtalk_error=account_conflict');
    expect(database.session).toHaveLength(1);
    expect(database.account).toHaveLength(1);
  });

  it('reads only the current account and returns live company information without caching it in the browser', async () => {
    const { auth } = await createTestAuth();
    const login = await auth.handler(
      request('/sign-in/email', { email: 'dingtalk-test@example.test', password: 'existing-password-123' })
    );
    const response = await auth.handler(request('/dingtalk/employee', undefined, cookies(login)));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ linked: true, employee: { employeeNo: 'E007', departmentIds: [8] } });
    expect(queries.getDingtalkMember).toHaveBeenCalledWith(organizationId, profileId);
  });
});
