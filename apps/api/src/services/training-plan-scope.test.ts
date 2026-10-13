import { describe, expect, it } from 'vitest';
import { resolveTrainingRecipients } from './training-plan-scope';

const departments = [
  { id: 'root', parentId: null, status: 'ACTIVE' as const },
  { id: 'child', parentId: 'root', status: 'ACTIVE' as const },
  { id: 'inactive', parentId: 'root', status: 'INACTIVE' as const }
];
const members = [
  { id: 1, profileId: 'profile-1', departmentIds: ['root'], position: 'Analyst' },
  { id: 2, profileId: 'profile-2', departmentIds: ['child'], position: 'Analyst' },
  { id: 3, profileId: 'profile-3', departmentIds: ['inactive'], position: 'Tutor' },
  { id: 4, profileId: null, email: 'pending@example.com', departmentIds: ['child'], position: 'Analyst' }
];

const departmentTarget = (id: string, departmentId: string) => ({
  id,
  targetType: 'DEPARTMENT' as const,
  departmentId,
  position: null,
  memberId: null,
  includeDescendants: false
});
const positionTarget = (id: string, position: string) => ({
  id,
  targetType: 'POSITION' as const,
  departmentId: null,
  position,
  memberId: null,
  includeDescendants: false
});
const userTarget = (id: string, memberId: number) => ({
  id,
  targetType: 'USER' as const,
  departmentId: null,
  position: null,
  memberId,
  includeDescendants: false
});

describe('training plan target resolution', () => {
  it('includes child departments and de-duplicates overlapping targets', () => {
    const recipients = resolveTrainingRecipients(departments, members, [
      {
        id: 'department-target',
        targetType: 'DEPARTMENT',
        departmentId: 'root',
        position: null,
        memberId: null,
        includeDescendants: true
      },
      {
        id: 'position-target',
        targetType: 'POSITION',
        departmentId: null,
        position: 'analyst',
        memberId: null,
        includeDescendants: false
      },
      {
        id: 'user-target',
        targetType: 'USER',
        departmentId: null,
        position: null,
        memberId: 2,
        includeDescendants: false
      }
    ]);

    expect(recipients).toEqual([
      { memberId: 1, profileId: 'profile-1', email: null, matchedTargetIds: ['department-target', 'position-target'] },
      {
        memberId: 2,
        profileId: 'profile-2',
        email: null,
        matchedTargetIds: ['department-target', 'position-target', 'user-target']
      },
      {
        memberId: 4,
        profileId: null,
        email: 'pending@example.com',
        matchedTargetIds: ['department-target', 'position-target']
      }
    ]);
  });

  it('limits a department target to its own members when descendants are off', () => {
    const recipients = resolveTrainingRecipients(departments, members, [
      {
        id: 'root-only',
        targetType: 'DEPARTMENT',
        departmentId: 'root',
        position: null,
        memberId: null,
        includeDescendants: false
      }
    ]);

    expect(recipients.map((recipient) => recipient.memberId)).toEqual([1]);
  });

  it('terminates when legacy department data contains a cycle', () => {
    const cyclicDepartments = [
      { id: 'root', parentId: 'child', status: 'ACTIVE' as const },
      { id: 'child', parentId: 'root', status: 'ACTIVE' as const }
    ];
    const recipients = resolveTrainingRecipients(cyclicDepartments, members, [
      {
        id: 'cyclic-target',
        targetType: 'DEPARTMENT',
        departmentId: 'root',
        position: null,
        memberId: null,
        includeDescendants: true
      }
    ]);

    expect(recipients.map((recipient) => recipient.memberId)).toEqual([1, 2, 4]);
  });

  it('matches secondary departments with a null primary department and records each matched target once', () => {
    const member = {
      id: 5,
      profileId: 'profile-5',
      departmentId: null,
      departmentIds: ['root', 'child', 'child'],
      position: null
    };
    const recipients = resolveTrainingRecipients(
      departments,
      [member, member],
      [departmentTarget('root-target', 'root'), departmentTarget('child-target', 'child')]
    );

    expect(recipients).toEqual([
      { memberId: 5, profileId: 'profile-5', email: null, matchedTargetIds: ['root-target', 'child-target'] }
    ]);
  });

  it('uses OR within each target type and AND between departments and positions', () => {
    const candidates = [
      ...members,
      { id: 5, profileId: null, departmentIds: ['child'], position: 'Tutor' },
      { id: 6, profileId: null, departmentIds: [], position: 'Analyst' },
      { id: 7, profileId: null, departmentIds: ['root'], position: 'Engineer' }
    ];
    const recipients = resolveTrainingRecipients(departments, candidates, [
      departmentTarget('root-target', 'root'),
      departmentTarget('child-target', 'child'),
      positionTarget('analyst-target', ' analyst '),
      positionTarget('tutor-target', 'Tutor')
    ]);

    expect(recipients.map((recipient) => recipient.memberId)).toEqual([1, 2, 4, 5]);
    expect(recipients.find((recipient) => recipient.memberId === 5)?.matchedTargetIds).toEqual([
      'child-target',
      'tutor-target'
    ]);
  });

  it('adds explicit users independently of the department and position intersection without inventing matches', () => {
    const recipients = resolveTrainingRecipients(departments, members, [
      departmentTarget('root-target', 'root'),
      positionTarget('tutor-target', 'Tutor'),
      userTarget('extra-user', 2),
      userTarget('unavailable-user', 99)
    ]);

    expect(recipients).toEqual([
      { memberId: 2, profileId: 'profile-2', email: null, matchedTargetIds: ['extra-user'] }
    ]);
  });

  it('never matches inactive department targets or uses an inactive primary department as a fallback', () => {
    const candidates = [
      { id: 5, profileId: null, departmentId: 'inactive', departmentIds: [], position: null },
      { id: 6, profileId: null, departmentId: 'inactive', departmentIds: ['child'], position: null }
    ];
    const inactive = resolveTrainingRecipients(departments, candidates, [
      departmentTarget('inactive-target', 'inactive')
    ]);
    const active = resolveTrainingRecipients(departments, candidates, [departmentTarget('child-target', 'child')]);

    expect(inactive).toEqual([]);
    expect(active.map((recipient) => recipient.memberId)).toEqual([6]);
  });

  it('supports position-only and user-only targets and does not select anyone with no targets', () => {
    expect(
      resolveTrainingRecipients(departments, members, [positionTarget('position-target', 'tutor')]).map(
        (recipient) => recipient.memberId
      )
    ).toEqual([3]);
    expect(
      resolveTrainingRecipients(departments, members, [userTarget('user-target', 2)]).map(
        (recipient) => recipient.memberId
      )
    ).toEqual([2]);
    expect(resolveTrainingRecipients(departments, members, [])).toEqual([]);
  });
});
