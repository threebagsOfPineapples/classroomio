import { createHash, randomBytes } from 'node:crypto';
import { addTrainingOperationAudit, getTrainingHeadquartersMemberIds } from '@cio/db/queries/enterprise/access';
import {
  findTrainingSession,
  findTrainingSessionAttendee,
  findTrainingSessionToken,
  insertTrainingSession,
  insertTrainingSessionToken,
  listTrainingSessionAttendees,
  listTrainingSessionAudit,
  listTrainingSessionCandidates,
  listTrainingSessions,
  lockActiveTrainingSessionMember,
  replaceTrainingSessionAttendees,
  revokeTrainingSessionTokens,
  trainingSessionLinksExist,
  updateTrainingSession,
  updateTrainingSessionAttendance,
  withTrainingSessionTransaction
} from '@cio/db/queries/training-session';
import type {
  TTrainingSessionCorrection,
  TTrainingSessionDraft,
  TTrainingSessionFilter,
  TTrainingSessionSelection
} from '@cio/utils/validation/training-session';
import {
  loadActiveTrainingActor,
  requireTrainingAdministrator,
  requireTrainingReportReader,
  resolveTrainingReadScope
} from './training-access';
import {
  requireSessionCheckinWindow,
  sessionAttendanceDisplayStatus,
  trainingSessionError
} from './training-session-policy';

function tokenDigest(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function activeMember(
  member: Awaited<ReturnType<typeof lockActiveTrainingSessionMember>>,
  headquartersMemberIds: number[] | null
) {
  if (!member || member.status !== 'ACTIVE' || member.employmentStatus === 'TERMINATED')
    trainingSessionError('inactive', 403);
  if (headquartersMemberIds !== null && !headquartersMemberIds.includes(member.id))
    trainingSessionError('invalid_audience', 403);

  return member;
}

export async function getTrainingSessionCandidates(organizationId: string, profileId: string) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  requireTrainingAdministrator(actor);
  return listTrainingSessionCandidates(organizationId);
}

export async function previewTrainingSessionAudience(
  organizationId: string,
  profileId: string,
  selection: TTrainingSessionSelection
) {
  const candidates = await getTrainingSessionCandidates(organizationId, profileId);
  const selected = candidates.filter(
    (candidate) =>
      selection.memberIds.includes(candidate.memberId) ||
      candidate.departmentIds.some((departmentId) => selection.departmentIds.includes(departmentId))
  );
  if (selection.memberIds.some((memberId) => !candidates.some((candidate) => candidate.memberId === memberId)))
    trainingSessionError('invalid_audience');
  return { count: selected.length, members: selected };
}

export async function saveTrainingSessionDraft(
  organizationId: string,
  profileId: string,
  data: TTrainingSessionDraft,
  sessionId?: string
) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  requireTrainingAdministrator(actor);
  return withTrainingSessionTransaction(async (transaction) => {
    const existing = sessionId ? await findTrainingSession(organizationId, sessionId, transaction, true) : null;
    if (sessionId && !existing) trainingSessionError('not_found', 404);
    if (existing && existing.status !== 'DRAFT') trainingSessionError('draft_only', 409);
    const memberIds = [...new Set(data.memberIds)].sort((left, right) => left - right);
    const headquartersMemberIds = await getTrainingHeadquartersMemberIds(organizationId, transaction);
    for (const memberId of memberIds)
      activeMember(await lockActiveTrainingSessionMember(organizationId, memberId, transaction), headquartersMemberIds);
    const validLinks = await trainingSessionLinksExist(
      organizationId,
      data.courseId ?? null,
      data.planId ?? null,
      transaction
    );
    if (!validLinks) trainingSessionError('invalid_link');
    const { memberIds: selectedMemberIds, ...draft } = data;
    const now = new Date().toISOString();
    const values = { ...draft, courseId: draft.courseId ?? null, planId: draft.planId ?? null, updatedAt: now };
    const [session] = existing
      ? await updateTrainingSession(organizationId, existing.id, values, transaction)
      : await insertTrainingSession({ ...values, organizationId, createdByProfileId: profileId }, transaction);
    await replaceTrainingSessionAttendees(organizationId, session.id, memberIds, transaction);
    await addTrainingOperationAudit(
      {
        organizationId,
        actorProfileId: profileId,
        resourceType: 'TRAINING_SESSION',
        resourceId: session.id,
        action: existing ? 'UPDATE_DRAFT' : 'CREATE_DRAFT'
      },
      transaction
    );
    return session;
  });
}

export async function getTrainingSessionList(organizationId: string, profileId: string, mine = false) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  if (mine) {
    const sessions = await listTrainingSessions(organizationId, [actor.memberId]);
    return sessions.filter((session) => session.status !== 'DRAFT');
  }
  requireTrainingReportReader(actor);
  const scope = await resolveTrainingReadScope(actor);
  return listTrainingSessions(organizationId, scope.type === 'ALL' ? null : scope.memberIds);
}

