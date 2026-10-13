import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';
import { course, organization, organizationmember, profile, trainingPlan } from './schema';

export const trainingSessionStatus = pgEnum('TRAINING_SESSION_STATUS', ['DRAFT', 'PUBLISHED', 'CLOSED']);
export const trainingSessionAttendanceStatus = pgEnum('TRAINING_SESSION_ATTENDANCE_STATUS', [
  'PENDING',
  'PRESENT',
  'LEAVE'
]);

export const trainingSession = pgTable(
  'training_session',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    title: varchar({ length: 200 }).notNull(),
    courseId: uuid('course_id'),
    planId: uuid('plan_id'),
    instructor: text().notNull().default(''),
    location: text().notNull().default(''),
    startAt: timestamp('start_at', { withTimezone: true, mode: 'string' }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true, mode: 'string' }).notNull(),
    checkinOpensAt: timestamp('checkin_opens_at', { withTimezone: true, mode: 'string' }).notNull(),
    checkinClosesAt: timestamp('checkin_closes_at', { withTimezone: true, mode: 'string' }).notNull(),
    status: trainingSessionStatus().default('DRAFT').notNull(),
    createdByProfileId: uuid('created_by_profile_id').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'string' }),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull()
  },
  (table) => [
    foreignKey({ columns: [table.organizationId], foreignColumns: [organization.id] }),
    foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profile.id] }),
    foreignKey({ columns: [table.courseId], foreignColumns: [course.id] }),
    foreignKey({
      columns: [table.organizationId, table.planId],
      foreignColumns: [trainingPlan.organizationId, trainingPlan.id]
    }),
    unique('training_session_org_id_unique').on(table.organizationId, table.id),
    index('training_session_org_status_idx').on(table.organizationId, table.status),
    check(
      'training_session_dates_valid',
      sql`${table.endAt} > ${table.startAt} AND ${table.checkinClosesAt} > ${table.checkinOpensAt} AND ${table.checkinClosesAt} <= ${table.endAt}`
    )
  ]
);

export const trainingSessionAttendee = pgTable(
  'training_session_attendee',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    sessionId: uuid('session_id').notNull(),
    memberId: bigint('member_id', { mode: 'number' }).notNull(),
    status: trainingSessionAttendanceStatus().default('PENDING').notNull(),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true, mode: 'string' }),
    method: varchar({ length: 20 }),
    reason: text(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull()
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.sessionId],
      foreignColumns: [trainingSession.organizationId, trainingSession.id]
    }),
    foreignKey({
      columns: [table.organizationId, table.memberId],
      foreignColumns: [organizationmember.organizationId, organizationmember.id]
    }),
    unique('training_session_member_unique').on(table.sessionId, table.memberId),
    index('training_session_attendee_member_idx').on(table.organizationId, table.memberId),
    check(
      'training_session_present_timestamp',
      sql`(${table.status} = 'PRESENT' AND ${table.checkedInAt} IS NOT NULL) OR (${table.status} != 'PRESENT' AND ${table.checkedInAt} IS NULL)`
    )
  ]
);

export const trainingSessionToken = pgTable(
  'training_session_token',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    sessionId: uuid('session_id').notNull(),
    digest: varchar({ length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull()
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.sessionId],
      foreignColumns: [trainingSession.organizationId, trainingSession.id]
    }),
    unique('training_session_token_digest_unique').on(table.digest),
    index('training_session_token_session_idx').on(table.organizationId, table.sessionId)
  ]
);
