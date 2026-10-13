import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  members: vi.fn(),
  roles: vi.fn(),
  scopes: vi.fn(),
  departments: vi.fn(),
  visible: vi.fn(),
  headquarters: vi.fn(),
  taskList: vi.fn(),
  relationList: vi.fn(),
  memberList: vi.fn(),
  task: vi.fn(),
  relation: vi.fn(),
  history: vi.fn(),
  currentRelation: vi.fn(),
  createRelation: vi.fn(),
  endRelation: vi.fn(),
  handover: vi.fn(),
  resources: vi.fn(),
  createTask: vi.fn(),
  submission: vi.fn(),
  review: vi.fn(),
  supervisor: vi.fn(),
  certification: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
  source: vi.fn(),
  examConfiguration: vi.fn(),
  progress: vi.fn(),
  membership: vi.fn(),
  counts: vi.fn(),
  examSubmissions: vi.fn(),
  points: vi.fn(),
  transaction: { kind: 'test-transaction' }
}));

vi.mock('./training-access', () => ({ loadActiveTrainingActor: mocks.actor }));
vi.mock('./course/member-progress', () => ({ getCourseMemberProgressSummaries: mocks.progress }));
vi.mock('@cio/db/queries/course/member-progress', () => ({
  getBatchStudentCourseMembership: mocks.membership,
  getCourseTrackableContentCounts: mocks.counts
}));
vi.mock('@cio/db/queries/assessment', () => ({
  getAssessmentExercisePoints: mocks.points,
  listCompletedAssessmentSubmissions: mocks.examSubmissions
}));
vi.mock('@cio/db/queries/enterprise/access', () => ({
  addTrainingOperationAudit: mocks.audit,
  getEnterpriseMemberScopes: mocks.scopes,
  getTrainingMemberDepartmentIds: mocks.departments,
  getTrainingHeadquartersMemberIds: mocks.headquarters,
  listEnterpriseScopedMemberIds: mocks.visible
}));
vi.mock('@cio/db/queries/mentorship', () => ({
  withMentorshipTransaction: async (callback: (transaction: object) => Promise<unknown>) => callback(mocks.transaction),
  getMentorshipMember: mocks.members,
  getMentorshipMemberRoles: mocks.roles,
  getMentorshipTask: mocks.task,
  getMentorshipRelation: mocks.relation,
  getMentorshipHistory: mocks.history,
  getCurrentMentorshipRelation: mocks.currentRelation,
  createMentorshipRelation: mocks.createRelation,
  endMentorshipRelation: mocks.endRelation,
  handoverMentorshipRelation: mocks.handover,
  validateMentorshipResources: mocks.resources,
  createMentorshipTask: mocks.createTask,
  createMentorshipSubmission: mocks.submission,
  createMentorshipReview: mocks.review,
  createMentorshipSupervisorReview: mocks.supervisor,
  createMentorshipCertification: mocks.certification,
  updateMentorshipTaskState: mocks.update,
  getMentorshipEvidenceSource: mocks.source,
  getMentorshipExamConfiguration: mocks.examConfiguration,
  listMentorshipHandovers: async () => [],
  listMentorshipMembers: mocks.memberList,
  listMentorshipRelations: mocks.relationList,
  listMentorshipResources: async () => ({ plans: [], courses: [], exercises: [] }),
  listMentorshipTasks: mocks.taskList
}));

import {
  assignMentorshipTasks,
  bindMentorships,
  certifyMentorshipTask,
  changeMentorshipMentor,
  getMentorshipDetail,
  getMentorshipOptions,
  getMentorshipRelations,
  getMentorships,
  reviewMentorshipTask,
  submitMentorshipTask,
  supervisorReviewMentorshipTask
} from './mentorship';
import { ZMentorshipTask } from '@cio/utils/validation/mentorship';
import { mentorshipExamBaseline } from './mentorship-exam';

const examConfiguration = {
  exercise: { id: 'exam-1', passThreshold: 60, updatedAt: '2024-12-01T00:00:00Z' },
  questions: [{ id: 10, questionTypeId: 1, points: 100, settings: {}, updatedAt: '2024-12-01T00:00:00Z' }],
  options: [
    {
      id: 20,
      questionId: 10,
      label: 'Correct',
      value: 'choice-value',
      isCorrect: true,
      updatedAt: '2024-12-01T00:00:00Z'
    }
  ]
};

