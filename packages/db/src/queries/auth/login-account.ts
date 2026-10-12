import { db, type DbOrTxClient, type TxClient } from '@db/drizzle';
import { account, cohortMember, groupmember, organizationmember, profile, programMember, user } from '@db/schema';
import { and, desc, eq, isNotNull, ne, sql } from 'drizzle-orm';

export function withLoginAccountTransaction<T>(action: (client: TxClient) => Promise<T>) {
  return db.transaction(action, { isolationLevel: 'serializable' });
}

export async function lockLoginUser(userId: string, client: TxClient) {
  const [loginUser] = await client.select().from(user).where(eq(user.id, userId)).for('update');
  return loginUser;
}

export async function getCredentialAccount(
  userId: string,
  client: DbOrTxClient = db
): Promise<typeof account.$inferSelect | undefined> {
  const [credential] = await client
    .select()
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))
    .orderBy(desc(isNotNull(account.password)))
    .limit(1);
  return credential;
}

export async function findLoginEmailOwner(userId: string, email: string, client: TxClient) {
  const owners = await client
    .select({ id: user.id })
    .from(user)
    .where(and(ne(user.id, userId), eq(sql`lower(trim(${user.email}))`, email)))
    .unionAll(
      client
        .select({ id: profile.id })
        .from(profile)
        .where(and(ne(profile.id, userId), eq(sql`lower(trim(${profile.email}))`, email)))
    )
    .limit(1);
  return owners[0];
}

export async function saveLoginEmail(userId: string, email: string, client: TxClient) {
  await client.update(user).set({ email, emailVerified: false }).where(eq(user.id, userId));
  const [updatedProfile] = await client
    .update(profile)
    .set({ email, isEmailVerified: false, verifiedAt: null })
    .where(eq(profile.id, userId))
    .returning();
  await client.update(organizationmember).set({ email }).where(eq(organizationmember.profileId, userId));
  await client.update(groupmember).set({ email }).where(eq(groupmember.profileId, userId));
  await client.update(cohortMember).set({ email }).where(eq(cohortMember.profileId, userId));
  await client.update(programMember).set({ email }).where(eq(programMember.profileId, userId));
  return updatedProfile;
}

export async function setCredentialPassword(userId: string, passwordHash: string, client: TxClient) {
  const credential = await getCredentialAccount(userId, client);
  if (credential) {
    await client.update(account).set({ password: passwordHash }).where(eq(account.id, credential.id));
    return;
  }

  await client.insert(account).values({ userId, accountId: userId, providerId: 'credential', password: passwordHash });
}
