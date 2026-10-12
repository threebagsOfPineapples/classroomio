import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAccountData } from './profile';
import { getProfileById, syncProfileEmailVerificationFromAuthUser } from '@cio/db/queries/auth';
import { getDingtalkMember } from '@cio/db/queries/auth/dingtalk';
import { getOrganizationByProfileId } from '@cio/db/queries/organization';

vi.mock('@cio/db/queries/auth', () => ({
  getProfileById: vi.fn(),
  getProfileByEmail: vi.fn(),
  syncProfileEmailVerificationFromAuthUser: vi.fn(),
  updateProfile: vi.fn()
}));
vi.mock('@cio/db/queries/auth/dingtalk', () => ({ getDingtalkMember: vi.fn() }));
vi.mock('@cio/db/queries/organization', () => ({
  getOrganizationByProfileId: vi.fn(),
  getUserOrgRolesMap: vi.fn(),
  countActiveStudents: vi.fn(),
  ensureSelfHostedStudentMembership: vi.fn()
}));
vi.mock('@cio/core/config/env', () => ({ env: { PUBLIC_IS_SELFHOSTED: 'true' } }));
vi.mock('@api/services/license', () => ({ getLicenseStatus: async () => ({ valid: true, features: [] }) }));

const organizationId = '2b8f4a1c-6d3e-4b2a-9f7e-1c4d8a6e9b0f';
const profileId = '3c9052de-7e4f-4c3a-8d8e-2d5e9b7f1a3c';
const employeeProfile = { id: profileId, email: 'employee@zz-train.invalid', isEmailVerified: false };

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
    user: { id: profileId, emailVerified: false, banned: false, banExpires: null, isAnonymous: false }
  };
}

describe('DingTalk identity in account data', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('DINGTALK_ENABLED', 'true');
    vi.stubEnv('DINGTALK_CORP_ID', 'test-company');
    vi.stubEnv('DINGTALK_CLIENT_ID', 'test-client');
    vi.stubEnv('DINGTALK_CLIENT_SECRET', 'test-secret');
    vi.stubEnv('DINGTALK_ORGANIZATION_ID', organizationId);
    vi.stubEnv('DINGTALK_REDIRECT_URI', 'http://localhost:4173/api/auth/dingtalk/callback');
    vi.stubEnv('DASHBOARD_ORIGIN', 'http://localhost:4173');
    vi.mocked(getProfileById).mockResolvedValue(employeeProfile as never);
    vi.mocked(syncProfileEmailVerificationFromAuthUser).mockResolvedValue(employeeProfile as never);
    vi.mocked(getOrganizationByProfileId).mockResolvedValue([{ id: organizationId, roleId: 3, plans: [] }] as never);
    vi.mocked(getDingtalkMember).mockResolvedValue([employeeRecord()] as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows an active company identity without claiming its placeholder email is verified', async () => {
    const result = await getAccountData(profileId);
    expect(result).toMatchObject({
      dingtalkOrganizationId: organizationId,
      profile: { isEmailVerified: false }
    });
    expect(employeeProfile.isEmailVerified).toBe(false);
  });

  it('requires email verification for a native account without a DingTalk identity', async () => {
    vi.mocked(getDingtalkMember).mockResolvedValue([]);
    expect(await getAccountData(profileId)).toMatchObject({ dingtalkOrganizationId: null });
  });

  it('does not accept a DingTalk identity when the integration is disabled', async () => {
    vi.stubEnv('DINGTALK_ENABLED', 'false');
    expect(await getAccountData(profileId)).toMatchObject({ dingtalkOrganizationId: null });
    expect(getDingtalkMember).not.toHaveBeenCalled();
  });

  it.each([
    ['another company', { externalSource: 'dingtalk:another-company' }, {}],
    ['an unbound member', { externalId: null }, {}],
    ['an inactive member', { status: 'INACTIVE' }, {}],
    ['a terminated employee', { employmentStatus: 'TERMINATED' }, {}],
    ['a banned account', {}, { banned: true }],
    ['an anonymous account', {}, { isAnonymous: true }]
  ])('does not exempt %s from email verification', async (_reason, memberChanges, userChanges) => {
    const record = employeeRecord();
    vi.mocked(getDingtalkMember).mockResolvedValue([
      { member: { ...record.member, ...memberChanges }, user: { ...record.user, ...userChanges } }
    ] as never);
    expect(await getAccountData(profileId)).toMatchObject({ dingtalkOrganizationId: null });
  });
});
