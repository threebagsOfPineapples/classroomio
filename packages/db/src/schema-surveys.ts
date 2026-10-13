import {
  bigint,
  boolean,
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { SurveyAnswers, SurveyQuestion } from '@cio/utils/validation/survey';
import { course, department, organization, organizationmember } from './schema';

export const surveyTemplate = pgTable(
  'survey_template',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id),
    title: varchar({ length: 200 }).notNull(),
    description: text().notNull(),
    questions: jsonb().$type<SurveyQuestion[]>().notNull(),
    version: integer().notNull().default(1),
    status: varchar({ length: 16 }).$type<'DRAFT' | 'PUBLISHED'>().notNull().default('DRAFT'),
    createdByProfileId: uuid('created_by_profile_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull()
  },
  (table) => [unique('survey_template_org_id_unique').on(table.organizationId, table.id)]
);

export const surveyTask = pgTable(
  'survey_task',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id),
    templateId: uuid('template_id').notNull(),
    title: varchar({ length: 200 }).notNull(),
    purpose: varchar({ length: 32 }).$type<'NEEDS' | 'COURSE_EVALUATION'>().notNull(),
    courseId: uuid('course_id').references(() => course.id),
    anonymous: boolean().notNull(),
    audience: varchar({ length: 16 }).$type<'TARGETED' | 'ORGANIZATION'>().notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'string' }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true, mode: 'string' }).notNull(),
    status: varchar({ length: 16 }).$type<'DRAFT' | 'PUBLISHED' | 'CLOSED'>().notNull().default('DRAFT'),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'string' }),
    createdByProfileId: uuid('created_by_profile_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull()
  },
  (table) => [
    unique('survey_task_org_id_unique').on(table.organizationId, table.id),
    foreignKey({
      columns: [table.organizationId, table.templateId],
      foreignColumns: [surveyTemplate.organizationId, surveyTemplate.id]
    }),
    check('survey_task_valid_window', sql`${table.endsAt} > ${table.startsAt}`)
  ]
);

export const surveyTarget = pgTable(
  'survey_target',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    taskId: uuid('task_id').notNull(),
    memberId: bigint('member_id', { mode: 'number' }),
    departmentId: uuid('department_id')
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.taskId],
      foreignColumns: [surveyTask.organizationId, surveyTask.id]
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.organizationId, table.memberId],
      foreignColumns: [organizationmember.organizationId, organizationmember.id]
    }),
    foreignKey({
      columns: [table.organizationId, table.departmentId],
      foreignColumns: [department.organizationId, department.id]
    }),
    check('survey_target_one_reference', sql`(${table.memberId} is null) <> (${table.departmentId} is null)`)
  ]
);

export const surveyParticipation = pgTable(
  'survey_participation',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    taskId: uuid('task_id').notNull(),
    memberId: bigint('member_id', { mode: 'number' }).notNull(),
    submitted: boolean().notNull().default(false),
    draft: jsonb().$type<SurveyAnswers>()
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.taskId],
      foreignColumns: [surveyTask.organizationId, surveyTask.id]
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.organizationId, table.memberId],
      foreignColumns: [organizationmember.organizationId, organizationmember.id]
    }),
    unique('survey_participation_task_member_unique').on(table.taskId, table.memberId)
  ]
);

export const surveyAnswer = pgTable(
  'survey_answer',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    taskId: uuid('task_id').notNull(),
    memberId: bigint('member_id', { mode: 'number' }),
    answers: jsonb().$type<SurveyAnswers>().notNull()
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.taskId],
      foreignColumns: [surveyTask.organizationId, surveyTask.id]
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.organizationId, table.memberId],
      foreignColumns: [organizationmember.organizationId, organizationmember.id]
    }),
    unique('survey_answer_task_member_unique').on(table.taskId, table.memberId)
  ]
);
