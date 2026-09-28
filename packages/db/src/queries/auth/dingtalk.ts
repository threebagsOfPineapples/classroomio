import { db } from '@db/drizzle';
import { organizationmember, user, verification } from '@db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { TDingtalkState } from '@cio/utils/validation/auth/dingtalk';
import { isActiveDingtalkMember } from '../../auth/dingtalk';

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

export function findDingtalkMember(organizationId: string, corpId: string, userId: string) {
  const source = `dingtalk:${corpId}`;
  return db
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
