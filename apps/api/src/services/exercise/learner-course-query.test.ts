import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZGetRecommendedCourses } from '@cio/utils/validation/course';

const statements = vi.hoisted(() => [] as { sql: string; parameters: unknown[] }[]);

vi.mock('@db/drizzle', async () => {
  const { drizzle } = await import('drizzle-orm/pg-proxy');
  const db = drizzle(async (sql, parameters) => {
    statements.push({ sql, parameters });
    return { rows: [] };
  });
  return { db };
});

import { getExploreCourses } from '@cio/db/queries/course/course';

describe('learner catalog pagination', () => {
  beforeEach(() => {
    statements.length = 0;
  });

  it.each([
    ['lessons', 'count(distinct "lesson"."id")'],
    ['last_updated_at', 'coalesce("course"."updated_at", "course"."created_at")'],
    ['date_created', '"course"."created_at"']
  ] as const)(
    'applies %s sorting before pagination while retaining membership and organization filters',
    async (sort, expression) => {
      await getExploreCourses({
        orgId: 'org',
        profileId: 'learner',
        page: 2,
        limit: 12,
        sort,
        search: 'safety',
        required: true
      });
      const pageQuery = statements.find((statement) => statement.sql.includes('order by'));
      expect(pageQuery).toBeDefined();
      expect(pageQuery!.sql.toLowerCase()).toContain(`order by ${expression} desc`);
      expect(pageQuery!.sql.toLowerCase()).toMatch(/order by [\s\S]+"course"\."id" desc limit \$\d+ offset \$\d+$/);
      expect(pageQuery!.sql).toContain('"groupmember"."id" is null');
      expect(pageQuery!.sql).toContain('"group"."organization_id" =');
      expect(pageQuery!.parameters).toEqual(expect.arrayContaining(['org', 'learner', '%safety%', true, 12]));
      expect(pageQuery!.parameters.slice(-2)).toEqual([12, 12]);
    }
  );

  it('rejects arbitrary sort expressions at the request boundary', () => {
    expect(ZGetRecommendedCourses.safeParse({ sort: 'lessons', page: '2', limit: '12' }).success).toBe(true);
    expect(ZGetRecommendedCourses.safeParse({ sort: 'title; drop table course' }).success).toBe(false);
  });
});
