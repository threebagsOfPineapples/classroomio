import { db, type DbOrTxClient } from '@db/drizzle';
import { surveyAnswer, surveyParticipation, surveyTarget, surveyTask, surveyTemplate } from '@db/schema-surveys';
import { organizationmember, profile } from '@db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { SurveyAnswers } from '@cio/utils/validation/survey';

export function withSurveyTransaction<T>(callback: (transaction: DbOrTxClient) => Promise<T>) {
  return db.transaction(callback);
}

export function listSurveyTemplates(organizationId: string) {
  return db
    .select()
    .from(surveyTemplate)
    .where(eq(surveyTemplate.organizationId, organizationId))
    .orderBy(desc(surveyTemplate.createdAt));
}

export async function getSurveyTemplate(
  organizationId: string,
  templateId: string,
  client: DbOrTxClient = db,
  lock = false
) {
  const query = client
    .select()
    .from(surveyTemplate)
    .where(and(eq(surveyTemplate.organizationId, organizationId), eq(surveyTemplate.id, templateId)))
    .limit(1);
  const [template] = await (lock ? query.for('update') : query);
  return template ?? null;
}

export async function insertSurveyTemplate(values: typeof surveyTemplate.$inferInsert, client: DbOrTxClient) {
  const [template] = await client.insert(surveyTemplate).values(values).returning();
  return template;
}

export async function updateSurveyTemplate(
  organizationId: string,
  templateId: string,
  values: Partial<typeof surveyTemplate.$inferInsert>,
  client: DbOrTxClient
) {
  const [template] = await client
    .update(surveyTemplate)
    .set(values)
    .where(and(eq(surveyTemplate.organizationId, organizationId), eq(surveyTemplate.id, templateId)))
    .returning();
  return template;
}

export function listSurveyTasks(organizationId: string) {
  return db
    .select()
    .from(surveyTask)
    .where(eq(surveyTask.organizationId, organizationId))
    .orderBy(desc(surveyTask.createdAt));
}

export async function getSurveyTask(organizationId: string, taskId: string, client: DbOrTxClient = db, lock = false) {
  const query = client
    .select()
    .from(surveyTask)
    .where(and(eq(surveyTask.organizationId, organizationId), eq(surveyTask.id, taskId)))
    .limit(1);
  const [task] = await (lock ? query.for('update') : query);
  return task ?? null;
}

export async function insertSurveyTask(values: typeof surveyTask.$inferInsert, client: DbOrTxClient) {
  const [task] = await client.insert(surveyTask).values(values).returning();
  return task;
}

export function insertSurveyTargets(values: (typeof surveyTarget.$inferInsert)[], client: DbOrTxClient) {
  if (!values.length) return Promise.resolve();

  return client.insert(surveyTarget).values(values);
}

export function listSurveyTargets(taskId: string, client: DbOrTxClient = db) {
  return client.select().from(surveyTarget).where(eq(surveyTarget.taskId, taskId));
}

export function updateSurveyTask(
  taskId: string,
  values: Partial<typeof surveyTask.$inferInsert>,
  client: DbOrTxClient
) {
  return client.update(surveyTask).set(values).where(eq(surveyTask.id, taskId));
}

export function insertSurveyParticipants(values: (typeof surveyParticipation.$inferInsert)[], client: DbOrTxClient) {
  if (!values.length) return Promise.resolve();

  return client
    .insert(surveyParticipation)
    .values(values)
    .onConflictDoNothing({ target: [surveyParticipation.taskId, surveyParticipation.memberId] });
}

export async function getSurveyParticipation(taskId: string, memberId: number, client: DbOrTxClient = db) {
  const [participation] = await client
    .select()
    .from(surveyParticipation)
    .where(and(eq(surveyParticipation.taskId, taskId), eq(surveyParticipation.memberId, memberId)))
    .limit(1);
  return participation ?? null;
}

export function updateSurveyParticipation(
  taskId: string,
  memberId: number,
  values: { submitted?: boolean; draft: SurveyAnswers | null },
  client: DbOrTxClient
) {
  return client
    .update(surveyParticipation)
    .set(values)
    .where(and(eq(surveyParticipation.taskId, taskId), eq(surveyParticipation.memberId, memberId)));
}

export function insertSurveyAnswer(values: typeof surveyAnswer.$inferInsert, client: DbOrTxClient) {
  return client.insert(surveyAnswer).values(values);
}

export function listSurveyParticipation(taskId: string, client: DbOrTxClient = db) {
  return client
    .select({
      memberId: surveyParticipation.memberId,
      submitted: surveyParticipation.submitted,
      email: organizationmember.email,
      employeeNo: organizationmember.employeeNo,
      fullname: profile.fullname
    })
    .from(surveyParticipation)
    .innerJoin(organizationmember, eq(organizationmember.id, surveyParticipation.memberId))
    .leftJoin(profile, eq(profile.id, organizationmember.profileId))
    .where(eq(surveyParticipation.taskId, taskId));
}

export function listSurveyAnswers(taskId: string, memberIds: number[] | null) {
  if (memberIds && !memberIds.length) return Promise.resolve([]);

  return db
    .select({ memberId: surveyAnswer.memberId, answers: surveyAnswer.answers })
    .from(surveyAnswer)
    .where(and(eq(surveyAnswer.taskId, taskId), memberIds ? inArray(surveyAnswer.memberId, memberIds) : undefined));
}
