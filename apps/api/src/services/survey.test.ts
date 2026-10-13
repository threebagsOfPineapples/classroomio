import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZSurveyTask, ZSurveyTemplate, validateSurveyAnswers, type SurveyQuestion } from '@cio/utils/validation/survey';
import {
  canReadSurveyAnswers,
  summarizeSurveyAnswers,
  surveyCsvCell,
  surveyRecovery,
  surveyWindowState
} from './survey-rules';

const state = vi.hoisted(() => ({
  actor: { memberId: 1, canManageTraining: true, canReadReports: true },
  task: {
    id: 'task',
    organizationId: 'org',
    templateId: 'template',
    audience: 'TARGETED',
    anonymous: true,
    status: 'PUBLISHED',
    startsAt: '2000-01-01T00:00:00Z',
    endsAt: '2099-01-01T00:00:00Z'
  },
  participant: { memberId: 1, submitted: false, draft: null } as {
    memberId: number;
    submitted: boolean;
    draft: unknown;
  } | null,
  insertAnswer: vi.fn(),
  updateParticipant: vi.fn(),
  audit: vi.fn(),
  template: { status: 'PUBLISHED', questions: [] as SurveyQuestion[], version: 1 },
  scope: { type: 'ALL' as 'ALL' | 'MEMBERS', memberIds: [] as number[] },
  answers: vi.fn(),
  activeMembers: [] as { id: number; departmentIds: string[] }[],
  departments: [] as { id: string; status: string }[],
  targets: [] as { memberId: number | null; departmentId: string | null }[],
  insertParticipants: vi.fn(),
  queue: Promise.resolve() as Promise<unknown>
}));
vi.mock('./training-access', () => ({
  loadActiveTrainingActor: async () => state.actor,
  requireActiveTrainingMember: async () => ({ id: 1 }),
  requireTrainingAdministrator: (actor: typeof state.actor) => {
    if (!actor.canManageTraining) throw Object.assign(new Error('Denied'), { statusCode: 403 });
  },
  requireTrainingReportReader: (actor: typeof state.actor) => {
    if (!actor.canReadReports) throw Object.assign(new Error('Denied'), { statusCode: 403 });
  },
  resolveTrainingReadScope: async () => state.scope
}));
vi.mock('@cio/db/queries/enterprise/access', () => ({
  addTrainingOperationAudit: state.audit,
  listActiveTrainingMembers: async () => state.activeMembers
}));
vi.mock('@cio/db/queries/enterprise', () => ({ listEnterpriseDepartments: async () => state.departments }));
vi.mock('@cio/db/queries/training-plan', () => ({
  getEligibleTrainingMembers: async () => [],
  getOrgTrainingCourses: async () => [],
  listAvailableTrainingCourses: async () => []
}));
vi.mock('@cio/db/queries/survey', () => ({
  withSurveyTransaction: (callback: (transaction: object) => Promise<unknown>) => {
    const running = state.queue.then(() => callback({}));
    state.queue = running.catch(() => undefined);
    return running;
  },
  getSurveyTask: async () => state.task,
  listSurveyTasks: async () => [state.task],
  listSurveyTargets: async () => state.targets,
  insertSurveyParticipants: state.insertParticipants,
  updateSurveyTask: async (_taskId: string, values: object) => Object.assign(state.task, values),
  getSurveyParticipation: async () => state.participant,
  getSurveyTemplate: async () => state.template,
  insertSurveyAnswer: state.insertAnswer,
  updateSurveyParticipation: async (
    _taskId: string,
    _memberId: number,
    values: { submitted?: boolean; draft: unknown }
  ) => {
    state.updateParticipant(values);
    if (state.participant) Object.assign(state.participant, values);
  },
  listSurveyParticipation: async () => [
    { memberId: 1, submitted: true },
    { memberId: 2, submitted: false }
  ],
  listSurveyAnswers: state.answers,
  updateSurveyTemplate: vi.fn()
}));

import {
  changeSurveyTaskState,
  createSurveyTask,
  getSurveyAdministration,
  getSurveyReport,
  saveSurveyTemplate,
  writeMySurvey
} from './survey';

const ratingQuestion: SurveyQuestion = {
  id: '7cf9df9c-76e7-4562-9057-2b38eaf3f690',
  title: 'Rating',
  type: 'RATING',
  required: true,
  ratingMax: 5,
  options: []
};

beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { memberId: 1, canManageTraining: true, canReadReports: true };
  state.task.status = 'PUBLISHED';
  state.task.anonymous = true;
  state.task.audience = 'TARGETED';
  state.task.endsAt = '2099-01-01T00:00:00Z';
  state.participant = { memberId: 1, submitted: false, draft: null };
  state.template = { status: 'PUBLISHED', questions: [ratingQuestion], version: 1 };
  state.scope = { type: 'ALL', memberIds: [] };
  state.answers.mockResolvedValue([{ memberId: null, answers: { [ratingQuestion.id]: 4 } }]);
  state.queue = Promise.resolve();
  state.activeMembers = [];
  state.departments = [];
  state.targets = [];
});

