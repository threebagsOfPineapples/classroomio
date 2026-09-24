import { describe, expect, it } from 'vitest';
import { visibleDepartmentIds, wouldCreateDepartmentCycle } from './enterprise-scope';

describe('enterprise department scope', () => {
  it('includes an active leader department and descendants, excludes unrelated and inactive branches', () => {
    const departments = [
      { id: 'root', parentId: null, leaderMemberId: 7, status: 'ACTIVE' as const },
      { id: 'child', parentId: 'root', leaderMemberId: null, status: 'ACTIVE' as const },
      { id: 'inactive', parentId: 'root', leaderMemberId: null, status: 'INACTIVE' as const },
      { id: 'hidden', parentId: 'inactive', leaderMemberId: null, status: 'ACTIVE' as const },
      { id: 'other', parentId: null, leaderMemberId: 8, status: 'ACTIVE' as const }
    ];

    expect(visibleDepartmentIds(departments, 7).sort()).toEqual(['child', 'root']);
    expect(wouldCreateDepartmentCycle(departments, 'root', 'child')).toBe(true);
    expect(wouldCreateDepartmentCycle(departments, 'child', 'other')).toBe(false);
  });
});
