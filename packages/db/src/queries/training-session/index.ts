import { db, type DbOrTxClient } from '@db/drizzle';
import {
  course,
  department,
  group,
  organizationmember,
  profile,
  trainingOperationAudit,
  trainingPlan
} from '@db/schema';
import { trainingSession, trainingSessionAttendee, trainingSessionToken } from '@db/schema-training-sessions';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { listActiveTrainingMembers } from '../enterprise/access';

export function withTrainingSessionTransaction<T>(callback: (transaction: DbOrTxClient) => Promise<T>) {
  return db.transaction(callback);
}

export async function findTrainingSession(
  organizationId: string,
  sessionId: string,
  client: DbOrTxClient = db,
  lock = false
) {
  const query = client
    .select()
    .from(trainingSession)
    .where(and(eq(trainingSession.organizationId, organizationId), eq(trainingSession.id, sessionId)))
    .limit(1);
  const [session] = await (lock ? query.for('update') : query);
  return session ?? null;
}

export async function listTrainingSessions(
  organizationId: string,
  memberIds: number[] | null,
  client: DbOrTxClient = db
) {
  const visible =
    memberIds === null
      ? undefined
      : sql`exists (select 1 from ${trainingSessionAttendee} where ${trainingSessionAttendee.sessionId} = ${trainingSession.id} and ${trainingSessionAttendee.organizationId} = ${organizationId} and ${memberIds.length ? inArray(trainingSessionAttendee.memberId, memberIds) : sql`false`})`;
  return client
    .select()
    .from(trainingSession)
    .where(and(eq(trainingSession.organizationId, organizationId), visible))
    .orderBy(desc(trainingSession.startAt));
}

export async function listTrainingSessionCandidates(organizationId: string, client: DbOrTxClient = db) {
  const candidates = await client
    .select({
      memberId: organizationmember.id,
      fullname: profile.fullname,
      email: organizationmember.email,
      employeeNo: organizationmember.employeeNo,
      departmentId: organizationmember.departmentId,
      departmentName: department.name
    })
    .from(organizationmember)
    .leftJoin(profile, eq(profile.id, organizationmember.profileId))
    .leftJoin(
      department,
      and(eq(department.id, organizationmember.departmentId), eq(department.organizationId, organizationId))
    )
    .where(
      and(
        eq(organizationmember.organizationId, organizationId),
        eq(organizationmember.status, 'ACTIVE'),
        or(isNull(organizationmember.employmentStatus), sql`${organizationmember.employmentStatus} <> 'TERMINATED'`)
      )
    )
    .orderBy(organizationmember.id);
  const memberships = await listActiveTrainingMembers(organizationId, client);
  const departmentIdsByMember = new Map(memberships.map((member) => [member.id, member.departmentIds]));
  return candidates
    .filter((candidate) => departmentIdsByMember.has(candidate.memberId))
    .map((candidate) => ({
      ...candidate,
      departmentIds: departmentIdsByMember.get(candidate.memberId) ?? []
    }));
}

export async function trainingSessionLinksExist(
  organizationId: string,
  courseId: string | null,
  planId: string | null,
  client: DbOrTxClient
) {
  const courseRows = courseId
    ? await client
        .select({ id: course.id })
        .from(course)
        .innerJoin(group, eq(group.id, course.groupId))
        .where(and(eq(group.organizationId, organizationId), eq(course.id, courseId)))
    : [];
  const planRows = planId
    ? await client
        .select({ id: trainingPlan.id })
        .from(trainingPlan)
        .where(and(eq(trainingPlan.organizationId, organizationId), eq(trainingPlan.id, planId)))
    : [];
  return (!courseId || courseRows.length === 1) && (!planId || planRows.length === 1);
}

export function insertTrainingSession(values: typeof trainingSession.$inferInsert, client: DbOrTxClient) {
  return client.insert(trainingSession).values(values).returning();
}

export function updateTrainingSession(
  organizationId: string,
  sessionId: string,
  values: Partial<typeof trainingSession.$inferInsert>,
  client: DbOrTxClient
) {
  return client
    .update(trainingSession)
    .set(values)
    .where(and(eq(trainingSession.organizationId, organizationId), eq(trainingSession.id, sessionId)))
    .returning();
}

export async function replaceTrainingSessionAttendees(
  organizationId: string,
  sessionId: string,
  memberIds: number[],
  client: DbOrTxClient
) {
  await client
    .delete(trainingSessionAttendee)
    .where(
      and(eq(trainingSessionAttendee.organizationId, organizationId), eq(trainingSessionAttendee.sessionId, sessionId))
    );
  await client
    .insert(trainingSessionAttendee)
    .values(memberIds.map((memberId) => ({ organizationId, sessionId, memberId })));
}

