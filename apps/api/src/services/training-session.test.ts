import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ZTrainingSessionCheckin,
  ZTrainingSessionCorrection,
  ZTrainingSessionDraft
} from '@cio/utils/validation/training-session';

const mocks = vi.hoisted(() => ({
  overview: vi.fn(),
  audit: vi.fn(),
  scopedMembers: vi.fn(),
  headquartersMembers: vi.fn(),
  findTrainingSession: vi.fn(),
  findTrainingSessionAttendee: vi.fn(),
  findTrainingSessionToken: vi.fn(),
  insertTrainingSession: vi.fn(),
  insertTrainingSessionToken: vi.fn(),
  listTrainingSessionAttendees: vi.fn(),
  listTrainingSessionAudit: vi.fn(),
  listTrainingSessionCandidates: vi.fn(),
  listTrainingSessions: vi.fn(),
  lockActiveTrainingSessionMember: vi.fn(),
  replaceTrainingSessionAttendees: vi.fn(),
  revokeTrainingSessionTokens: vi.fn(),
  trainingSessionLinksExist: vi.fn(),
  updateTrainingSession: vi.fn(),
  updateTrainingSessionAttendance: vi.fn(),
  withTrainingSessionTransaction: vi.fn()
}));

vi.mock('@api/services/enterprise', () => ({ getEnterpriseOverview: mocks.overview }));
vi.mock('@cio/db/queries/enterprise', () => ({ getEnterpriseMember: vi.fn() }));
vi.mock('@cio/db/queries/enterprise/access', () => ({
  addTrainingOperationAudit: mocks.audit,
  getTrainingHeadquartersMemberIds: mocks.headquartersMembers,
  listEnterpriseScopedMemberIds: mocks.scopedMembers
}));
vi.mock('@cio/db/queries/training-session', () => mocks);

import {
  changeTrainingSessionStatus,
  changeTrainingSessionToken,
  checkInTrainingSession,
  correctTrainingSessionAttendance,
  exportTrainingSession,
  getTrainingSessionDetail,
  getTrainingSessionList,
  previewTrainingSessionAudience
} from './training-session';
import { requireSessionCheckinWindow, sessionAttendanceDisplayStatus } from './training-session-policy';

const now = Date.parse('2026-10-13T10:00:00Z');
const transaction = { id: 'session-transaction' };
const session = {
  id: 'session',
  organizationId: 'org',
  status: 'PUBLISHED',
  title: 'Safety training',
  startAt: '2026-10-13T09:50:00Z',
  endAt: '2026-10-13T11:00:00Z',
  checkinOpensAt: '2026-10-13T09:00:00Z',
  checkinClosesAt: '2026-10-13T10:30:00Z'
};
const attendee = {
  id: 'attendance',
  organizationId: 'org',
  sessionId: 'session',
  memberId: 42,
  status: 'PENDING',
  checkedInAt: null
};

function admin() {
  mocks.overview.mockResolvedValue({
    memberId: 1,
    roles: ['TRAINING_ADMIN'],
    canManageTraining: true,
    scopedDepartmentIds: [],
    scopedMemberIds: []
  });
}

