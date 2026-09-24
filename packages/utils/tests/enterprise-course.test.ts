import { describe, expect, it } from 'vitest';

import { ZCourseUpdate } from '../src/validation/course/course';
import { ZGetOrganizationCoursesQuery } from '../src/validation/organization/organization';

describe('enterprise course updates', () => {
  it('accepts nullable metadata and rejects invalid status and learning values', () => {
    expect(
      ZCourseUpdate.safeParse({
        status: 'ARCHIVED',
        difficulty: 'INTERMEDIATE',
        learningMinutes: 120,
        credit: 1.5,
        targetAudience: 'New hires',
        required: true
      }).success
    ).toBe(true);

    expect(
      ZCourseUpdate.safeParse({ difficulty: null, learningMinutes: null, credit: null, required: null }).success
    ).toBe(true);

    for (const invalid of [
      { status: 'DELETED' },
      { difficulty: 'EXPERT' },
      { learningMinutes: -1 },
      { learningMinutes: 1.5 },
      { credit: -1 },
      { credit: Number.POSITIVE_INFINITY }
    ]) {
      expect(ZCourseUpdate.safeParse(invalid).success).toBe(false);
    }
  });

  it('defaults course lists to active and accepts an archived view', () => {
    expect(ZGetOrganizationCoursesQuery.parse({}).status).toBe('ACTIVE');
    expect(ZGetOrganizationCoursesQuery.parse({ status: 'ARCHIVED' }).status).toBe('ARCHIVED');
    expect(ZGetOrganizationCoursesQuery.safeParse({ status: 'DELETED' }).success).toBe(false);
  });
});
