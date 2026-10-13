import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';
import { course, exercise, organization, organizationmember, profile, trainingPlan } from './schema';

export const mentorshipRelation = pgTable(
  'mentorship_relation',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id),
    learnerMemberId: bigint('learner_member_id', { mode: 'number' }).notNull(),
    mentorMemberId: bigint('mentor_member_id', { mode: 'number' }).notNull(),
    planId: uuid('plan_id'),
    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'string' }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true, mode: 'string' }).notNull(),
    status: varchar({ length: 16 }).$type<'ACTIVE' | 'ENDED'>().default('ACTIVE').notNull(),
    createdByProfileId: uuid('created_by_profile_id')
      .notNull()
      .references(() => profile.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull()
  },
  (table) => [
    unique('mentorship_relation_org_id').on(table.organizationId, table.id),
    foreignKey({
      columns: [table.organizationId, table.learnerMemberId],
      foreignColumns: [organizationmember.organizationId, organizationmember.id]
    }),
    foreignKey({
      columns: [table.organizationId, table.mentorMemberId],
      foreignColumns: [organizationmember.organizationId, organizationmember.id]
    }),
    foreignKey({
      columns: [table.organizationId, table.planId],
      foreignColumns: [trainingPlan.organizationId, trainingPlan.id]
    }),
    check('mentorship_relation_dates', sql`${table.endsAt} > ${table.startsAt}`),
    check('mentorship_relation_different_members', sql`${table.mentorMemberId} <> ${table.learnerMemberId}`),
    uniqueIndex('mentorship_relation_current_learner_plan')
      .on(table.organizationId, table.learnerMemberId, sql`coalesce(${table.planId}::text, '')`)
      .where(sql`${table.status} = 'ACTIVE'`),
    index('mentorship_relation_mentor').on(table.organizationId, table.mentorMemberId)
  ]
);

export const mentorshipHandover = pgTable(
  'mentorship_handover',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    oldRelationId: uuid('old_relation_id')
      .notNull()
      .references(() => mentorshipRelation.id),
    newRelationId: uuid('new_relation_id')
      .notNull()
      .references(() => mentorshipRelation.id),
    reason: text().notNull(),
    actorProfileId: uuid('actor_profile_id')
      .notNull()
      .references(() => profile.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull()
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.oldRelationId],
      foreignColumns: [mentorshipRelation.organizationId, mentorshipRelation.id]
    }),
    foreignKey({
      columns: [table.organizationId, table.newRelationId],
      foreignColumns: [mentorshipRelation.organizationId, mentorshipRelation.id]
    })
  ]
);

export const mentorshipTask = pgTable(
  'mentorship_task',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    relationId: uuid('relation_id').notNull(),
    title: varchar({ length: 200 }).notNull(),
    objective: text().notNull(),
    scoringCriteria: text('scoring_criteria').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true, mode: 'string' }).notNull(),
    courseId: uuid('course_id').references(() => course.id),
    exerciseId: uuid('exercise_id').references(() => exercise.id),
    examMaxScore: doublePrecision('exam_max_score'),
    examPassThreshold: integer('exam_pass_threshold'),
    examScoringFingerprint: varchar('exam_scoring_fingerprint', { length: 64 }),
    submissionType: varchar('submission_type', { length: 20 })
      .$type<'TEXT' | 'CONFIRMATION'>()
      .default('TEXT')
      .notNull(),
    maxScore: integer('max_score').default(100).notNull(),
    passScore: integer('pass_score').default(60).notNull(),
    requiresSupervisorReview: boolean('requires_supervisor_review').default(false).notNull(),
    reviewerMemberId: bigint('reviewer_member_id', { mode: 'number' }),
    certifier: varchar({ length: 16 }).$type<'MENTOR' | 'REVIEWER'>().default('MENTOR').notNull(),
    state: varchar({ length: 32 })
      .$type<
        'LEARNER_PENDING' | 'MENTOR_PENDING' | 'RETURNED' | 'SUPERVISOR_PENDING' | 'READY_TO_CERTIFY' | 'CERTIFIED'
      >()
      .default('LEARNER_PENDING')
      .notNull(),
    revision: integer().default(0).notNull(),
    createdByProfileId: uuid('created_by_profile_id')
      .notNull()
      .references(() => profile.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull()
  },
  (table) => [
    unique('mentorship_task_org_id').on(table.organizationId, table.id),
    foreignKey({
      columns: [table.organizationId, table.relationId],
      foreignColumns: [mentorshipRelation.organizationId, mentorshipRelation.id]
    }),
    foreignKey({
      columns: [table.organizationId, table.reviewerMemberId],
      foreignColumns: [organizationmember.organizationId, organizationmember.id]
    }),
    check(
      'mentorship_task_score_range',
      sql`${table.maxScore} > 0 AND ${table.passScore} >= 0 AND ${table.passScore} <= ${table.maxScore}`
    ),
    check(
      'mentorship_task_review_configuration',
      sql`(NOT ${table.requiresSupervisorReview} OR ${table.reviewerMemberId} IS NOT NULL) AND (${table.certifier} <> 'REVIEWER' OR ${table.requiresSupervisorReview})`
    ),
    index('mentorship_task_queue').on(table.organizationId, table.state, table.dueAt)
  ]
);

