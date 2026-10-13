import { db, type DbOrTxClient } from '@db/drizzle';
import {
  department,
  enterpriseDepartmentScope,
  enterprisePersonScope,
  organizationMemberDepartment,
  organizationmember,
  profile,
  trainingOperationAudit
} from '@db/schema';
import { and, asc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { resolveDingtalkHeadquartersScope } from '@cio/utils/functions/dingtalk-headquarters';

export async function getTrainingHeadquartersMemberIds(organizationId: string, client: DbOrTxClient = db) {
  const departments = await client.select().from(department).where(eq(department.organizationId, organizationId));
  const sources = [
    ...new Set(
      departments
        .map((item) => item.externalSource)
        .filter((source): source is string => source?.startsWith('dingtalk:') === true)
    )
  ];
  if (!sources.length) return null;

  const activeDepartmentIds = new Set(departments.filter((item) => item.status === 'ACTIVE').map((item) => item.id));
  const allowedDepartmentIds = new Set<string>();
  for (const source of sources) {
    const sourceDepartments = departments.map((item) => ({
      ...item,
      externalId: item.externalSource === source ? item.externalId : null
    }));
    const scope = resolveDingtalkHeadquartersScope(sourceDepartments);
    for (const departmentId of scope.departmentIds) {
      if (activeDepartmentIds.has(departmentId)) allowedDepartmentIds.add(departmentId);
    }
  }

  const members = await listEnterpriseScopedMemberIds(organizationId, [...allowedDepartmentIds], [], client);
  return members.map((member) => member.id);
}

export function withEnterpriseAccessTransaction<T>(callback: (transaction: DbOrTxClient) => Promise<T>) {
  return db.transaction(callback);
}

export async function getEnterpriseMemberScopes(organizationId: string, memberId: number, client: DbOrTxClient = db) {
  const [departmentScopes, personScopes] = await Promise.all([
    client
      .select({ departmentId: enterpriseDepartmentScope.departmentId })
      .from(enterpriseDepartmentScope)
      .innerJoin(
        department,
        and(eq(department.id, enterpriseDepartmentScope.departmentId), eq(department.organizationId, organizationId))
      )
      .where(
        and(
          eq(enterpriseDepartmentScope.organizationId, organizationId),
          eq(enterpriseDepartmentScope.memberId, memberId),
          eq(department.status, 'ACTIVE')
        )
      ),
    client
      .select({ memberId: enterprisePersonScope.targetMemberId })
      .from(enterprisePersonScope)
      .where(
        and(eq(enterprisePersonScope.organizationId, organizationId), eq(enterprisePersonScope.memberId, memberId))
      )
  ]);

  return {
    departmentIds: departmentScopes.map((scope) => scope.departmentId),
    memberIds: personScopes.map((scope) => scope.memberId)
  };
}

export async function lockEnterpriseMember(organizationId: string, memberId: number, client: DbOrTxClient) {
  const [member] = await client
    .select()
    .from(organizationmember)
    .where(and(eq(organizationmember.organizationId, organizationId), eq(organizationmember.id, memberId)))
    .for('update')
    .limit(1);

  return member ?? null;
}

export async function replaceEnterpriseMemberScopes(
  organizationId: string,
  memberId: number,
  departmentIds: string[],
  memberIds: number[],
  createdByProfileId: string,
  client: DbOrTxClient
) {
  await client
    .delete(enterpriseDepartmentScope)
    .where(
      and(
        eq(enterpriseDepartmentScope.organizationId, organizationId),
        eq(enterpriseDepartmentScope.memberId, memberId)
      )
    );
  await client
    .delete(enterprisePersonScope)
    .where(and(eq(enterprisePersonScope.organizationId, organizationId), eq(enterprisePersonScope.memberId, memberId)));

  if (departmentIds.length) {
    await client
      .insert(enterpriseDepartmentScope)
      .values(departmentIds.map((departmentId) => ({ organizationId, memberId, departmentId, createdByProfileId })));
  }

  if (memberIds.length) {
    await client
      .insert(enterprisePersonScope)
      .values(memberIds.map((targetMemberId) => ({ organizationId, memberId, targetMemberId, createdByProfileId })));
  }
}

export function listEnterpriseScopedMemberIds(
  organizationId: string,
  departmentIds: string[],
  memberIds: number[],
  client: DbOrTxClient = db
) {
  const predicates = [
    ...(departmentIds.length
      ? [
          inArray(organizationmember.departmentId, departmentIds),
          inArray(
            organizationmember.id,
            client
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

  return client
    .select({ id: organizationmember.id })
    .from(organizationmember)
    .where(
      and(eq(organizationmember.organizationId, organizationId), predicates.length ? or(...predicates) : sql`false`)
    );
}

export async function getTrainingMemberDepartmentIds(
  organizationId: string,
  memberId: number,
  client: DbOrTxClient = db
) {
  const [members, memberships] = await Promise.all([
    client
      .select({ departmentId: organizationmember.departmentId })
      .from(organizationmember)
      .where(and(eq(organizationmember.organizationId, organizationId), eq(organizationmember.id, memberId)))
      .limit(1),
    client
      .select({ departmentId: organizationMemberDepartment.departmentId })
      .from(organizationMemberDepartment)
      .where(
        and(
          eq(organizationMemberDepartment.organizationId, organizationId),
          eq(organizationMemberDepartment.memberId, memberId)
        )
      )
  ]);
  if (!members.length) return [];

  return [
    ...new Set([
      ...(members[0].departmentId ? [members[0].departmentId] : []),
      ...memberships.map((membership) => membership.departmentId)
    ])
  ];
}

export async function listActiveTrainingMembers(organizationId: string, client: DbOrTxClient = db) {
  const headquartersMemberIds = await getTrainingHeadquartersMemberIds(organizationId, client);
  if (headquartersMemberIds !== null && !headquartersMemberIds.length) return [];

  const members = await client
    .select({
      id: organizationmember.id,
      profileId: organizationmember.profileId,
      email: organizationmember.email,
      departmentId: department.id,
      position: organizationmember.position,
      fullname: profile.fullname,
      employeeNo: organizationmember.employeeNo
    })
    .from(organizationmember)
    .leftJoin(profile, eq(profile.id, organizationmember.profileId))
    .leftJoin(
      department,
      and(
        eq(department.id, organizationmember.departmentId),
        eq(department.organizationId, organizationId),
        eq(department.status, 'ACTIVE')
      )
    )
    .where(
      and(
        eq(organizationmember.organizationId, organizationId),
        eq(organizationmember.status, 'ACTIVE'),
        headquartersMemberIds === null ? undefined : inArray(organizationmember.id, headquartersMemberIds),
        or(isNull(organizationmember.employmentStatus), ne(organizationmember.employmentStatus, 'TERMINATED'))
      )
    )
    .orderBy(asc(organizationmember.id));
  if (!members.length) return [];

  const memberships = await client
    .select({
      memberId: organizationMemberDepartment.memberId,
      departmentId: organizationMemberDepartment.departmentId
    })
    .from(organizationMemberDepartment)
    .innerJoin(
      department,
      and(
        eq(department.id, organizationMemberDepartment.departmentId),
        eq(department.organizationId, organizationId),
        eq(department.status, 'ACTIVE')
      )
    )
    .where(
      and(
        eq(organizationMemberDepartment.organizationId, organizationId),
        inArray(
          organizationMemberDepartment.memberId,
          members.map((member) => member.id)
        )
      )
    );
  const departmentsByMember = new Map<number, string[]>();
  for (const membership of memberships) {
    const memberDepartments = departmentsByMember.get(membership.memberId) ?? [];
    memberDepartments.push(membership.departmentId);
    departmentsByMember.set(membership.memberId, memberDepartments);
  }

  return members.map((member) => ({
    ...member,
    departmentIds: [
      ...new Set([...(member.departmentId ? [member.departmentId] : []), ...(departmentsByMember.get(member.id) ?? [])])
    ]
  }));
}

export function addTrainingOperationAudit(
  values: typeof trainingOperationAudit.$inferInsert,
  client: DbOrTxClient = db
) {
  return client.insert(trainingOperationAudit).values(values);
}
