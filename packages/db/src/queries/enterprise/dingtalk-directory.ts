import { db, type DbOrTxClient, type TxClient } from '@db/drizzle';
import {
  department,
  organization,
  organizationmember,
  organizationMemberEnterpriseRole,
  profile,
  user,
  verification
} from '@db/schema';
import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { TDingtalkDirectorySnapshot } from '@cio/utils/validation/auth/dingtalk';

function previewIdentifier(organizationId: string, profileId: string, token: string) {
  const digest = createHash('sha256').update(token).digest('hex');
  return `dingtalk-directory:${organizationId}:${profileId}:${digest}`;
}

export async function readDingtalkDirectoryState(organizationId: string, emails: string[], client: DbOrTxClient = db) {
  const departments = await client
    .select()
    .from(department)
    .where(eq(department.organizationId, organizationId))
    .orderBy(department.id);
  const members = await client
    .select({ member: organizationmember, user, profile })
    .from(organizationmember)
    .leftJoin(user, eq(organizationmember.profileId, user.id))
    .leftJoin(profile, eq(organizationmember.profileId, profile.id))
    .where(eq(organizationmember.organizationId, organizationId))
    .orderBy(organizationmember.id);
  const roles = await client
    .select()
    .from(organizationMemberEnterpriseRole)
    .where(eq(organizationMemberEnterpriseRole.organizationId, organizationId))
    .orderBy(organizationMemberEnterpriseRole.memberId, organizationMemberEnterpriseRole.role);
  const emailOwners = emails.length
    ? await client
        .select({ id: user.id, email: user.email })
        .from(user)
        .where(inArray(sql`lower(${user.email})`, emails))
        .orderBy(user.id)
    : [];
  const profileEmailOwners = emails.length
    ? await client
        .select({ id: profile.id, email: profile.email })
        .from(profile)
        .where(inArray(sql`lower(${profile.email})`, emails))
        .orderBy(profile.id)
    : [];
  return { departments, members, roles, emailOwners, profileEmailOwners };
}

export async function saveDingtalkDirectoryPreview(token: string, value: TDingtalkDirectorySnapshot) {
  const identifier = previewIdentifier(value.organizationId, value.profileId, token);
  const serialized = JSON.stringify(value);
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  await db.insert(verification).values({ identifier, value: serialized, expiresAt });
}

export async function withDingtalkDirectoryPreview<T>(
  organizationId: string,
  profileId: string,
  token: string,
  action: (client: TxClient, stored: { id: string; value: string } | undefined) => Promise<T>
) {
  const identifier = previewIdentifier(organizationId, profileId, token);
  return db.transaction(
    async (client) => {
      await client
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .for('update');
      const [stored] = await client
        .select({ id: verification.id, value: verification.value })
        .from(verification)
        .where(and(eq(verification.identifier, identifier), gt(verification.expiresAt, new Date())))
        .for('update');
      return action(client, stored);
    },
    { isolationLevel: 'serializable' }
  );
}

export async function finishDingtalkDirectoryPreview(client: TxClient, id: string, value: TDingtalkDirectorySnapshot) {
  const serialized = JSON.stringify(value);
  await client.update(verification).set({ value: serialized }).where(eq(verification.id, id));
}

export async function applyDingtalkDirectoryDepartments(client: TxClient, rows: (typeof department.$inferInsert)[]) {
  for (const row of rows) {
    const updatedAt = new Date().toISOString();
    await client
      .insert(department)
      .values(row)
      .onConflictDoUpdate({
        target: department.id,
        set: { name: row.name, parentId: row.parentId, sort: row.sort, updatedAt }
      });
  }
}

export async function createDingtalkDirectoryEmployees(
  client: TxClient,
  users: (typeof user.$inferInsert)[],
  profiles: (typeof profile.$inferInsert)[],
  members: (typeof organizationmember.$inferInsert)[]
) {
  for (let index = 0; index < users.length; index += 200) {
    await client.insert(user).values(users.slice(index, index + 200));
    await client.insert(profile).values(profiles.slice(index, index + 200));
    await client.insert(organizationmember).values(members.slice(index, index + 200));
  }
}

export async function updateDingtalkDirectoryEmployee(
  client: TxClient,
  organizationId: string,
  memberId: number,
  profileId: string,
  name: string,
  values: Pick<typeof organizationmember.$inferInsert, 'employeeNo' | 'position' | 'departmentId' | 'email'>
) {
  await client
    .update(organizationmember)
    .set(values)
    .where(and(eq(organizationmember.organizationId, organizationId), eq(organizationmember.id, memberId)));
  await client.update(user).set({ name }).where(eq(user.id, profileId));
  const updatedAt = new Date().toISOString();
  await client.update(profile).set({ fullname: name, updatedAt }).where(eq(profile.id, profileId));
}