const relation = {
  id: 'relation-1',
  organizationId: 'org-1',
  learnerMemberId: 1,
  mentorMemberId: 2,
  planId: null,
  status: 'ACTIVE',
  startsAt: '2000-01-01T00:00:00Z',
  endsAt: '2099-01-01T00:00:00Z'
};
const task = {
  id: 'task-1',
  organizationId: 'org-1',
  relationId: relation.id,
  state: 'MENTOR_PENDING',
  revision: 1,
  submissionType: 'TEXT',
  maxScore: 100,
  passScore: 60,
  requiresSupervisorReview: false,
  reviewerMemberId: null,
  certifier: 'MENTOR',
  courseId: null,
  exerciseId: null,
  createdAt: '2025-01-01T00:00:00Z',
  examMaxScore: null,
  examPassThreshold: null,
  examScoringFingerprint: null
};
const history = {
  submissions: [{ id: 'submission-1', round: 1 }],
  reviews: [{ id: 'review-1', submissionId: 'submission-1', decision: 'PASS', score: 80 }],
  supervisorReviews: [],
  certifications: []
};
const reviewValues = {
  expectedRevision: 1,
  submissionId: 'submission-1',
  decision: 'PASS' as const,
  score: 80,
  content: 'Verified practical operation',
  observedAt: null
};
const supervisorValues = {
  expectedRevision: 1,
  submissionId: 'submission-1',
  reviewId: 'review-1',
  decision: 'PASS' as const,
  content: 'Verified standard'
};
const certificationValues = {
  expectedRevision: 1,
  submissionId: 'submission-1',
  reviewId: 'review-1',
  content: 'Independent certification'
};