export async function getTrainingSessionDetail(
  organizationId: string,
  profileId: string,
  sessionId: string,
  filter: TTrainingSessionFilter,
  mine = false
) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  if (!mine) requireTrainingReportReader(actor);
  const scope = mine
    ? { type: 'MEMBERS' as const, memberIds: [actor.memberId] }
    : await resolveTrainingReadScope(actor);
  const memberIds = scope.type === 'ALL' ? null : scope.memberIds;
  const session = await findTrainingSession(organizationId, sessionId);
  if (!session) trainingSessionError('not_found', 404);
  const attendees = await listTrainingSessionAttendees(organizationId, sessionId, memberIds);
  if (scope.type === 'MEMBERS' && !attendees.length) trainingSessionError('not_eligible', 403);
  if (mine && session.status === 'DRAFT') trainingSessionError('not_open', 409);
  const now = Date.now();
  const visible = attendees.map((attendee) => ({
    ...attendee,
    displayStatus: sessionAttendanceDisplayStatus(session, attendee.attendance, now)
  }));
  const search = filter.search.toLocaleLowerCase();
  const filtered = visible.filter(
    (attendee) =>
      (filter.status === 'ALL' || attendee.displayStatus === filter.status) &&
      [attendee.fullname, attendee.email, attendee.employeeNo, attendee.departmentName].some((value) =>
        value?.toLocaleLowerCase().includes(search)
      )
  );
  const summary = {
    expected: visible.length,
    present: visible.filter((attendee) => ['PRESENT', 'LATE'].includes(attendee.displayStatus)).length,
    leave: visible.filter((attendee) => attendee.displayStatus === 'LEAVE').length,
    pending: visible.filter((attendee) => attendee.displayStatus === 'PENDING').length,
    absent: visible.filter((attendee) => attendee.displayStatus === 'ABSENT').length
  };
  const audit = mine ? [] : await listTrainingSessionAudit(organizationId, sessionId, memberIds);
  return {
    session,
    attendees: filtered,
    summary,
    audit,
    canManage: actor.canManageTraining && !mine,
    asOf: new Date(now).toISOString()
  };
}

export async function changeTrainingSessionStatus(
  organizationId: string,
  profileId: string,
  sessionId: string,
  action: 'PUBLISH' | 'CLOSE'
) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  requireTrainingAdministrator(actor);
  return withTrainingSessionTransaction(async (transaction) => {
    const session = await findTrainingSession(organizationId, sessionId, transaction, true);
    if (!session) trainingSessionError('not_found', 404);
    if (action === 'PUBLISH' && session.status !== 'DRAFT') trainingSessionError('draft_only', 409);
    if (action === 'CLOSE' && session.status !== 'PUBLISHED') trainingSessionError('closed', 409);
    const now = new Date().toISOString();
    if (action === 'PUBLISH') {
      if (Date.parse(session.checkinClosesAt) <= Date.now()) trainingSessionError('expired');
      const attendees = await listTrainingSessionAttendees(organizationId, sessionId, null, transaction);
      if (!attendees.length) trainingSessionError('invalid_audience');
      const headquartersMemberIds = await getTrainingHeadquartersMemberIds(organizationId, transaction);
      for (const attendee of attendees)
        activeMember(
          await lockActiveTrainingSessionMember(organizationId, attendee.attendance.memberId, transaction),
          headquartersMemberIds
        );
    }
    const [updated] = await updateTrainingSession(
      organizationId,
      sessionId,
      {
        status: action === 'PUBLISH' ? 'PUBLISHED' : 'CLOSED',
        publishedAt: action === 'PUBLISH' ? now : session.publishedAt,
        closedAt: action === 'CLOSE' ? now : null,
        updatedAt: now
      },
      transaction
    );
    if (action === 'CLOSE') await revokeTrainingSessionTokens(organizationId, sessionId, now, transaction);
    await addTrainingOperationAudit(
      { organizationId, actorProfileId: profileId, resourceType: 'TRAINING_SESSION', resourceId: sessionId, action },
      transaction
    );
    return updated;
  });
}

export async function changeTrainingSessionToken(
  organizationId: string,
  profileId: string,
  sessionId: string,
  issue: boolean
) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  requireTrainingAdministrator(actor);
  return withTrainingSessionTransaction(async (transaction) => {
    const session = await findTrainingSession(organizationId, sessionId, transaction, true);
    if (!session) trainingSessionError('not_found', 404);
    if (session.status !== 'PUBLISHED') trainingSessionError('closed', 409);
    if (issue && Date.now() >= Date.parse(session.checkinClosesAt)) trainingSessionError('expired', 409);
    const now = new Date().toISOString();
    await revokeTrainingSessionTokens(organizationId, sessionId, now, transaction);
    const token = issue ? randomBytes(32).toString('base64url') : null;
    const expiresAt = issue ? session.checkinClosesAt : null;
    if (token && expiresAt) {
      const digest = tokenDigest(token);
      await insertTrainingSessionToken({ organizationId, sessionId, digest, expiresAt }, transaction);
    }
    await addTrainingOperationAudit(
      {
        organizationId,
        actorProfileId: profileId,
        resourceType: 'TRAINING_SESSION',
        resourceId: sessionId,
        action: issue ? 'ROTATE_TOKEN' : 'REVOKE_TOKEN'
      },
      transaction
    );
    return { token, expiresAt };
  });
}

