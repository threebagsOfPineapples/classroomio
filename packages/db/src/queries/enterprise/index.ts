import { db } from '@db/drizzle';
import {
  course,
  department,
  exercise,
  group,
  groupmember,
  organizationMemberEnterpriseRole,
  organizationMemberDepartment,
  organizationmember,
  profile,
  question,
  submission
} from '@db/schema';
import { QUESTION_TYPE_IDS } from '@cio/question-types';
import { and, asc, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';

export async function listPendingGradingSubmissions(organizationId: string) {
  const rows = await db
    .select({
      id: submission.id,
      exerciseId: exercise.id,
      courseId: course.id,
      courseTitle: course.title,
      exerciseTitle: exercise.title,
      isExam: exercise.isExam,
      learnerName: profile.fullname,
      submittedAt: submission.createdAt
    })
    .from(submission)
    .innerJoin(course, eq(submission.courseId, course.id))
    .innerJoin(group, eq(course.groupId, group.id))
    .innerJoin(exercise, eq(submission.exerciseId, exercise.id))
    .leftJoin(groupmember, eq(submission.submittedBy, groupmember.id))
    .leftJoin(profile, eq(groupmember.profileId, profile.id))
    .where(and(eq(group.organizationId, organizationId), eq(submission.gradingState, 'awaiting_manual')))
    .orderBy(desc(submission.createdAt))
    .limit(20);

  const exerciseIds = [...new Set(rows.map((row) => row.exerciseId))];
  const writtenQuestions = exerciseIds.length
    ? await db
        .select({ exerciseId: question.exerciseId })
        .from(question)
        .where(
          and(
            inArray(question.exerciseId, exerciseIds),
            inArray(question.questionTypeId, [QUESTION_TYPE_IDS.TEXTAREA, QUESTION_TYPE_IDS.SHORT_ANSWER])
          )
        )
    : [];
  const writtenExerciseIds = new Set(writtenQuestions.map((item) => item.exerciseId));
  return rows.map((row) => ({ ...row, hasWrittenQuestion: writtenExerciseIds.has(row.exerciseId) }));
}

export function getEnterpriseMemberByProfile(organizationId: string, profileId: string) {
  return db
    .select()
    .from(organizationmember)
    .where(
      and(
        eq(organizationmember.organizationId, organizationId),
        eq(organizationmember.profileId, profileId),
        eq(organizationmember.status, 'ACTIVE')
      )
    )
    .limit(1);
}

export function getEnterpriseMember(organizationId: string, memberId: number) {
  return db
    .select()
    .from(organizationmember)
    .where(and(eq(organizationmember.organizationId, organizationId), eq(organizationmember.id, memberId)))
    .limit(1);
}

export function listEnterpriseRoles(organizationId: string, memberId: number) {
  return db
    .select({ role: organizationMemberEnterpriseRole.role })
    .from(organizationMemberEnterpriseRole)
    .where(
      and(
        eq(organizationMemberEnterpriseRole.organizationId, organizationId),
        eq(organizationMemberEnterpriseRole.memberId, memberId)
      )
    );
}

export function listEnterpriseDepartments(organizationId: string) {
  return db
    .select()
    .from(department)
    .where(eq(department.organizationId, organizationId))
    .orderBy(asc(department.sort), asc(department.name));
}

export function createEnterpriseDepartment(values: typeof department.$inferInsert) {
  return db.insert(department).values(values).returning();
}

export function updateEnterpriseDepartment(
  organizationId: string,
  departmentId: string,
  values: Partial<typeof department.$inferInsert>
) {
  return db
    .update(department)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(and(eq(department.organizationId, organizationId), eq(department.id, departmentId)))
    .returning();
}

export function listEnterpriseEmployees(
  organizationId: string,
  departmentIds?: string[],
  selfMemberId?: number,
  scopedMemberIds: number[] = []
) {
  const memberIds = [...new Set([...scopedMemberIds, ...(selfMemberId ? [selfMemberId] : [])])];
  const predicates = [
    ...(departmentIds?.length
      ? [
          inArray(organizationmember.departmentId, departmentIds),
          inArray(
            organizationmember.id,
            db
              .select({ memberId: organizationMemberDepartment.memberId })
              .from(organizationMemberDepartment)
              .where(
                and(
                  eq(organizationMemberDepartment.organizationId, organizationId),
                  inArray(organizationMemberDepartment.departmentId, departmentIds)
                )
              )
          )
        ]
      : []),
    ...(memberIds.length ? [inArray(organizationmember.id, memberIds)] : [])
  ];
  const scope = departmentIds === undefined ? undefined : predicates.length ? or(...predicates) : sql`false`;

  return db
    .select({
      member: {
        id: organizationmember.id,
        roleId: organizationmember.roleId,
        email: organizationmember.email,
        employeeNo: organizationmember.employeeNo,
        departmentId: organizationmember.departmentId,
        position: organizationmember.position,
        managerMemberId: organizationmember.managerMemberId,
        employmentStatus: organizationmember.employmentStatus,
        joinDate: organizationmember.joinDate,
        status: organizationmember.status
      },
      fullname: profile.fullname,
      email: profile.email
    })
    .from(organizationmember)
    .leftJoin(profile, eq(organizationmember.profileId, profile.id))
    .where(and(eq(organizationmember.organizationId, organizationId), ne(organizationmember.status, 'ARCHIVED'), scope))
    .orderBy(asc(organizationmember.id));
}

export function updateEnterpriseEmployee(
  organizationId: string,
  memberId: number,
  values: Partial<typeof organizationmember.$inferInsert>
) {
  return db.transaction(async (transaction) => {
    const [previous] = await transaction
      .select({ departmentId: organizationmember.departmentId })
      .from(organizationmember)
      .where(and(eq(organizationmember.organizationId, organizationId), eq(organizationmember.id, memberId)))
      .for('update')
      .limit(1);
    const members = await transaction
      .update(organizationmember)
      .set(values)
      .where(and(eq(organizationmember.organizationId, organizationId), eq(organizationmember.id, memberId)))
      .returning();
    if (!members.length || values.departmentId === undefined || values.departmentId === previous?.departmentId)
      return members;

    if (previous?.departmentId) {
      await transaction
        .delete(organizationMemberDepartment)
        .where(
          and(
            eq(organizationMemberDepartment.organizationId, organizationId),
            eq(organizationMemberDepartment.memberId, memberId),
            eq(organizationMemberDepartment.departmentId, previous.departmentId),
            eq(organizationMemberDepartment.source, 'MANUAL')
          )
        );
    }
    if (values.departmentId) {
      await transaction
        .insert(organizationMemberDepartment)
        .values({
          organizationId,
          memberId,
          departmentId: values.departmentId,
          source: 'MANUAL'
        })
        .onConflictDoNothing();
    }

    return members;
  });
}

export function replaceEnterpriseRoles(
  organizationId: string,
  memberId: number,
  roles: (typeof organizationMemberEnterpriseRole.$inferInsert)['role'][],
  createdByProfileId: string
) {
  return db.transaction(async (transaction) => {
    await transaction
      .delete(organizationMemberEnterpriseRole)
      .where(
        and(
          eq(organizationMemberEnterpriseRole.organizationId, organizationId),
          eq(organizationMemberEnterpriseRole.memberId, memberId)
        )
      );

    if (roles.length) {
      await transaction
        .insert(organizationMemberEnterpriseRole)
        .values(roles.map((role) => ({ organizationId, memberId, role, createdByProfileId })));
    }

    return roles;
  });
}
