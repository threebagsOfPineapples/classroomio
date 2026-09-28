import { and, asc, db, eq, ilike, isNotNull, or } from '@db/drizzle';
import * as schema from '@db/schema';
import { ROLE } from '@cio/utils/constants';
import type { DbOrTxClient } from '@db/drizzle';

export async function getCourseQuestionBank(
  courseId: string,
  profileId: string,
  search: string,
  page: number,
  dbClient: DbOrTxClient = db
) {
  const [context] = await dbClient
    .select({ organizationId: schema.group.organizationId })
    .from(schema.course)
    .innerJoin(schema.group, eq(schema.course.groupId, schema.group.id))
    .where(eq(schema.course.id, courseId))
    .limit(1);
  if (!context?.organizationId) return [];

  return dbClient
    .select({
      id: schema.question.id,
      title: schema.question.title,
      points: schema.question.points,
      questionTypeId: schema.question.questionTypeId,
      updatedAt: schema.question.updatedAt,
      courseId: schema.course.id,
      courseTitle: schema.course.title,
      exerciseId: schema.exercise.id,
      exerciseTitle: schema.exercise.title
    })
    .from(schema.question)
    .innerJoin(schema.exercise, eq(schema.question.exerciseId, schema.exercise.id))
    .innerJoin(schema.course, eq(schema.exercise.courseId, schema.course.id))
    .innerJoin(schema.group, eq(schema.course.groupId, schema.group.id))
    .innerJoin(
      schema.organizationmember,
      and(
        eq(schema.organizationmember.organizationId, schema.group.organizationId),
        eq(schema.organizationmember.profileId, profileId),
        eq(schema.organizationmember.status, 'ACTIVE')
      )
    )
    .leftJoin(
      schema.groupmember,
      and(
        eq(schema.groupmember.groupId, schema.group.id),
        eq(schema.groupmember.profileId, profileId),
        or(eq(schema.groupmember.roleId, ROLE.ADMIN), eq(schema.groupmember.roleId, ROLE.TUTOR))
      )
    )
    .where(
      and(
        eq(schema.group.organizationId, context.organizationId),
        or(eq(schema.organizationmember.roleId, ROLE.ADMIN), isNotNull(schema.groupmember.id)),
        search ? ilike(schema.question.title, `%${search}%`) : undefined
      )
    )
    .orderBy(asc(schema.course.title), asc(schema.exercise.title), asc(schema.question.order), asc(schema.question.id))
    .limit(50)
    .offset((page - 1) * 50);
}