export function listTrainingSessionAttendees(
  organizationId: string,
  sessionId: string,
  memberIds: number[] | null,
  client: DbOrTxClient = db
) {
  const scope =
    memberIds === null
      ? undefined
      : memberIds.length
        ? inArray(trainingSessionAttendee.memberId, memberIds)
        : sql`false`;
  return client
    .select({
      attendance: trainingSessionAttendee,
      fullname: profile.fullname,
      email: organizationmember.email,
      employeeNo: organizationmember.employeeNo,
      departmentId: organizationmember.departmentId,
      departmentName: department.name
    })
    .from(trainingSessionAttendee)
    .innerJoin(
      organizationmember,
      and(
        eq(organizationmember.id, trainingSessionAttendee.memberId),
        eq(organizationmember.organizationId, organizationId)
      )
    )
    .leftJoin(profile, eq(profile.id, organizationmember.profileId))
    .leftJoin(
      department,
      and(eq(department.id, organizationmember.departmentId), eq(department.organizationId, organizationId))
    )
    .where(
      and(
        eq(trainingSessionAttendee.organizationId, organizationId),
        eq(trainingSessionAttendee.sessionId, sessionId),
        scope
      )
    )
    .orderBy(trainingSessionAttendee.memberId);
}

export async function findTrainingSessionAttendee(
  organizationId: string,
  sessionId: string,
  memberId: number,
  client: DbOrTxClient,
  lock = false
) {
  const query = client
    .select()
    .from(trainingSessionAttendee)
    .where(
      and(
        eq(trainingSessionAttendee.organizationId, organizationId),
        eq(trainingSessionAttendee.sessionId, sessionId),
        eq(trainingSessionAttendee.memberId, memberId)
      )
    )
    .limit(1);
  const [attendee] = await (lock ? query.for('update') : query);
  return attendee ?? null;
}

export function updateTrainingSessionAttendance(
  organizationId: string,
  sessionId: string,
  memberId: number,
  values: Partial<typeof trainingSessionAttendee.$inferInsert>,
  client: DbOrTxClient
) {
  return client
    .update(trainingSessionAttendee)
    .set(values)
    .where(
      and(
        eq(trainingSessionAttendee.organizationId, organizationId),
        eq(trainingSessionAttendee.sessionId, sessionId),
        eq(trainingSessionAttendee.memberId, memberId)
      )
    )
    .returning();
}

export function revokeTrainingSessionTokens(
  organizationId: string,
  sessionId: string,
  revokedAt: string,
  client: DbOrTxClient
) {
  return client
    .update(trainingSessionToken)
    .set({ revokedAt })
    .where(
      and(
        eq(trainingSessionToken.organizationId, organizationId),
        eq(trainingSessionToken.sessionId, sessionId),
        isNull(trainingSessionToken.revokedAt)
      )
    );
}

export function insertTrainingSessionToken(values: typeof trainingSessionToken.$inferInsert, client: DbOrTxClient) {
  return client.insert(trainingSessionToken).values(values);
}

export async function findTrainingSessionToken(
  organizationId: string,
  sessionId: string,
  digest: string,
  client: DbOrTxClient
) {
  const [token] = await client
    .select()
    .from(trainingSessionToken)
    .where(
      and(
        eq(trainingSessionToken.organizationId, organizationId),
        eq(trainingSessionToken.sessionId, sessionId),
        eq(trainingSessionToken.digest, digest)
      )
    )
    .limit(1);
  return token ?? null;
}

export function listTrainingSessionAudit(organizationId: string, sessionId: string, memberIds: number[] | null) {
  const scope =
    memberIds === null
      ? undefined
      : memberIds.length
        ? inArray(trainingOperationAudit.targetMemberId, memberIds)
        : sql`false`;
  return db
    .select()
    .from(trainingOperationAudit)
    .where(
      and(
        eq(trainingOperationAudit.organizationId, organizationId),
        eq(trainingOperationAudit.resourceType, 'TRAINING_SESSION'),
        eq(trainingOperationAudit.resourceId, sessionId),
        scope
      )
    )
    .orderBy(desc(trainingOperationAudit.createdAt));
}

export async function lockActiveTrainingSessionMember(organizationId: string, memberId: number, client: DbOrTxClient) {
  const [member] = await client
    .select()
    .from(organizationmember)
    .where(and(eq(organizationmember.organizationId, organizationId), eq(organizationmember.id, memberId)))
    .for('update')
    .limit(1);
  return member ?? null;
}
