import { db, type DbOrTxClient } from '@db/drizzle';
import { department, organization, organizationmember, profile, user, verification } from '@db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';
import type { TDingtalkState } from '@cio/utils/validation/auth/dingtalk';
import { ROLE } from '@cio/utils/constants';
import { directoryAccountKey, isActiveDingtalkMember, type getDingtalkEmployee } from '../../auth/dingtalk';

function stateIdentifier(state: string) {
  return `dingtalk:${createHash('sha256').update(state).digest('hex')}`;
}

export async function saveDingtalkState(state: string, value: TDingtalkState) {
  const identifier = stateIdentifier(state);
  const serialized = JSON.stringify(value);
  const expiresAt = new Date(Date.now() + 5 * 60_000);
  await db.insert(verification).values({ identifier, value: serialized, expiresAt });
}

export async function consumeDingtalkState(state: string): Promise<string | null> {
  const identifier = stateIdentifier(state);
  const rows = await db
    .delete(verification)
    .where(and(eq(verification.identifier, identifier), gt(verification.expiresAt, new Date())))
    .returning({ value: verification.value });
  return rows[0]?.value ?? null;
}

export function getDingtalkMember(organizationId: string, profileId: string) {
  return db
    .select({ member: organizationmember, user })
    .from(organizationmember)
    .innerJoin(user, eq(organizationmember.profileId, user.id))
    .where(and(eq(organizationmember.organizationId, organizationId), eq(organizationmember.profileId, profileId)))
    .limit(1);
}

export function findDingtalkMember(organizationId: string, corpId: string, userId: string, client: DbOrTxClient = db) {
  const source = `dingtalk:${corpId}`;
  return client
    .select({ member: organizationmember, user })
    .from(organizationmember)
    .innerJoin(user, eq(organizationmember.profileId, user.id))
    .where(
      and(
        eq(organizationmember.organizationId, organizationId),
        eq(organizationmember.externalSource, source),
        eq(organizationmember.externalId, userId)
      )
    )
    .limit(1);
}

export async function provisionDingtalkMember(
  organizationId: string,
  corpId: string,
  employee: Awaited<ReturnType<typeof getDingtalkEmployee>>,
  client: DbOrTxClient = db
) {
  return client.transaction(async (transaction) => {
    const [workspace] = await transaction
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .for('update');
    if (!workspace) return;

    const [existing] = await findDingtalkMember(organizationId, corpId, employee.userId, transaction);
    if (existing) return existing;

    const source = `dingtalk:${corpId}`;
    const accountKey = directoryAccountKey(corpId, employee.userId);
    const profileId = randomUUID();
    const email = employee.companyEmail ?? `${accountKey}@zz-train.invalid`;
    const [employeeDepartment] =
      employee.departmentIds.length === 1
        ? await transaction
            .select({ id: department.id })
            .from(department)
            .where(
              and(
                eq(department.organizationId, organizationId),
                eq(department.externalSource, source),
                eq(department.externalId, String(employee.departmentIds[0])),
                eq(department.status, 'ACTIVE')
              )
            )
            .limit(1)
        : [];
    const [createdUser] = await transaction
      .insert(user)
      .values({ id: profileId, name: employee.name, email, emailVerified: false, isAnonymous: false })
      .returning();
    await transaction.insert(profile).values({
      id: profileId,
      fullname: employee.name,
      username: `dd-${accountKey}`,
      email: employee.companyEmail,
      source,
      locale: 'zh',
      canAddCourse: false
    });
    const [member] = await transaction
      .insert(organizationmember)
      .values({
        organizationId,
        profileId,
        roleId: ROLE.STUDENT,
        email: employee.companyEmail,
        employeeNo: employee.employeeNo,
        position: employee.position,
        departmentId: employeeDepartment?.id ?? null,
        externalSource: source,
        externalId: employee.userId,
        employmentStatus: 'ACTIVE'
      })
      .returning();
    return { member, user: createdUser };
  });
}

export async function bindDingtalkMember(organizationId: string, profileId: string, corpId: string, userId: string) {
  const source = `dingtalk:${corpId}`;
  return db.transaction(async (transaction) => {
    const [current] = await transaction
      .select({ member: organizationmember, user })
      .from(organizationmember)
      .innerJoin(user, eq(organizationmember.profileId, user.id))
      .where(and(eq(organizationmember.organizationId, organizationId), eq(organizationmember.profileId, profileId)))
      .for('update');
    if (!current || !isActiveDingtalkMember(current)) return 'member_inactive' as const;

    if (
      (current.member.externalSource && current.member.externalSource !== source) ||
      (current.member.externalId && current.member.externalId !== userId)
    )
      return 'account_conflict' as const;

    const [owner] = await transaction
      .select({ id: organizationmember.id })
      .from(organizationmember)
      .where(
        and(
          eq(organizationmember.organizationId, organizationId),
          eq(organizationmember.externalSource, source),
          eq(organizationmember.externalId, userId)
        )
      );
    if (owner && owner.id !== current.member.id) return 'account_conflict' as const;

    await transaction
      .update(organizationmember)
      .set({ externalSource: source, externalId: userId })
      .where(eq(organizationmember.id, current.member.id));
    return 'linked' as const;
  });
}
