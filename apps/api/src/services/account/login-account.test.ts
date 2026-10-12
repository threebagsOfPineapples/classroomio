import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changeLoginEmail } from './login-account';
import { env } from '@cio/core/config/env';
import { getDingtalkMember } from '@cio/db/queries/auth/dingtalk';
import {
  findLoginEmailOwner,
  getCredentialAccount,
  lockLoginUser,
  saveLoginEmail,
  setCredentialPassword,
  withLoginAccountTransaction
} from '@cio/db/queries/auth';

const password = vi.hoisted(() => ({ verify: vi.fn(), hash: vi.fn() }));
vi.mock('@cio/db/auth', () => ({ auth: { $context: Promise.resolve({ password }) } }));
vi.mock('@cio/db/queries/auth', () => ({
  findLoginEmailOwner: vi.fn(),
  getCredentialAccount: vi.fn(),
  lockLoginUser: vi.fn(),
  saveLoginEmail: vi.fn(),
  setCredentialPassword: vi.fn(),
  withLoginAccountTransaction: vi.fn()
}));
vi.mock('@cio/db/queries/auth/dingtalk', () => ({ getDingtalkMember: vi.fn() }));
vi.mock('@cio/core/config/env', () => ({ env: { PUBLIC_IS_SELFHOSTED: 'true' } }));

const profileId = '3c9052de-7e4f-4c3a-8d8e-2d5e9b7f1a3c';
const organizationId = '2b8f4a1c-6d3e-4b2a-9f7e-1c4d8a6e9b0f';
const client = {} as never;

function employeeRecord() {
  return {
    member: {
      organizationId,
      profileId,
      externalSource: 'dingtalk:test-company',
      externalId: 'staff-7',
      status: 'ACTIVE',
      employmentStatus: 'ACTIVE'
    },
    user: { id: profileId, banned: false, banExpires: null, isAnonymous: false }
  };
}