function setActor(memberId: number, roles: string[] = []) {
  mocks.actor.mockResolvedValue({
    organizationId: 'org-1',
    profileId: 'profile-1',
    memberId,
    roles,
    canManageTraining: roles.includes('TRAINING_ADMIN'),
    canGrantPermissions: false,
    departmentIds: [],
    memberIds: []
  });
  mocks.roles.mockImplementation(async (_organizationId: string, targetMemberId: number) =>
    targetMemberId === memberId
      ? roles.map((role) => ({ role }))
      : targetMemberId === 2 || targetMemberId === 4
        ? [{ role: 'MENTOR' }]
        : []
  );
  mocks.members.mockImplementation(async (_organizationId: string, targetMemberId: number) => ({
    id: targetMemberId,
    profileId: targetMemberId === memberId ? 'profile-1' : `profile-${targetMemberId}`,
    roleId: 3,
    status: 'ACTIVE',
    employmentStatus: 'EMPLOYED',
    departmentId: 'primary-department'
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  setActor(2, ['MENTOR']);
  mocks.task.mockResolvedValue({ ...task });
  mocks.relation.mockResolvedValue({ ...relation });
  mocks.history.mockResolvedValue(structuredClone(history));
  mocks.scopes.mockResolvedValue({ departmentIds: ['secondary-department'], memberIds: [] });
  mocks.departments.mockResolvedValue(['primary-department', 'secondary-department']);
  mocks.visible.mockResolvedValue([]);
  mocks.headquarters.mockResolvedValue(null);
  mocks.taskList.mockResolvedValue([]);
  mocks.relationList.mockResolvedValue([]);
  mocks.memberList.mockResolvedValue([]);
  mocks.resources.mockResolvedValue(true);
  mocks.currentRelation.mockResolvedValue(null);
  mocks.createRelation.mockResolvedValue({ ...relation, id: 'new-relation' });
  mocks.createTask.mockResolvedValue({ ...task });
  mocks.membership.mockResolvedValue(new Map([['profile-1', { groupMemberId: 'group-member-1' }]]));
  mocks.counts.mockResolvedValue({ lessonsCount: 2, exercisesCount: 1 });
  mocks.progress.mockResolvedValue(new Map([['profile-1', { progressPercent: 100 }]]));
  mocks.source.mockResolvedValue({ course: { groupId: 'course-group' }, exercise: { passThreshold: 60 } });
  mocks.examConfiguration.mockResolvedValue(structuredClone(examConfiguration));
  mocks.examSubmissions.mockResolvedValue([{ id: 'official-answer-1', total: 80, createdAt: '2025-02-01T00:00:00Z' }]);
  mocks.points.mockResolvedValue(100);
});

function examTask() {
  const baseline = mentorshipExamBaseline(examConfiguration);
  return { ...task, state: 'READY_TO_CERTIFY', courseId: 'course-1', exerciseId: 'exam-1', ...baseline };
}

describe('headquarters mentorship boundaries', () => {
  it('limits administrator task lists to headquarters without requiring a department on the administrator', async () => {
    setActor(3, ['TRAINING_ADMIN']);
    mocks.headquarters.mockResolvedValue([1, 2]);
    await getMentorships('org-1', 'profile-1', {});
    expect(mocks.taskList).toHaveBeenCalledWith('org-1', [1, 2], 3, {}, mocks.transaction);
    expect(mocks.headquarters).toHaveBeenCalledWith('org-1', mocks.transaction);
  });

  it('intersects supervisor person and department scopes with headquarters', async () => {
    setActor(3, ['DEPARTMENT_MANAGER']);
    mocks.headquarters.mockResolvedValue([1, 2]);
    mocks.visible.mockResolvedValue([{ id: 1 }, { id: 9 }]);
    await getMentorshipRelations('org-1', 'profile-1');
    expect(mocks.relationList).toHaveBeenCalledWith('org-1', [1], 3, mocks.transaction);
  });

  it('retains manual organizations without a DingTalk directory', async () => {
    setActor(3, ['TRAINING_ADMIN']);
    mocks.headquarters.mockResolvedValue(null);
    await getMentorships('org-1', 'profile-1', {});
    expect(mocks.taskList).toHaveBeenCalledWith('org-1', null, 3, {}, mocks.transaction);
  });

  it('does not treat an empty headquarters roster as unrestricted', async () => {
    setActor(3, ['TRAINING_ADMIN']);
    mocks.headquarters.mockResolvedValue([]);
    await getMentorships('org-1', 'profile-1', {});
    expect(mocks.taskList).toHaveBeenCalledWith('org-1', [], 3, {}, mocks.transaction);
  });

  it.each([2, 3])('outside learner details are hidden from mentors and administrators: actor %s', async (memberId) => {
    setActor(memberId, memberId === 2 ? ['MENTOR'] : ['TRAINING_ADMIN']);
    mocks.headquarters.mockResolvedValue([2]);
    await expect(getMentorshipDetail('org-1', 'profile-1', 'task-1')).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.history).not.toHaveBeenCalled();
  });

  it('a departmentless administrator can bind headquarters members', async () => {
    setActor(3, ['TRAINING_ADMIN']);
    mocks.headquarters.mockResolvedValue([1, 2]);
    await bindMentorships('org-1', 'profile-1', {
      learnerMemberIds: [1],
      mentorMemberId: 2,
      planId: null,
      startsAt: relation.startsAt,
      endsAt: relation.endsAt
    });
    expect(mocks.createRelation).toHaveBeenCalledOnce();
  });

  it.each([{ headquartersIds: [1] }, { headquartersIds: [2] }])(
    'rejects non-headquarters mentor or learner eligibility: headquarters $headquartersIds',
    async ({ headquartersIds }) => {
      setActor(3, ['TRAINING_ADMIN']);
      mocks.headquarters.mockResolvedValue(headquartersIds);
      await expect(
        bindMentorships('org-1', 'profile-1', {
          learnerMemberIds: [1],
          mentorMemberId: 2,
          planId: null,
          startsAt: relation.startsAt,
          endsAt: relation.endsAt
        })
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(mocks.createRelation).not.toHaveBeenCalled();
    }
  );

  it('administrator candidate options use the current transaction', async () => {
    setActor(3, ['TRAINING_ADMIN']);
    mocks.headquarters.mockResolvedValue([1, 2]);
    const options = await getMentorshipOptions('org-1', 'profile-1');
    expect(options.canManage).toBe(true);
    expect(mocks.memberList).toHaveBeenCalledWith('org-1', mocks.transaction);
  });

  it.each(['detail', 'review', 'certify'])('mentor role revocation immediately denies %s access', async (action) => {
    setActor(2, []);
    const request =
      action === 'detail'
        ? getMentorshipDetail('org-1', 'profile-1', 'task-1')
        : action === 'review'
          ? reviewMentorshipTask('org-1', 'profile-1', 'task-1', reviewValues)
          : certifyMentorshipTask('org-1', 'profile-1', 'task-1', certificationValues);
    await expect(request).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.history).not.toHaveBeenCalled();
    expect(mocks.review).not.toHaveBeenCalled();
    expect(mocks.certification).not.toHaveBeenCalled();
  });
});

describe('fixed examination basis for independent mentorship certification', () => {
  beforeEach(() => {
    mocks.members.mockImplementation(async (_organizationId: string, memberId: number) => ({
      id: memberId,
      profileId: 'profile-1',
      roleId: 3,
      status: 'ACTIVE',
      employmentStatus: 'EMPLOYED'
    }));
    mocks.task.mockResolvedValue(examTask());
  });

  it('rejects exam answers submitted before the task was assigned', async () => {
    mocks.examSubmissions.mockResolvedValue([{ id: 'historical-pass', total: 100, createdAt: '2024-12-31T00:00:00Z' }]);
    await expect(certifyMentorshipTask('org-1', 'profile-1', 'task-1', certificationValues)).rejects.toMatchObject({
      statusCode: 400
    });
    expect(mocks.certification).not.toHaveBeenCalled();
  });

  it('uses a matching official result after task assignment', async () => {
    await certifyMentorshipTask('org-1', 'profile-1', 'task-1', certificationValues);
    expect(mocks.certification).toHaveBeenCalledOnce();
    expect(mocks.examConfiguration).toHaveBeenCalledWith('org-1', 'course-1', 'exam-1', mocks.transaction);
  });

  it.each(['maximum', 'threshold', 'correct-option', 'changed-back'])(
    'cannot turn a historical failure into a pass by changing %s',
    async (change) => {
      mocks.examSubmissions.mockResolvedValue([{ id: 'failed-result', total: 50, createdAt: '2025-02-01T00:00:00Z' }]);
      const changed = structuredClone(examConfiguration);
      if (change === 'maximum') changed.questions[0].points = 50;
      if (change === 'threshold') changed.exercise.passThreshold = 40;
      if (change === 'correct-option') changed.options[0].isCorrect = false;
      if (change === 'changed-back') changed.questions[0].updatedAt = '2025-03-01T00:00:00Z';
      mocks.examConfiguration.mockResolvedValue(changed);
      await expect(certifyMentorshipTask('org-1', 'profile-1', 'task-1', certificationValues)).rejects.toMatchObject({
        statusCode: 400
      });
      expect(mocks.certification).not.toHaveBeenCalled();
    }
  );

  it('refuses legacy exam tasks without a fixed baseline', async () => {
    mocks.task.mockResolvedValue({
      ...examTask(),
      examScoringFingerprint: null,
      examMaxScore: null,
      examPassThreshold: null
    });
    await expect(certifyMentorshipTask('org-1', 'profile-1', 'task-1', certificationValues)).rejects.toMatchObject({
      statusCode: 400
    });
  });

  it('rejects assigning an exam task when its passing threshold is missing', async () => {
    setActor(3, ['TRAINING_ADMIN']);
    const configuration = structuredClone(examConfiguration);
    mocks.examConfiguration.mockResolvedValue({
      ...configuration,
      exercise: { ...configuration.exercise, passThreshold: null }
    });
    await expect(
      assignMentorshipTasks('org-1', 'profile-1', {
        relationIds: ['relation-1'],
        title: 'Task',
        objective: 'Observe',
        scoringCriteria: 'Safe procedure',
        dueAt: '2090-01-01T00:00:00Z',
        courseId: 'course-1',
        exerciseId: 'exam-1',
        submissionType: 'TEXT',
        maxScore: 100,
        passScore: 60,
        requiresSupervisorReview: false,
        reviewerMemberId: null,
        certifier: 'MENTOR'
      })
    ).rejects.toMatchObject({ statusCode: 400, field: 'examPassThreshold' });
    expect(mocks.createTask).not.toHaveBeenCalled();
  });

  it('freezes exam maximum, passing threshold and configuration on task assignment', async () => {
    setActor(3, ['TRAINING_ADMIN']);
    await assignMentorshipTasks('org-1', 'profile-1', {
      relationIds: ['relation-1'],
      title: 'Task',
      objective: 'Observe',
      scoringCriteria: 'Safe procedure',
      dueAt: '2090-01-01T00:00:00Z',
      courseId: 'course-1',
      exerciseId: 'exam-1',
      submissionType: 'TEXT',
      maxScore: 100,
      passScore: 60,
      requiresSupervisorReview: false,
      reviewerMemberId: null,
      certifier: 'MENTOR'
    });
    expect(mocks.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        examMaxScore: 100,
        examPassThreshold: 60,
        examScoringFingerprint: mentorshipExamBaseline(examConfiguration).examScoringFingerprint
      }),
      mocks.transaction
    );
  });
});