it('keeps headquarters administrator drafts visible with a restricted member scope', async () => {
  state.task.status = 'DRAFT';
  state.scope = { type: 'MEMBERS', memberIds: [1, 2] };
  const administration = await getSurveyAdministration('org', 'profile');
  expect(administration.tasks).toHaveLength(1);
});

it('allows the headquarters administrator to read a closed anonymous whole-task summary', async () => {
  state.task.status = 'CLOSED';
  state.scope = { type: 'MEMBERS', memberIds: [1, 2] };
  state.answers.mockResolvedValue([]);
  const report = await getSurveyReport('org', 'profile', 'task');
  expect(report.answersVisible).toBe(true);
  expect(state.answers).toHaveBeenCalledWith('task', null);
});

describe('survey authorization and submission', () => {
  it('includes secondary department memberships in the frozen publishing recipient list and deduplicates the union', async () => {
    state.task.status = 'DRAFT';
    state.departments = [{ id: 'department-2', status: 'ACTIVE' }];
    state.activeMembers = [
      { id: 1, departmentIds: ['department-1', 'department-2'] },
      { id: 2, departmentIds: ['department-1'] }
    ];
    state.targets = [
      { memberId: null, departmentId: 'department-2' },
      { memberId: 1, departmentId: null }
    ];
    await changeSurveyTaskState('org', 'admin', 'task', 'PUBLISH');
    expect(state.insertParticipants.mock.calls[0][0]).toEqual([{ organizationId: 'org', taskId: 'task', memberId: 1 }]);
    expect(state.audit.mock.calls[0][0].action).toBe('PUBLISH');
  });

  it('rejects distribution targets belonging to another organization', async () => {
    await expect(
      createSurveyTask('org', 'admin', {
        title: 'Needs',
        templateId: 'template',
        purpose: 'NEEDS',
        courseId: null,
        anonymous: false,
        audience: 'TARGETED',
        startsAt: '2000-01-01T00:00:00Z',
        endsAt: '2099-01-01T00:00:00Z',
        memberIds: [99],
        departmentIds: []
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(state.insertParticipants).not.toHaveBeenCalled();
  });

  it('rejects a course association outside the organization', async () => {
    await expect(
      createSurveyTask('org', 'admin', {
        title: 'Evaluation',
        templateId: 'template',
        purpose: 'COURSE_EVALUATION',
        courseId: 'outside-course',
        anonymous: false,
        audience: 'ORGANIZATION',
        startsAt: '2000-01-01T00:00:00Z',
        endsAt: '2099-01-01T00:00:00Z',
        memberIds: [],
        departmentIds: []
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a forwarded link without invited participation', async () => {
    state.participant = null;
    await expect(writeMySurvey('org', 'employee', 'task', { [ratingQuestion.id]: 4 }, true)).rejects.toMatchObject({
      statusCode: 403
    });
    expect(state.insertAnswer).not.toHaveBeenCalled();
  });

  it('rejects a submission after the server deadline', async () => {
    state.task.endsAt = '2001-01-01T00:00:00Z';
    await expect(writeMySurvey('org', 'employee', 'task', { [ratingQuestion.id]: 4 }, true)).rejects.toMatchObject({
      statusCode: 409
    });
    expect(state.insertAnswer).not.toHaveBeenCalled();
  });

  it('serializes concurrent submissions into one anonymous answer and clears the identity-linked draft', async () => {
    const results = await Promise.all([
      writeMySurvey('org', 'employee', 'task', { [ratingQuestion.id]: 4 }, true),
      writeMySurvey('org', 'employee', 'task', { [ratingQuestion.id]: 5 }, true)
    ]);
    expect(results.every((result) => result.submitted)).toBe(true);
    expect(state.insertAnswer).toHaveBeenCalledTimes(1);
    expect(state.insertAnswer.mock.calls[0][0]).toEqual({
      organizationId: 'org',
      taskId: 'task',
      memberId: null,
      answers: { [ratingQuestion.id]: 4 }
    });
    expect(state.updateParticipant).toHaveBeenCalledWith({ submitted: true, draft: null });
    expect(state.audit).not.toHaveBeenCalled();
  });

  it('keeps named responses linked only to the authenticated actor', async () => {
    state.task.anonymous = false;
    await writeMySurvey('org', 'employee', 'task', { [ratingQuestion.id]: 3 }, true);
    expect(state.insertAnswer.mock.calls[0][0].memberId).toBe(1);
  });

  it('keeps incomplete answers as drafts but rejects final submission', async () => {
    await expect(writeMySurvey('org', 'employee', 'task', {}, false)).resolves.toEqual({
      submitted: false,
      saved: true
    });
    await expect(writeMySurvey('org', 'employee', 'task', {}, true)).rejects.toMatchObject({ statusCode: 400 });
    expect(state.insertAnswer).not.toHaveBeenCalled();
  });

  it('rejects editing the historical published template', async () => {
    await expect(
      saveSurveyTemplate('org', 'admin', { title: 'Changed', description: '', questions: [ratingQuestion] }, 'template')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('denies an HR or executive actor without explicit training administration', async () => {
    state.actor.canManageTraining = false;
    await expect(
      saveSurveyTemplate('org', 'hr', { title: 'New', description: '', questions: [ratingQuestion] })
    ).rejects.toMatchObject({ statusCode: 403 });
    state.actor.canReadReports = false;
    await expect(getSurveyReport('org', 'executive', 'task')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('withholds anonymous answers while the task remains open', async () => {
    const report = await getSurveyReport('org', 'admin', 'task');
    expect(report.answersVisible).toBe(false);
    expect(report.namedAnswers).toEqual([]);
    expect(state.answers).not.toHaveBeenCalled();
  });

  it('withholds anonymous whole-task answers from a single-person supervisor scope even after closing', async () => {
    state.actor.canManageTraining = false;
    state.task.status = 'CLOSED';
    state.scope = { type: 'MEMBERS', memberIds: [1] };
    const report = await getSurveyReport('org', 'manager', 'task');
    expect(report.recovery).toEqual({ submitted: 1, invited: 1, rate: 1 });
    expect(report.answersVisible).toBe(false);
    expect(state.answers).not.toHaveBeenCalled();
  });

  it('returns only aggregated anonymous answers without a response ID or individual time', async () => {
    state.task.status = 'CLOSED';
    const report = await getSurveyReport('org', 'admin', 'task');
    expect(report.answersVisible).toBe(true);
    expect(report.namedAnswers).toEqual([]);
    expect(report.summary[0].average).toBe(4);
    expect(report.recovery).toEqual({ submitted: 1, invited: 2, rate: 0.5 });
  });

  it('does not fall back to whole organization when supervisor scope is empty', async () => {
    state.actor.canManageTraining = false;
    state.scope = { type: 'MEMBERS', memberIds: [] };
    await expect(getSurveyReport('org', 'manager', 'task')).rejects.toMatchObject({ statusCode: 404 });
    expect(state.answers).not.toHaveBeenCalled();
  });
});

describe('survey validation and statistics', () => {
  it('validates choice options and duplicate question identifiers', () => {
    const question = { ...ratingQuestion, type: 'SINGLE' as const };
    expect(ZSurveyTemplate.safeParse({ title: 'Survey', description: '', questions: [question] }).success).toBe(false);
    expect(
      ZSurveyTemplate.safeParse({ title: 'Survey', description: '', questions: [ratingQuestion, ratingQuestion] })
        .success
    ).toBe(false);
    expect(validateSurveyAnswers([ratingQuestion], { [ratingQuestion.id]: 0 }, true)).toBe(false);
    expect(validateSurveyAnswers([ratingQuestion], { [ratingQuestion.id]: 1.5 }, true)).toBe(false);
  });

  it('rejects evaluation without a course and an inverted task window', () => {
    expect(
      ZSurveyTask.safeParse({
        title: 'Survey',
        templateId: ratingQuestion.id,
        purpose: 'COURSE_EVALUATION',
        courseId: null,
        anonymous: true,
        audience: 'ORGANIZATION',
        startsAt: '2026-10-02T00:00:00Z',
        endsAt: '2026-10-01T00:00:00Z',
        memberIds: [],
        departmentIds: []
      }).success
    ).toBe(false);
  });

  it('uses invited people as denominator and omits a rate for organization sharing', () => {
    expect(surveyRecovery(60, 80)).toEqual({ submitted: 60, invited: 80, rate: 0.75 });
    expect(surveyRecovery(60, null).rate).toBeNull();
  });

  it('does not count unanswered ratings as zero', () => {
    const summary = summarizeSurveyAnswers(
      [ratingQuestion],
      [{ [ratingQuestion.id]: 4 }, {}, { [ratingQuestion.id]: 2 }],
      false
    );
    expect(summary[0].average).toBe(3);
    expect(summary[0].validAnswers).toBe(2);
  });

  it('uses a half-open response window and requires manual closing for anonymous reporting', () => {
    expect(
      surveyWindowState(
        { status: 'PUBLISHED', startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-10-02T00:00:00Z' },
        Date.parse('2026-10-02T00:00:00Z')
      )
    ).toBe('CLOSED');
    expect(canReadSurveyAnswers(true, false, true)).toBe(false);
    expect(canReadSurveyAnswers(true, true, false)).toBe(false);
  });

  it('escapes quotes and neutralizes spreadsheet formulas in CSV content', () => {
    expect(surveyCsvCell('="secret"')).toBe('"\'=\"\"secret\"\""');
  });
});