describe('training session identity, authorization and lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.headquartersMembers.mockResolvedValue(null);
    vi.spyOn(Date, 'now').mockReturnValue(now);
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mocks.overview.mockResolvedValue({
      memberId: 42,
      roles: ['EMPLOYEE'],
      canManageTraining: false,
      scopedDepartmentIds: [],
      scopedMemberIds: []
    });
    mocks.withTrainingSessionTransaction.mockImplementation((callback) => callback(transaction));
    mocks.findTrainingSession.mockResolvedValue(session);
    mocks.findTrainingSessionAttendee.mockResolvedValue(attendee);
    mocks.lockActiveTrainingSessionMember.mockResolvedValue({
      id: 42,
      organizationId: 'org',
      status: 'ACTIVE',
      employmentStatus: 'ACTIVE'
    });
    mocks.findTrainingSessionToken.mockResolvedValue({
      organizationId: 'org',
      sessionId: 'session',
      revokedAt: null,
      expiresAt: session.checkinClosesAt
    });
    mocks.updateTrainingSessionAttendance.mockImplementation((_organizationId, _sessionId, _memberId, values) =>
      Promise.resolve([{ ...attendee, ...values }])
    );
    mocks.listTrainingSessionAttendees.mockResolvedValue([
      { attendance: attendee, fullname: 'Employee', email: null, employeeNo: '42', departmentName: 'Support' }
    ]);
    mocks.listTrainingSessionAudit.mockResolvedValue([]);
    mocks.listTrainingSessions.mockResolvedValue([session]);
  });

  it('takes the member identity from the active session and locks before checking in', async () => {
    const result = await checkInTrainingSession('org', 'profile', 'session', 'raw-token');
    expect(result.duplicate).toBe(false);
    expect(mocks.findTrainingSession).toHaveBeenCalledWith('org', 'session', transaction, true);
    expect(mocks.findTrainingSessionAttendee).toHaveBeenCalledWith('org', 'session', 42, transaction, true);
    expect(mocks.updateTrainingSessionAttendance).toHaveBeenCalledWith(
      'org',
      'session',
      42,
      expect.objectContaining({ status: 'PRESENT', method: 'SELF' }),
      transaction
    );
    expect(mocks.findTrainingSessionToken.mock.calls[0][2]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain('raw-token');
  });

  it('strictly rejects a forged member ID in the self check-in body', () => {
    expect(ZTrainingSessionCheckin.safeParse({ token: 'a'.repeat(43), memberId: 99 }).success).toBe(false);
    expect(ZTrainingSessionCheckin.safeParse({ token: 'a'.repeat(43) }).success).toBe(true);
  });

  it('does not overwrite the original check-in time on a duplicate', async () => {
    const original = { ...attendee, status: 'PRESENT', checkedInAt: '2026-10-13T09:15:00Z' };
    mocks.findTrainingSessionAttendee.mockResolvedValue(original);
    const result = await checkInTrainingSession('org', 'profile', 'session', 'token');
    expect(result).toEqual({ attendance: original, duplicate: true });
    expect(mocks.updateTrainingSessionAttendance).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it('writes once when concurrent check-ins are serialized by the session transaction', async () => {
    let committedAttendance = { ...attendee };
    let pendingTransaction = Promise.resolve();
    mocks.withTrainingSessionTransaction.mockImplementation((callback) => {
      const result = pendingTransaction.then(() => callback(transaction));
      pendingTransaction = result.then(() => undefined);
      return result;
    });
    mocks.findTrainingSessionAttendee.mockImplementation(() => Promise.resolve(committedAttendance));
    mocks.updateTrainingSessionAttendance.mockImplementation((_organizationId, _sessionId, _memberId, values) => {
      committedAttendance = { ...committedAttendance, ...values };
      return Promise.resolve([committedAttendance]);
    });
    const results = await Promise.all([
      checkInTrainingSession('org', 'profile', 'session', 'token'),
      checkInTrainingSession('org', 'profile', 'session', 'token')
    ]);
    expect(results.map((result) => result.duplicate)).toEqual([false, true]);
    expect(mocks.updateTrainingSessionAttendance).toHaveBeenCalledOnce();
    expect(mocks.audit).toHaveBeenCalledOnce();
  });

  it.each(['DEACTIVATED', 'ARCHIVED'])('rejects inactive actors even with a leaked code: %s', async (status) => {
    mocks.lockActiveTrainingSessionMember.mockResolvedValue({ status, employmentStatus: 'ACTIVE' });
    await expect(checkInTrainingSession('org', 'profile', 'session', 'token')).rejects.toThrow('inactive');
    expect(mocks.updateTrainingSessionAttendance).not.toHaveBeenCalled();
  });

  it('rejects terminated actors', async () => {
    mocks.lockActiveTrainingSessionMember.mockResolvedValue({ status: 'ACTIVE', employmentStatus: 'TERMINATED' });
    await expect(checkInTrainingSession('org', 'profile', 'session', 'token')).rejects.toThrow('inactive');
  });

  it('rejects employees removed from eligibility', async () => {
    mocks.findTrainingSessionAttendee.mockResolvedValue(null);
    await expect(checkInTrainingSession('org', 'profile', 'session', 'token')).rejects.toThrow('not_eligible');
    expect(mocks.updateTrainingSessionAttendance).not.toHaveBeenCalled();
  });

  it('rejects a cross-organization session before looking up the token', async () => {
    mocks.findTrainingSession.mockResolvedValue(null);
    await expect(checkInTrainingSession('other-org', 'profile', 'session', 'token')).rejects.toThrow('not_found');
    expect(mocks.findTrainingSessionToken).not.toHaveBeenCalled();
  });

  it.each([
    { token: null, label: 'wrong session or unknown code' },
    { token: { revokedAt: '2026-10-13T09:00:00Z', expiresAt: session.checkinClosesAt }, label: 'revoked code' },
    { token: { revokedAt: null, expiresAt: new Date(now).toISOString() }, label: 'expired code' }
  ])('rejects $label', async ({ token }) => {
    mocks.findTrainingSessionToken.mockResolvedValue(token);
    await expect(checkInTrainingSession('org', 'profile', 'session', 'token')).rejects.toThrow('invalid_token');
    expect(mocks.updateTrainingSessionAttendance).not.toHaveBeenCalled();
  });

  it.each([
    { values: { status: 'CLOSED' }, key: 'closed' },
    { values: { status: 'DRAFT' }, key: 'closed' },
    { values: { checkinOpensAt: '2026-10-13T10:01:00Z' }, key: 'not_open' },
    { values: { checkinClosesAt: new Date(now).toISOString() }, key: 'expired' }
  ])('rejects invalid window/status: $key', async ({ values, key }) => {
    mocks.findTrainingSession.mockResolvedValue({ ...session, ...values });
    await expect(checkInTrainingSession('org', 'profile', 'session', 'token')).rejects.toThrow(key);
    expect(mocks.updateTrainingSessionAttendance).not.toHaveBeenCalled();
  });

  it('does not silently replace leave with self check-in', async () => {
    mocks.findTrainingSessionAttendee.mockResolvedValue({ ...attendee, status: 'LEAVE' });
    await expect(checkInTrainingSession('org', 'profile', 'session', 'token')).rejects.toThrow('leave');
  });

  it.each(['EMPLOYEE', 'DEPARTMENT_MANAGER', 'HR'])('denies manual corrections to %s', async (role) => {
    mocks.overview.mockResolvedValue({
      memberId: 42,
      roles: [role],
      canManageTraining: false,
      scopedDepartmentIds: [],
      scopedMemberIds: []
    });
    await expect(
      correctTrainingSessionAttendance('org', 'profile', 'session', {
        memberId: 99,
        action: 'PRESENT',
        reason: 'Correction'
      })
    ).rejects.toThrow('administrator');
    expect(mocks.withTrainingSessionTransaction).not.toHaveBeenCalled();
  });

  it('requires a non-empty correction reason', () => {
    expect(ZTrainingSessionCorrection.safeParse({ memberId: 42, action: 'LEAVE', reason: '   ' }).success).toBe(false);
  });

  it('records administrator correction and audit atomically', async () => {
    admin();
    await correctTrainingSessionAttendance('org', 'admin', 'session', {
      memberId: 42,
      action: 'REVOKE',
      reason: 'Incorrect manual entry'
    });
    expect(mocks.updateTrainingSessionAttendance).toHaveBeenCalledWith(
      'org',
      'session',
      42,
      expect.objectContaining({ status: 'PENDING', checkedInAt: null, reason: 'Incorrect manual entry' }),
      transaction
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorProfileId: 'admin',
        targetMemberId: 42,
        action: 'CORRECT_REVOKE',
        reason: 'Incorrect manual entry'
      }),
      transaction
    );
  });

  it('rotates a cryptographically random code and persists only the digest', async () => {
    admin();
    const result = await changeTrainingSessionToken('org', 'admin', 'session', true);
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mocks.revokeTrainingSessionTokens.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.insertTrainingSessionToken.mock.invocationCallOrder[0]
    );
    expect(mocks.insertTrainingSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org',
        sessionId: 'session',
        digest: expect.stringMatching(/^[a-f0-9]{64}$/)
      }),
      transaction
    );
    expect(JSON.stringify(mocks.insertTrainingSessionToken.mock.calls)).not.toContain(result.token);
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain(result.token);
  });

  it('revokes codes when the session closes', async () => {
    admin();
    mocks.updateTrainingSession.mockResolvedValue([{ ...session, status: 'CLOSED' }]);
    await changeTrainingSessionStatus('org', 'admin', 'session', 'CLOSE');
    expect(mocks.revokeTrainingSessionTokens).toHaveBeenCalledWith('org', 'session', expect.any(String), transaction);
  });

  it('keeps list and detail within the same explicit supervisor member scope', async () => {
    mocks.overview.mockResolvedValue({
      memberId: 42,
      roles: ['DEPARTMENT_MANAGER'],
      canManageTraining: false,
      scopedDepartmentIds: ['assigned-group'],
      scopedMemberIds: [99]
    });
    mocks.scopedMembers.mockResolvedValue([{ id: 99 }, { id: 100 }]);
    await getTrainingSessionList('org', 'manager');
    await getTrainingSessionDetail('org', 'manager', 'session', { search: '', status: 'ALL' });
    expect(mocks.listTrainingSessions).toHaveBeenCalledWith('org', [42, 99, 100]);
    expect(mocks.listTrainingSessionAttendees).toHaveBeenCalledWith('org', 'session', [42, 99, 100]);
    expect(mocks.listTrainingSessionAudit).toHaveBeenCalledWith('org', 'session', [42, 99, 100]);
  });

  it('uses all assigned departments when previewing a fixed roster', async () => {
    admin();
    mocks.listTrainingSessionCandidates.mockResolvedValue([
      { memberId: 42, departmentId: 'primary', departmentIds: ['primary', 'second'] },
      { memberId: 99, departmentId: 'other', departmentIds: ['other'] }
    ]);
    const result = await previewTrainingSessionAudience('org', 'admin', { departmentIds: ['second'], memberIds: [] });
    expect(result.members.map((member) => member.memberId)).toEqual([42]);
  });

  it('exports more than one page with identical filtering and safe CSV cells', async () => {
    admin();
    mocks.listTrainingSessionAttendees.mockResolvedValue(
      Array.from({ length: 150 }, (_value, index) => ({
        attendance: { ...attendee, id: String(index), memberId: index + 1 },
        fullname: index === 0 ? '=HYPERLINK("bad")' : 'Target',
        email: null,
        employeeNo: String(index),
        departmentName: 'Support'
      }))
    );
    const csv = await exportTrainingSession('org', 'admin', 'session', { search: 'support', status: 'PENDING' });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.split('\r\n')).toHaveLength(151);
    expect(csv).toContain("'=HYPERLINK");
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'EXPORT' }));
  });

  it('keeps unfinished attendance pending until session end and counts late separately', () => {
    expect(sessionAttendanceDisplayStatus(session, attendee, now)).toBe('PENDING');
    expect(sessionAttendanceDisplayStatus(session, attendee, Date.parse(session.endAt))).toBe('ABSENT');
    expect(sessionAttendanceDisplayStatus({ ...session, status: 'CLOSED' }, attendee, now)).toBe('ABSENT');
    expect(
      sessionAttendanceDisplayStatus(session, { status: 'PRESENT', checkedInAt: new Date(now).toISOString() }, now)
    ).toBe('LATE');
    expect(sessionAttendanceDisplayStatus(session, { status: 'LEAVE', checkedInAt: null }, now)).toBe('LEAVE');
    expect(() => requireSessionCheckinWindow(session, Date.parse(session.checkinOpensAt))).not.toThrow();
  });

  it('rejects inverted dates and a window beyond the session end', () => {
    const draft = {
      title: 'Safety',
      instructor: '',
      location: '',
      memberIds: [42],
      startAt: session.startAt,
      endAt: session.endAt,
      checkinOpensAt: session.checkinOpensAt,
      checkinClosesAt: session.checkinClosesAt
    };
    expect(ZTrainingSessionDraft.safeParse({ ...draft, endAt: session.startAt }).success).toBe(false);
    expect(ZTrainingSessionDraft.safeParse({ ...draft, checkinClosesAt: '2026-10-13T12:00:00Z' }).success).toBe(false);
  });
});