describe('enterprise login email', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    env.PUBLIC_IS_SELFHOSTED = 'true';
    vi.stubEnv('DINGTALK_ENABLED', 'true');
    vi.stubEnv('DINGTALK_CORP_ID', 'test-company');
    vi.stubEnv('DINGTALK_CLIENT_ID', 'test-client');
    vi.stubEnv('DINGTALK_CLIENT_SECRET', 'test-secret');
    vi.stubEnv('DINGTALK_ORGANIZATION_ID', organizationId);
    vi.stubEnv('DINGTALK_REDIRECT_URI', 'http://localhost:4173/api/auth/dingtalk/callback');
    vi.stubEnv('DASHBOARD_ORIGIN', 'http://localhost:4173');
    vi.mocked(withLoginAccountTransaction).mockImplementation(async (action) => action(client));
    vi.mocked(lockLoginUser).mockResolvedValue({ id: profileId, isAnonymous: false, banned: false } as never);
    vi.mocked(getCredentialAccount).mockResolvedValue({ password: 'existing-hash' } as never);
    vi.mocked(saveLoginEmail).mockResolvedValue({
      id: profileId,
      email: 'staff@example.com',
      isEmailVerified: false
    } as never);
    vi.mocked(getDingtalkMember).mockResolvedValue([employeeRecord()] as never);
    password.verify.mockResolvedValue(true);
    password.hash.mockResolvedValue('new-hash');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('confirms the current password and saves a normalized identifier immediately', async () => {
    const result = await changeLoginEmail(profileId, {
      newEmail: '  Staff@Example.COM  ',
      currentPassword: 'correct-password'
    });
    expect(result).toMatchObject({ hasCredentialPassword: true, profile: { isEmailVerified: false } });
    expect(password.verify).toHaveBeenCalledWith({ hash: 'existing-hash', password: 'correct-password' });
    expect(findLoginEmailOwner).toHaveBeenCalledWith(profileId, 'staff@example.com', client);
    expect(saveLoginEmail).toHaveBeenCalledWith(profileId, 'staff@example.com', client);
    expect(setCredentialPassword).not.toHaveBeenCalled();
  });

  it.each([undefined, 'wrong-password'])('rejects a missing or incorrect current password', async (currentPassword) => {
    password.verify.mockResolvedValue(false);
    await expect(changeLoginEmail(profileId, { newEmail: 'staff@example.com', currentPassword })).rejects.toMatchObject(
      { field: 'currentPassword', statusCode: 400 }
    );
    expect(saveLoginEmail).not.toHaveBeenCalled();
  });

  it('rejects a duplicate email before writing or replacing credentials', async () => {
    vi.mocked(findLoginEmailOwner).mockResolvedValue({ id: 'another-user' });
    await expect(
      changeLoginEmail(profileId, { newEmail: 'STAFF@example.com', currentPassword: 'correct-password' })
    ).rejects.toMatchObject({ field: 'newEmail', statusCode: 409 });
    expect(saveLoginEmail).not.toHaveBeenCalled();
    expect(setCredentialPassword).not.toHaveBeenCalled();
  });

  it('creates the first password only for an active configured DingTalk identity', async () => {
    vi.mocked(getCredentialAccount).mockResolvedValue(undefined);
    const result = await changeLoginEmail(profileId, {
      newEmail: 'staff@example.com',
      newPassword: 'password-123',
      confirmPassword: 'password-123'
    });
    expect(result.hasCredentialPassword).toBe(true);
    expect(password.verify).not.toHaveBeenCalled();
    expect(password.hash).toHaveBeenCalledWith('password-123');
    expect(setCredentialPassword).toHaveBeenCalledWith(profileId, 'new-hash', client);
  });

  it.each([
    ['another company', { externalSource: 'dingtalk:other-company' }],
    ['a deactivated employee', { status: 'DEACTIVATED' }],
    ['a terminated employee', { employmentStatus: 'TERMINATED' }],
    ['an unbound identity', { externalId: null }]
  ])('cannot set a first password for %s', async (_reason, memberChanges) => {
    vi.mocked(getCredentialAccount).mockResolvedValue(undefined);
    const record = employeeRecord();
    vi.mocked(getDingtalkMember).mockResolvedValue([
      { ...record, member: { ...record.member, ...memberChanges } }
    ] as never);
    await expect(
      changeLoginEmail(profileId, {
        newEmail: 'staff@example.com',
        newPassword: 'password-123',
        confirmPassword: 'password-123'
      })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(saveLoginEmail).not.toHaveBeenCalled();
  });

  it('cannot set a first password without a company identity', async () => {
    vi.mocked(getCredentialAccount).mockResolvedValue(undefined);
    vi.mocked(getDingtalkMember).mockResolvedValue([]);
    await expect(
      changeLoginEmail(profileId, {
        newEmail: 'staff@example.com',
        newPassword: 'password-123',
        confirmPassword: 'password-123'
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it.each([
    { newEmail: 'not-an-email', currentPassword: 'correct-password' },
    { newEmail: 'fake@zz-train.invalid', currentPassword: 'correct-password' },
    { newEmail: 'staff@example.com', newPassword: 'password-123', confirmPassword: 'different-password' },
    { newEmail: 'staff@example.com', newPassword: 'short', confirmPassword: 'short' },
    { newEmail: 'staff@example.com', newPassword: '中'.repeat(25), confirmPassword: '中'.repeat(25) }
  ])('rejects invalid identifiers or passwords before opening a transaction', async (fields) => {
    await expect(changeLoginEmail(profileId, fields)).rejects.toThrow();
    expect(withLoginAccountTransaction).not.toHaveBeenCalled();
  });

  it('requires a password when the company account has none', async () => {
    vi.mocked(getCredentialAccount).mockResolvedValue(undefined);
    await expect(changeLoginEmail(profileId, { newEmail: 'staff@example.com' })).rejects.toMatchObject({
      field: 'newPassword',
      statusCode: 400
    });
    expect(saveLoginEmail).not.toHaveBeenCalled();
  });

  it('prevents password replacement through an email change', async () => {
    await expect(
      changeLoginEmail(profileId, {
        newEmail: 'staff@example.com',
        currentPassword: 'correct-password',
        newPassword: 'password-123',
        confirmPassword: 'password-123'
      })
    ).rejects.toMatchObject({ field: 'currentPassword', statusCode: 400 });
    expect(saveLoginEmail).not.toHaveBeenCalled();
  });

  it('maps a concurrent unique email violation to a field error', async () => {
    vi.mocked(saveLoginEmail).mockRejectedValue(new Error('Database conflict', { cause: { code: '23505' } }));
    await expect(
      changeLoginEmail(profileId, { newEmail: 'staff@example.com', currentPassword: 'correct-password' })
    ).rejects.toMatchObject({ field: 'newEmail', statusCode: 409 });
  });

  it('asks for a retry after a concurrent serializable transaction conflict', async () => {
    vi.mocked(saveLoginEmail).mockRejectedValue(new Error('Database conflict', { cause: { code: '40001' } }));
    await expect(
      changeLoginEmail(profileId, { newEmail: 'staff@example.com', currentPassword: 'correct-password' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it.each([{ banned: true, banExpires: null }, { isAnonymous: true }])(
    'rejects an inactive login account',
    async (changes) => {
      vi.mocked(lockLoginUser).mockResolvedValue({ id: profileId, ...changes } as never);
      await expect(
        changeLoginEmail(profileId, { newEmail: 'staff@example.com', currentPassword: 'correct-password' })
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(saveLoginEmail).not.toHaveBeenCalled();
    }
  );

  it('keeps the cloud email ownership flow separate', async () => {
    env.PUBLIC_IS_SELFHOSTED = 'false';
    await expect(
      changeLoginEmail(profileId, { newEmail: 'staff@example.com', currentPassword: 'correct-password' })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(withLoginAccountTransaction).not.toHaveBeenCalled();
  });
});