export const mentorshipSubmission = pgTable(
  'mentorship_submission',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    taskId: uuid('task_id').notNull(),
    round: integer().notNull(),
    content: text().notNull(),
    confirmed: boolean().notNull(),
    submittedByMemberId: bigint('submitted_by_member_id', { mode: 'number' })
      .notNull()
      .references(() => organizationmember.id),
    submittedAt: timestamp('submitted_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull()
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.taskId],
      foreignColumns: [mentorshipTask.organizationId, mentorshipTask.id]
    }),
    foreignKey({
      columns: [table.organizationId, table.submittedByMemberId],
      foreignColumns: [organizationmember.organizationId, organizationmember.id]
    }),
    unique('mentorship_submission_task_id').on(table.taskId, table.id),
    unique('mentorship_submission_round').on(table.taskId, table.round)
  ]
);

export const mentorshipReview = pgTable(
  'mentorship_review',
  {
    id: uuid().defaultRandom().primaryKey(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => mentorshipSubmission.id),
    mentorMemberId: bigint('mentor_member_id', { mode: 'number' })
      .notNull()
      .references(() => organizationmember.id),
    decision: varchar({ length: 16 }).$type<'PASS' | 'RETURN'>().notNull(),
    score: integer(),
    content: text().notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull()
  },
  (table) => [unique('mentorship_review_submission_id').on(table.submissionId, table.id)]
);

export const mentorshipSupervisorReview = pgTable(
  'mentorship_supervisor_review',
  {
    id: uuid().defaultRandom().primaryKey(),
    reviewId: uuid('review_id')
      .notNull()
      .references(() => mentorshipReview.id),
    reviewerMemberId: bigint('reviewer_member_id', { mode: 'number' })
      .notNull()
      .references(() => organizationmember.id),
    decision: varchar({ length: 16 }).$type<'PASS' | 'RETURN'>().notNull(),
    content: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull()
  },
  (table) => [unique('mentorship_supervisor_review_parent_id').on(table.reviewId, table.id)]
);

export const mentorshipCertification = pgTable(
  'mentorship_certification',
  {
    id: uuid().defaultRandom().primaryKey(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => mentorshipTask.id),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => mentorshipSubmission.id),
    reviewId: uuid('review_id')
      .notNull()
      .references(() => mentorshipReview.id),
    supervisorReviewId: uuid('supervisor_review_id').references(() => mentorshipSupervisorReview.id),
    certifierMemberId: bigint('certifier_member_id', { mode: 'number' })
      .notNull()
      .references(() => organizationmember.id),
    content: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull()
  },
  (table) => [
    unique('mentorship_certification_task').on(table.taskId),
    foreignKey({
      columns: [table.taskId, table.submissionId],
      foreignColumns: [mentorshipSubmission.taskId, mentorshipSubmission.id]
    }),
    foreignKey({
      columns: [table.submissionId, table.reviewId],
      foreignColumns: [mentorshipReview.submissionId, mentorshipReview.id]
    }),
    foreignKey({
      columns: [table.reviewId, table.supervisorReviewId],
      foreignColumns: [mentorshipSupervisorReview.reviewId, mentorshipSupervisorReview.id]
    })
  ]
);