describe('mentorship authorization and submission versions', () => {
  it('loads the active actor before every mutation', async () => {
    mocks.actor.mockRejectedValue(new Error('Inactive actor'));
    await expect(reviewMentorshipTask('org-1', 'profile-1', 'task-1', reviewValues)).rejects.toThrow('Inactive actor');
    expect(mocks.review).not.toHaveBeenCalled();
  });

  it('rejects cross-organization task ids', async () => {
    mocks.actor.mockResolvedValue({
      organizationId: 'org-2',
      profileId: 'profile-1',
      memberId: 2,
      roles: ['MENTOR'],
      canManageTraining: false,
      canGrantPermissions: false
    });
    mocks.task.mockResolvedValue(null);
    await expect(reviewMentorshipTask('org-2', 'profile-1', 'task-1', reviewValues)).rejects.toMatchObject({
      statusCode: 404
    });
    expect(mocks.review).not.toHaveBeenCalled();
    expect(mocks.task).toHaveBeenCalledWith('org-2', 'task-1', mocks.transaction);
  });

  it('rejects a former mentor immediately after handover', async () => {
    mocks.relation.mockResolvedValue({ ...relation, mentorMemberId: 4 });
    await expect(reviewMentorshipTask('org-1', 'profile-1', 'task-1', reviewValues)).rejects.toMatchObject({
      statusCode: 404
    });
    expect(mocks.review).not.toHaveBeenCalled();
  });

  it('course tutor role does not confer mentoring permission', async () => {
    setActor(5, ['MENTOR']);
    await expect(reviewMentorshipTask('org-1', 'profile-1', 'task-1', reviewValues)).rejects.toMatchObject({
      statusCode: 404
    });
  });

  it('locks the relation and task before saving a mentor decision', async () => {
    await reviewMentorshipTask('org-1', 'profile-1', 'task-1', reviewValues);
    expect(mocks.relation).toHaveBeenCalledWith('org-1', relation.id, mocks.transaction, true);
    expect(mocks.task).toHaveBeenCalledWith('org-1', 'task-1', mocks.transaction, true);
    expect(mocks.review).toHaveBeenCalledWith(
      expect.objectContaining({ mentorMemberId: 2, score: 80 }),
      mocks.transaction
    );
    expect(mocks.update).toHaveBeenCalledWith('task-1', 'READY_TO_CERTIFY', mocks.transaction);
    expect(mocks.certification).not.toHaveBeenCalled();
  });

  it.each([{ expectedRevision: 0 }, { submissionId: 'old-submission' }])(
    'rejects stale pages without writing',
    async (changes) => {
      await expect(
        reviewMentorshipTask('org-1', 'profile-1', 'task-1', { ...reviewValues, ...changes })
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(mocks.review).not.toHaveBeenCalled();
    }
  );

  it('requires a passing score for a passing review', async () => {
    await expect(
      reviewMentorshipTask('org-1', 'profile-1', 'task-1', { ...reviewValues, score: 59 })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.review).not.toHaveBeenCalled();
  });

  it('preserves a return as its own review record', async () => {
    await reviewMentorshipTask('org-1', 'profile-1', 'task-1', {
      ...reviewValues,
      decision: 'RETURN',
      content: 'Repeat safety checks',
      score: 40
    });
    expect(mocks.review).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'RETURN', content: 'Repeat safety checks' }),
      mocks.transaction
    );
    expect(mocks.update).toHaveBeenCalledWith('task-1', 'RETURNED', mocks.transaction);
  });

  it('learner re-submission appends a new round', async () => {
    setActor(1);
    mocks.task.mockResolvedValue({ ...task, state: 'RETURNED' });
    await submitMentorshipTask('org-1', 'profile-1', 'task-1', {
      expectedRevision: 1,
      content: 'Corrected evidence',
      confirmed: true
    });
    expect(mocks.submission).toHaveBeenCalledWith(
      expect.objectContaining({ round: 2, content: 'Corrected evidence', submittedByMemberId: 1 }),
      mocks.transaction
    );
    expect(mocks.update).toHaveBeenCalledWith('task-1', 'MENTOR_PENDING', mocks.transaction);
  });

  it('self confirmation is never certification', async () => {
    setActor(1);
    mocks.task.mockResolvedValue({ ...task, state: 'LEARNER_PENDING', submissionType: 'CONFIRMATION' });
    await submitMentorshipTask('org-1', 'profile-1', 'task-1', { expectedRevision: 1, content: '', confirmed: true });
    expect(mocks.certification).not.toHaveBeenCalled();
  });

  it('blocks empty text evidence', async () => {
    setActor(1);
    mocks.task.mockResolvedValue({ ...task, state: 'LEARNER_PENDING' });
    await expect(
      submitMentorshipTask('org-1', 'profile-1', 'task-1', { expectedRevision: 1, content: '', confirmed: true })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects an expired relationship before any new review', async () => {
    mocks.relation.mockResolvedValue({ ...relation, endsAt: '2001-01-01T00:00:00Z' });
    await expect(reviewMentorshipTask('org-1', 'profile-1', 'task-1', reviewValues)).rejects.toMatchObject({
      statusCode: 404
    });
    expect(mocks.review).not.toHaveBeenCalled();
  });

  it('rechecks actor termination inside the transaction', async () => {
    mocks.members.mockResolvedValue({
      id: 2,
      profileId: 'profile-1',
      roleId: 3,
      status: 'ACTIVE',
      employmentStatus: 'TERMINATED'
    });
    await expect(reviewMentorshipTask('org-1', 'profile-1', 'task-1', reviewValues)).rejects.toMatchObject({
      statusCode: 400
    });
    expect(mocks.review).not.toHaveBeenCalled();
  });

  it('does not let a learner submit twice while a mentor decision is pending', async () => {
    setActor(1);
    await expect(
      submitMentorshipTask('org-1', 'profile-1', 'task-1', {
        expectedRevision: 1,
        content: 'Repeated submission',
        confirmed: true
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.submission).not.toHaveBeenCalled();
  });
});

describe('configured parallel supervisor review', () => {
  beforeEach(() => {
    setActor(3, ['DEPARTMENT_MANAGER']);
    mocks.visible.mockResolvedValue([{ id: 1 }]);
    mocks.task.mockResolvedValue({
      ...task,
      state: 'SUPERVISOR_PENDING',
      requiresSupervisorReview: true,
      reviewerMemberId: 3
    });
  });

  it('accepts a specified supervisor covering a secondary department', async () => {
    await supervisorReviewMentorshipTask('org-1', 'profile-1', 'task-1', supervisorValues);
    expect(mocks.departments).toHaveBeenCalledWith('org-1', 1, mocks.transaction);
    expect(mocks.supervisor).toHaveBeenCalledWith(expect.objectContaining({ reviewerMemberId: 3 }), mocks.transaction);
  });

  it('rejects an unspecified parallel supervisor', async () => {
    mocks.task.mockResolvedValue({
      ...task,
      state: 'SUPERVISOR_PENDING',
      requiresSupervisorReview: true,
      reviewerMemberId: 6
    });
    await expect(
      supervisorReviewMentorshipTask('org-1', 'profile-1', 'task-1', supervisorValues)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rechecks revoked coverage on every write', async () => {
    mocks.scopes.mockResolvedValue({ departmentIds: [], memberIds: [] });
    mocks.visible.mockResolvedValue([{ id: 1 }]);
    await expect(
      supervisorReviewMentorshipTask('org-1', 'profile-1', 'task-1', supervisorValues)
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.supervisor).not.toHaveBeenCalled();
  });

  it('does not allow review when the task disabled supervisor review', async () => {
    mocks.task.mockResolvedValue({
      ...task,
      state: 'READY_TO_CERTIFY',
      reviewerMemberId: 3,
      requiresSupervisorReview: false
    });
    await expect(
      supervisorReviewMentorshipTask('org-1', 'profile-1', 'task-1', supervisorValues)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects a stale mentor review id', async () => {
    await expect(
      supervisorReviewMentorshipTask('org-1', 'profile-1', 'task-1', { ...supervisorValues, reviewId: 'old-review' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('independent certification', () => {
  beforeEach(() => mocks.task.mockResolvedValue({ ...task, state: 'READY_TO_CERTIFY' }));

  it('certifies only after separate configured conditions', async () => {
    await certifyMentorshipTask('org-1', 'profile-1', 'task-1', certificationValues);
    expect(mocks.certification).toHaveBeenCalledWith(
      expect.objectContaining({ certifierMemberId: 2, reviewId: 'review-1', submissionId: 'submission-1' }),
      mocks.transaction
    );
    expect(mocks.update).toHaveBeenCalledWith('task-1', 'CERTIFIED', mocks.transaction);
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'CERTIFY' }), mocks.transaction);
  });

  it('does not certify while mentor review is pending', async () => {
    mocks.task.mockResolvedValue({ ...task });
    await expect(certifyMentorshipTask('org-1', 'profile-1', 'task-1', certificationValues)).rejects.toMatchObject({
      statusCode: 400
    });
  });

  it('requires supervisor approval when enabled', async () => {
    mocks.task.mockResolvedValue({
      ...task,
      state: 'READY_TO_CERTIFY',
      requiresSupervisorReview: true,
      reviewerMemberId: 3
    });
    await expect(certifyMentorshipTask('org-1', 'profile-1', 'task-1', certificationValues)).rejects.toMatchObject({
      statusCode: 400
    });
  });

  it('mentor cannot replace the configured reviewer as certifier', async () => {
    mocks.task.mockResolvedValue({
      ...task,
      state: 'READY_TO_CERTIFY',
      requiresSupervisorReview: true,
      reviewerMemberId: 3,
      certifier: 'REVIEWER'
    });
    await expect(certifyMentorshipTask('org-1', 'profile-1', 'task-1', certificationValues)).rejects.toMatchObject({
      statusCode: 403
    });
  });

  it('requires current course progress and original official exam results', async () => {
    mocks.members.mockImplementation(async (_organizationId: string, memberId: number) => ({
      id: memberId,
      profileId: 'profile-1',
      roleId: 3,
      status: 'ACTIVE',
      employmentStatus: 'EMPLOYED'
    }));
    mocks.task.mockResolvedValue(examTask());
    await certifyMentorshipTask('org-1', 'profile-1', 'task-1', certificationValues);
    expect(mocks.examSubmissions).toHaveBeenCalledWith('profile-1', 'exam-1', ['course-group']);
    expect(mocks.progress).toHaveBeenCalled();
  });

  it.each([null, 59])('rejects absent or failing original exam scores: %s', async (score) => {
    mocks.members.mockImplementation(async (_organizationId: string, memberId: number) => ({
      id: memberId,
      profileId: 'profile-1',
      roleId: 3,
      status: 'ACTIVE',
      employmentStatus: 'EMPLOYED'
    }));
    mocks.task.mockResolvedValue(examTask());
    mocks.examSubmissions.mockResolvedValue(
      score === null ? [] : [{ id: 'official-answer', total: score, createdAt: '2025-02-01T00:00:00Z' }]
    );
    await expect(certifyMentorshipTask('org-1', 'profile-1', 'task-1', certificationValues)).rejects.toMatchObject({
      statusCode: 400
    });
    expect(mocks.certification).not.toHaveBeenCalled();
  });

  it('does not guess an unspecified exam passing threshold', async () => {
    mocks.members.mockImplementation(async (_organizationId: string, memberId: number) => ({
      id: memberId,
      profileId: 'profile-1',
      roleId: 3,
      status: 'ACTIVE',
      employmentStatus: 'EMPLOYED'
    }));
    mocks.task.mockResolvedValue({ ...examTask(), examPassThreshold: null });
    mocks.source.mockResolvedValue({ course: { groupId: 'course-group' }, exercise: { passThreshold: null } });
    await expect(certifyMentorshipTask('org-1', 'profile-1', 'task-1', certificationValues)).rejects.toMatchObject({
      statusCode: 400
    });
  });

  it('rejects an old submission after a learner submits a new round', async () => {
    mocks.history.mockResolvedValue({
      ...history,
      submissions: [{ id: 'new-submission', round: 2 }, ...history.submissions]
    });
    await expect(certifyMentorshipTask('org-1', 'profile-1', 'task-1', certificationValues)).rejects.toMatchObject({
      statusCode: 409
    });
    expect(mocks.certification).not.toHaveBeenCalled();
  });

  it('rejects a failed practical score even when the task state says ready', async () => {
    mocks.history.mockResolvedValue({ ...history, reviews: [{ ...history.reviews[0], score: 59 }] });
    await expect(certifyMentorshipTask('org-1', 'profile-1', 'task-1', certificationValues)).rejects.toMatchObject({
      statusCode: 400
    });
    expect(mocks.certification).not.toHaveBeenCalled();
  });
});

describe('administrator assignment and mentor handover', () => {
  it('HR capability alone cannot create mentorships', async () => {
    setActor(3, ['HR_MANAGER']);
    await expect(
      bindMentorships('org-1', 'profile-1', {
        learnerMemberIds: [1],
        mentorMemberId: 2,
        planId: null,
        startsAt: relation.startsAt,
        endsAt: relation.endsAt
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('creates batch relationships in one transaction with audited member ids', async () => {
    setActor(3, ['TRAINING_ADMIN']);
    await bindMentorships('org-1', 'profile-1', {
      learnerMemberIds: [1, 5],
      mentorMemberId: 2,
      planId: null,
      startsAt: relation.startsAt,
      endsAt: relation.endsAt
    });
    expect(mocks.createRelation).toHaveBeenCalledTimes(2);
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'BIND', targetMemberId: 1 }),
      mocks.transaction
    );
  });

  it('rechecks revocation of training administrator role in the transaction', async () => {
    setActor(3, ['TRAINING_ADMIN']);
    mocks.roles.mockResolvedValue([]);
    await expect(
      bindMentorships('org-1', 'profile-1', {
        learnerMemberIds: [1],
        mentorMemberId: 2,
        planId: null,
        startsAt: relation.startsAt,
        endsAt: relation.endsAt
      })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.createRelation).not.toHaveBeenCalled();
  });

  it('preserves a legacy organization ADMIN without requiring an enterprise SUPER_ADMIN row', async () => {
    setActor(3);
    mocks.actor.mockResolvedValue({
      organizationId: 'org-1',
      profileId: 'profile-1',
      memberId: 3,
      roles: [],
      canManageTraining: true,
      canGrantPermissions: true
    });
    mocks.members.mockImplementation(async (_organizationId: string, memberId: number) => ({
      id: memberId,
      profileId: memberId === 3 ? 'profile-1' : `profile-${memberId}`,
      roleId: memberId === 3 ? 1 : 3,
      status: 'ACTIVE',
      employmentStatus: 'EMPLOYED'
    }));
    await bindMentorships('org-1', 'profile-1', {
      learnerMemberIds: [1],
      mentorMemberId: 2,
      planId: null,
      startsAt: relation.startsAt,
      endsAt: relation.endsAt
    });
    expect(mocks.createRelation).toHaveBeenCalledOnce();
  });

  it('handover retains old relationship and transfers task ids', async () => {
    setActor(3, ['TRAINING_ADMIN']);
    await changeMentorshipMentor('org-1', 'profile-1', relation.id, { mentorMemberId: 4, reason: 'Shift transfer' });
    expect(mocks.endRelation).toHaveBeenCalledWith(relation.id, mocks.transaction);
    expect(mocks.handover).toHaveBeenCalledWith(
      expect.objectContaining({ id: relation.id }),
      expect.objectContaining({ id: 'new-relation' }),
      'Shift transfer',
      'profile-1',
      mocks.transaction
    );
  });

  it('rejects course references from another organization', async () => {
    setActor(3, ['TRAINING_ADMIN']);
    mocks.resources.mockResolvedValue(false);
    await expect(
      assignMentorshipTasks('org-1', 'profile-1', {
        relationIds: ['relation-1'],
        title: 'Task',
        objective: 'Observe',
        scoringCriteria: 'Safe procedure',
        dueAt: '2090-01-01T00:00:00Z',
        courseId: 'course-2',
        exerciseId: null,
        submissionType: 'TEXT',
        maxScore: 100,
        passScore: 60,
        requiresSupervisorReview: false,
        reviewerMemberId: null,
        certifier: 'MENTOR'
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.createTask).not.toHaveBeenCalled();
  });

  it('task validation rejects reviewer certification without supervisor review', () => {
    const parsed = ZMentorshipTask.safeParse({
      relationIds: ['00000000-0000-4000-8000-000000000001'],
      title: 'Task',
      objective: 'Observe',
      scoringCriteria: 'Safe procedure',
      dueAt: '2090-01-01T00:00:00Z',
      requiresSupervisorReview: false,
      certifier: 'REVIEWER'
    });
    expect(parsed.success).toBe(false);
  });
});