export async function checkInTrainingSession(
  organizationId: string,
  profileId: string,
  sessionId: string,
  rawToken: string
) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  return withTrainingSessionTransaction(async (transaction) => {
    const session = await findTrainingSession(organizationId, sessionId, transaction, true);
    if (!session) trainingSessionError('not_found', 404);
    const headquartersMemberIds = await getTrainingHeadquartersMemberIds(organizationId, transaction);
    activeMember(
      await lockActiveTrainingSessionMember(organizationId, actor.memberId, transaction),
      headquartersMemberIds
    );
    const attendee = await findTrainingSessionAttendee(organizationId, sessionId, actor.memberId, transaction, true);
    if (!attendee) trainingSessionError('not_eligible', 403);
    const now = Date.now();
    requireSessionCheckinWindow(session, now);
    const digest = tokenDigest(rawToken);
    const token = await findTrainingSessionToken(organizationId, sessionId, digest, transaction);
    if (!token || token.revokedAt || Date.parse(token.expiresAt) <= now) trainingSessionError('invalid_token', 409);
    if (attendee.status === 'PRESENT') return { attendance: attendee, duplicate: true };
    if (attendee.status === 'LEAVE') trainingSessionError('leave', 409);
    const checkedInAt = new Date(now).toISOString();
    const [attendance] = await updateTrainingSessionAttendance(
      organizationId,
      sessionId,
      actor.memberId,
      { status: 'PRESENT', checkedInAt, method: 'SELF', reason: null, updatedAt: checkedInAt },
      transaction
    );
    await addTrainingOperationAudit(
      {
        organizationId,
        actorProfileId: profileId,
        targetMemberId: actor.memberId,
        resourceType: 'TRAINING_SESSION',
        resourceId: sessionId,
        action: 'SELF_CHECKIN'
      },
      transaction
    );
    return { attendance, duplicate: false };
  });
}

export async function correctTrainingSessionAttendance(
  organizationId: string,
  profileId: string,
  sessionId: string,
  data: TTrainingSessionCorrection
) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  requireTrainingAdministrator(actor);
  return withTrainingSessionTransaction(async (transaction) => {
    const session = await findTrainingSession(organizationId, sessionId, transaction, true);
    if (!session) trainingSessionError('not_found', 404);
    if (session.status === 'DRAFT') trainingSessionError('not_open', 409);
    const attendee = await findTrainingSessionAttendee(organizationId, sessionId, data.memberId, transaction, true);
    if (!attendee) trainingSessionError('not_eligible', 403);
    const headquartersMemberIds = await getTrainingHeadquartersMemberIds(organizationId, transaction);
    if (headquartersMemberIds !== null && !headquartersMemberIds.includes(data.memberId))
      trainingSessionError('not_eligible', 403);

    const now = new Date().toISOString();
    const status = data.action === 'REVOKE' ? 'PENDING' : data.action;
    const [attendance] = await updateTrainingSessionAttendance(
      organizationId,
      sessionId,
      data.memberId,
      { status, checkedInAt: status === 'PRESENT' ? now : null, method: 'ADMIN', reason: data.reason, updatedAt: now },
      transaction
    );
    await addTrainingOperationAudit(
      {
        organizationId,
        actorProfileId: profileId,
        targetMemberId: data.memberId,
        resourceType: 'TRAINING_SESSION',
        resourceId: sessionId,
        action: `CORRECT_${data.action}`,
        reason: data.reason
      },
      transaction
    );
    return attendance;
  });
}

export async function exportTrainingSession(
  organizationId: string,
  profileId: string,
  sessionId: string,
  filter: TTrainingSessionFilter
) {
  const detail = await getTrainingSessionDetail(organizationId, profileId, sessionId, filter);
  await addTrainingOperationAudit({
    organizationId,
    actorProfileId: profileId,
    resourceType: 'TRAINING_SESSION',
    resourceId: sessionId,
    action: 'EXPORT',
    reason: JSON.stringify({ filter, count: detail.attendees.length, asOf: detail.asOf })
  });
  const cell = (value: unknown) => {
    const raw = String(value ?? '');
    const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const rows = [
    [
      'session',
      'member_id',
      'employee_no',
      'name',
      'department',
      'status',
      'checked_in_at',
      'method',
      'reason',
      'as_of'
    ],
    ...detail.attendees.map((row) => [
      detail.session.title,
      row.attendance.memberId,
      row.employeeNo,
      row.fullname ?? row.email,
      row.departmentName,
      row.displayStatus,
      row.attendance.checkedInAt,
      row.attendance.method,
      row.attendance.reason,
      detail.asOf
    ])
  ];
  return '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n');
}
