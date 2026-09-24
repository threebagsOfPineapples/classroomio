import { describe, expect, it } from 'vitest';
import { resolveTrainingRecipients } from './training-plan-scope';

const departments = [
  { id: 'root', parentId: null, status: 'ACTIVE' as const },
  { id: 'child', parentId: 'root', status: 'ACTIVE' as const },
  { id: 'inactive', parentId: 'root', status: 'INACTIVE' as const }
];
const members = [
  { id: 1, profileId: 'profile-1', departmentId: 'root', position: 'Analyst' },
  { id: 2, profileId: 'profile-2', departmentId: 'child', position: 'Analyst' },
  { id: 3, profileId: 'profile-3', departmentId: 'inactive', position: 'Tutor' },
  { id: 4, profileId: null, email: 'pending@example.com', departmentId: 'child', position: 'Analyst' }
];

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
});
