import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { betterAuth } from '../../../../packages/db/node_modules/better-auth/dist/auth/minimal.mjs';
import {
  memoryAdapter,
  type MemoryDB
} from '../../../../packages/db/node_modules/better-auth/dist/adapters/memory-adapter/index.mjs';
import { admin } from '../../../../packages/db/node_modules/better-auth/dist/plugins/admin/index.mjs';
import { createAuthMiddleware } from '../../../../packages/db/node_modules/better-auth/dist/api/index.mjs';
import { resolveLoginUsername } from '@cio/db/auth/hooks/login-username';
import { getLoginEmailByUsername } from '@cio/db/queries/auth/login-account';

vi.mock('@cio/db/queries/auth/login-account', () => ({ getLoginEmailByUsername: vi.fn() }));

const origin = 'http://localhost:4173';
const email = 'administrator@example.test';
const password = 'test-password-123';

async function createTestAuth() {
  const database: MemoryDB = { user: [], account: [], session: [], verification: [] };
  const auth = betterAuth({
    baseURL: origin,
    secret: 'login-username-test-secret-at-least-thirty-two-characters',
    trustedOrigins: [origin],
    database: memoryAdapter(database),
    emailAndPassword: { enabled: true },
    hooks: { before: createAuthMiddleware(resolveLoginUsername) },
    plugins: [admin()],
    rateLimit: { enabled: false },
    advanced: {
      disableOriginCheck: false,
      disableCSRFCheck: false,
      database: { generateId: () => crypto.randomUUID() }
    },
    logger: { disabled: true }
  });
  const context = await auth.$context;
  const user = await context.internalAdapter.createUser({ name: 'Administrator', email, emailVerified: false });
  const passwordHash = await context.password.hash(password);
  await context.internalAdapter.createAccount({
    providerId: 'credential',
    accountId: user.id,
    userId: user.id,
    password: passwordHash
  });
  return { auth, database, user };
}

function request(identifier: unknown, suppliedPassword: unknown = password, requestOrigin = origin) {
  const body = JSON.stringify({ email: identifier, password: suppliedPassword });
  return new Request(`${origin}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { origin: requestOrigin, 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
    body
  });
}

describe('self-hosted username login', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('PUBLIC_IS_SELFHOSTED', 'true');
    vi.mocked(getLoginEmailByUsername).mockResolvedValue(email);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('authenticates a trimmed username through the existing password endpoint and sets its session cookie', async () => {
    const { auth, database, user } = await createTestAuth();
    const response = await auth.handler(request('  administrator  '));
    expect(response.status).toBe(200);
    expect((await response.json()).user.id).toBe(user.id);
    expect(response.headers.get('set-cookie')).toContain('session_token=');
    expect(getLoginEmailByUsername).toHaveBeenCalledWith('administrator');
    expect(database.session).toHaveLength(1);
  });

  it.each(['unknown', 'wrong-password'])(
    'rejects %s with the same generic credential error and no session',
    async (failure) => {
      const { auth, database } = await createTestAuth();
      if (failure === 'unknown') vi.mocked(getLoginEmailByUsername).mockResolvedValue(undefined);

      const response = await auth.handler(
        request('administrator', failure === 'unknown' ? password : 'wrong-password')
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ code: 'INVALID_EMAIL_OR_PASSWORD' });
      expect(database.session).toHaveLength(0);
    }
  );

  it('preserves email login without resolving a username', async () => {
    const { auth } = await createTestAuth();
    expect((await auth.handler(request(email))).status).toBe(200);
    expect(getLoginEmailByUsername).not.toHaveBeenCalled();
  });

  it.each([
    { email: 7, password },
    { email: 'administrator', password: 7 }
  ])('rejects malformed login fields', async (fields) => {
    const { auth, database } = await createTestAuth();
    expect((await auth.handler(request(fields.email, fields.password))).status).toBe(400);
    expect(getLoginEmailByUsername).not.toHaveBeenCalled();
    expect(database.session).toHaveLength(0);
  });

  it('keeps cloud login restricted to email', async () => {
    vi.stubEnv('PUBLIC_IS_SELFHOSTED', 'false');
    const { auth, database } = await createTestAuth();
    expect((await auth.handler(request('administrator'))).status).toBe(400);
    expect(getLoginEmailByUsername).not.toHaveBeenCalled();
    expect(database.session).toHaveLength(0);
  });

  it.each(['', 'x'.repeat(257)])('rejects an invalid identifier without a database lookup', async (identifier) => {
    const { auth, database } = await createTestAuth();
    expect((await auth.handler(request(identifier))).status).toBe(401);
    expect(getLoginEmailByUsername).not.toHaveBeenCalled();
    expect(database.session).toHaveLength(0);
  });

  it('preserves the existing ban check after username resolution', async () => {
    const { auth, database } = await createTestAuth();
    database.user[0].banned = true;
    expect((await auth.handler(request('administrator'))).status).toBe(403);
    expect(database.session).toHaveLength(0);
  });

  it('rejects a login from an untrusted origin', async () => {
    const { auth, database } = await createTestAuth();
    expect((await auth.handler(request('administrator', password, 'https://untrusted.example'))).status).toBe(403);
    expect(database.session).toHaveLength(0);
  });
});
