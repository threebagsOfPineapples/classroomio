import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { department } from '@cio/db/schema';

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('@db/drizzle', async () => {
  const orm = await import('drizzle-orm');
  const proxy = await import('drizzle-orm/pg-proxy');
  const database = proxy.drizzle(mocks.execute);

  return { ...orm, db: database };
});

import { getTrainingHeadquartersMemberIds } from '@cio/db/queries/enterprise/access';
import { getEligibleTrainingMembers } from '@cio/db/queries/training-plan';

const departmentColumns = Object.keys(getTableColumns(department));

function departmentRow(id: string, parentId: string | null, externalId: string, status = 'ACTIVE') {
  const values: Record<string, unknown> = {
    id,
    organizationId: 'org-1',
    parentId,
    externalId,
    externalSource: 'dingtalk:test',
    status
  };

  return departmentColumns.map((column) => values[column] ?? null);
}

beforeEach(() => {
  mocks.execute.mockReset();
});

describe('training plan query boundaries', () => {
  it('uses headquarters, active membership and organization predicates with all active department relationships', async () => {
    const departmentRows = [
      departmentRow('hq', null, '967223303'),
      departmentRow('team-a', 'hq', '101'),
      departmentRow('team-b', 'hq', '102')
    ];
    mocks.execute
      .mockResolvedValueOnce({ rows: departmentRows })
      .mockResolvedValueOnce({ rows: [[2]] })
      .mockResolvedValueOnce({ rows: [[2, 'profile-2', 'employee@example.com', null, 'Analyst', 'Employee', 'E002']] })
      .mockResolvedValueOnce({
        rows: [
          [2, 'team-a'],
          [2, 'team-b'],
          [2, 'team-a']
        ]
      });

    const members = await getEligibleTrainingMembers('org-1');

    expect(members).toEqual([
      {
        id: 2,
        profileId: 'profile-2',
        email: 'employee@example.com',
        departmentId: null,
        departmentIds: ['team-a', 'team-b'],
        position: 'Analyst',
        fullname: 'Employee',
        employeeNo: 'E002'
      }
    ]);
    const [headquartersSql, headquartersParameters] = mocks.execute.mock.calls[1];
    expect(headquartersSql).toContain('"organization_member_department"');
    expect(headquartersSql).toContain('"organizationmember"."organization_id" =');
    const expectedHeadquartersParameters = ['org-1', 'hq', 'team-a', 'team-b', 'org-1', 'hq', 'team-a', 'team-b'];
    expect([...headquartersParameters].sort()).toEqual(expectedHeadquartersParameters.sort());
    const [memberSql, memberParameters] = mocks.execute.mock.calls[2];
    expect(memberSql).toContain('left join "department"');
    expect(memberSql).toContain('"department"."organization_id" =');
    expect(memberSql).toContain('"department"."status" =');
    expect(memberSql).toContain('"organizationmember"."status" =');
    expect(memberSql).toContain('"organizationmember"."id" in');
    expect(memberSql).toMatch(/employment_status" is null or .*employment_status" <>/);
    expect(memberParameters).toEqual(['org-1', 'ACTIVE', 'org-1', 'ACTIVE', 2, 'TERMINATED']);
    const [membershipSql, membershipParameters] = mocks.execute.mock.calls[3];
    expect(membershipSql).toContain('inner join "department"');
    expect(membershipSql).toContain('"department"."status" =');
    expect(membershipSql).toContain('"department"."organization_id" =');
    expect(membershipSql).toContain('"organization_member_department"."organization_id" =');
    expect(membershipParameters).toEqual(['org-1', 'ACTIVE', 'org-1', 2]);
  });

  it('excludes inactive and explicitly excluded departments from headquarters membership matching', async () => {
    const departmentRows = [
      departmentRow('hq', null, '967223303'),
      departmentRow('active-team', 'hq', '101'),
      departmentRow('inactive-team', 'hq', '102', 'INACTIVE'),
      departmentRow('excluded', 'hq', '1076307045'),
      departmentRow('excluded-child', 'excluded', '104')
    ];
    mocks.execute.mockResolvedValueOnce({ rows: departmentRows }).mockResolvedValueOnce({ rows: [[2]] });

    await expect(getTrainingHeadquartersMemberIds('org-1')).resolves.toEqual([2]);
    const [, parameters] = mocks.execute.mock.calls[1];
    expect(parameters).toContain('active-team');
    expect(parameters).not.toContain('inactive-team');
    expect(parameters).not.toContain('excluded');
    expect(parameters).not.toContain('excluded-child');
  });

  it('fails closed when a configured headquarters has no members', async () => {
    const departmentRows = [departmentRow('hq', null, '967223303')];
    mocks.execute.mockResolvedValueOnce({ rows: departmentRows }).mockResolvedValueOnce({ rows: [] });

    await expect(getEligibleTrainingMembers('org-1')).resolves.toEqual([]);
    expect(mocks.execute).toHaveBeenCalledTimes(2);
  });

  it('fails closed when a DingTalk directory has no configured headquarters root', async () => {
    const departmentRows = [departmentRow('other-team', null, '101')];
    mocks.execute.mockResolvedValueOnce({ rows: departmentRows }).mockResolvedValueOnce({ rows: [] });

    await expect(getEligibleTrainingMembers('org-1')).resolves.toEqual([]);
    expect(mocks.execute.mock.calls[1][0]).toContain('and false');
    expect(mocks.execute).toHaveBeenCalledTimes(2);
  });

  it('preserves generic organizations without DingTalk scope and never falls back to an invalid primary department', async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [[2, null, null, null, null, null, null]] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(getEligibleTrainingMembers('org-1')).resolves.toEqual([
      {
        id: 2,
        profileId: null,
        email: null,
        departmentId: null,
        departmentIds: [],
        position: null,
        fullname: null,
        employeeNo: null
      }
    ]);
    const [memberSql, memberParameters] = mocks.execute.mock.calls[1];
    expect(memberSql).not.toContain('"organizationmember"."id" in');
    expect(memberParameters).toEqual(['org-1', 'ACTIVE', 'org-1', 'ACTIVE', 'TERMINATED']);
  });
});
