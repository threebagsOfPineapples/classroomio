import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const mocks = vi.hoisted(() => ({
  headquarters: vi.fn(),
  predicate: vi.fn(),
  updates: vi.fn(),
  updateValues: vi.fn()
}));

vi.mock('@cio/db/queries/enterprise/access', () => ({ getTrainingHeadquartersMemberIds: mocks.headquarters }));
vi.mock('@db/drizzle', async () => {
  const drizzle = await import('drizzle-orm');
  const builder = {
    from: () => builder,
    innerJoin: () => builder,
    leftJoin: () => builder,
    where: mocks.predicate,
    orderBy: () => builder
  };
  mocks.predicate.mockImplementation(() => builder);
  return { ...drizzle, db: { select: () => builder, update: mocks.updates } };
});

import { db } from '@cio/db/drizzle';
import { listMentorshipMembers, listMentorshipRelations, listMentorshipTasks } from '@cio/db/queries/mentorship';
import { updateOption, updateOptions, updateQuestion, updateQuestions } from '@cio/db/queries/exercise/exercise';

const dialect = new PgDialect();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headquarters.mockResolvedValue([1, 2]);
  mocks.updates.mockImplementation(() => ({
    set: (values: object) => {
      mocks.updateValues(values);
      return { where: () => ({ returning: async () => [{ id: 1 }] }) };
    }
  }));
});

describe('mentorship query headquarters and current mentor role boundaries', () => {
  it('candidate members have an independent headquarters predicate', async () => {
    await listMentorshipMembers('org-1');
    const predicate = mocks.predicate.mock.calls.at(-1)?.[0] as SQL;
    const rendered = dialect.sqlToQuery(predicate);
    expect(rendered.sql).toContain('"organizationmember"."id" in');
    expect(rendered.params).toEqual(['org-1', 'ACTIVE', 1, 2]);
  });

  it.each(['tasks', 'relations'])('headquarters restricts the learner outside the mentor OR in %s', async (surface) => {
    if (surface === 'tasks') await listMentorshipTasks('org-1', [2], 2, {});
    else await listMentorshipRelations('org-1', [2], 2);

    const predicate = mocks.predicate.mock.calls.at(-1)?.[0] as SQL;
    const rendered = dialect.sqlToQuery(predicate);
    expect(rendered.sql).toMatch(/and "mentorship_relation"\."learner_member_id" in \(\$\d+, \$\d+\) and \(/);
    expect(rendered.sql).toContain("= 'MENTOR'");
    expect(rendered.sql).toContain('"mentorship_relation"."mentor_member_id" in');
    expect(rendered.sql).toContain(' or ');
  });

  it('administrator null scope does not bypass headquarters in the query', async () => {
    await listMentorshipTasks('org-1', null, 3, {});
    const predicate = mocks.predicate.mock.calls.at(-1)?.[0] as SQL;
    const rendered = dialect.sqlToQuery(predicate);
    expect(rendered.sql).toContain('"mentorship_relation"."learner_member_id" in');
    expect(rendered.params).toEqual(['org-1', 1, 2]);
  });

  it('empty headquarters directory is a false predicate', async () => {
    mocks.headquarters.mockResolvedValue([]);
    await listMentorshipTasks('org-1', null, 3, {});
    const predicate = mocks.predicate.mock.calls.at(-1)?.[0] as SQL;
    expect(dialect.sqlToQuery(predicate).sql).toContain('and false');
  });
});

describe('exam scoring edit timestamps', () => {
  it.each(['question', 'option', 'questions', 'options'])(
    '%s scoring writes override stale client timestamps with a monotonically increasing database time',
    async (target) => {
      if (target === 'question') await updateQuestion(1, { points: 50, updatedAt: '2000-01-01T00:00:00Z' });
      if (target === 'option') await updateOption(1, { isCorrect: false, updatedAt: '2000-01-01T00:00:00Z' });
      if (target === 'questions')
        await updateQuestions([{ id: 1, data: { points: 100, updatedAt: '2000-01-01T00:00:00Z' } }], db);
      if (target === 'options')
        await updateOptions([{ id: 1, data: { isCorrect: true, updatedAt: '2000-01-01T00:00:00Z' } }], db);

      const values = mocks.updateValues.mock.calls[0]?.[0] as { updatedAt: SQL };
      const rendered = dialect.sqlToQuery(values.updatedAt);
      expect(rendered.sql).toContain('greatest(clock_timestamp(),');
      expect(rendered.sql).toContain("+ interval '1 microsecond'");
      expect(rendered.params).not.toContain('2000-01-01T00:00:00Z');
    }
  );
});
