import { AppError, ErrorCodes } from '@api/utils/errors';
import {
  loadActiveTrainingActor,
  requireActiveTrainingMember,
  requireTrainingAdministrator,
  requireTrainingReportReader,
  resolveTrainingReadScope
} from './training-access';
import { addTrainingOperationAudit, listActiveTrainingMembers } from '@cio/db/queries/enterprise/access';
import { listEnterpriseDepartments } from '@cio/db/queries/enterprise';
import { getOrgTrainingCourses, listAvailableTrainingCourses } from '@cio/db/queries/training-plan';
import * as queries from '@cio/db/queries/survey';
import {
  validateSurveyAnswers,
  type SurveyAnswers,
  type SurveyTaskInput,
  type SurveyTemplateInput
} from '@cio/utils/validation/survey';
import {
  canReadSurveyAnswers,
  summarizeSurveyAnswers,
  surveyCsvCell,
  surveyRecovery,
  surveyWindowState
} from './survey-rules';

function invalid(message: string, status = 400): never {
  throw new AppError(message, ErrorCodes.VALIDATION_ERROR, status);
}

async function administrator(organizationId: string, profileId: string) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  requireTrainingAdministrator(actor);
  return actor;
}

export async function getSurveyAdministration(organizationId: string, profileId: string) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  requireTrainingReportReader(actor);
  const scope = await resolveTrainingReadScope(actor);
  const tasks = await queries.listSurveyTasks(organizationId);
  const visibleTasks = [];
  for (const task of tasks) {
    if (actor.canManageTraining) visibleTasks.push(task);
    else if (scope.type === 'MEMBERS' && task.status !== 'DRAFT') {
      const participants = await queries.listSurveyParticipation(task.id);
      if (participants.some((participant) => scope.memberIds.includes(participant.memberId))) visibleTasks.push(task);
    }
  }
  return { tasks: visibleTasks, canManage: actor.canManageTraining };
}

export async function getSurveyTemplateAdministration(organizationId: string, profileId: string) {
  await administrator(organizationId, profileId);
  const [templates, members, departments, courses] = await Promise.all([
    queries.listSurveyTemplates(organizationId),
    listActiveTrainingMembers(organizationId),
    listEnterpriseDepartments(organizationId),
    listAvailableTrainingCourses(organizationId)
  ]);
  return {
    templates,
    members,
    departments: departments.filter((department) => department.status === 'ACTIVE'),
    courses
  };
}

export async function saveSurveyTemplate(
  organizationId: string,
  profileId: string,
  values: SurveyTemplateInput,
  templateId?: string
) {
  await administrator(organizationId, profileId);
  return queries.withSurveyTransaction(async (transaction) => {
    let template;
    if (templateId) {
      const current = await queries.getSurveyTemplate(organizationId, templateId, transaction, true);
      if (!current) invalid('Survey template not found', 404);
      if (current.status !== 'DRAFT') invalid('Published survey templates are immutable; copy to a new draft');

      template = await queries.updateSurveyTemplate(organizationId, templateId, values, transaction);
    } else
      template = await queries.insertSurveyTemplate(
        { ...values, organizationId, createdByProfileId: profileId },
        transaction
      );

    await addTrainingOperationAudit(
      {
        organizationId,
        actorProfileId: profileId,
        resourceType: 'SURVEY_TEMPLATE',
        resourceId: template.id,
        action: templateId ? 'UPDATE_DRAFT' : 'CREATE_DRAFT'
      },
      transaction
    );
    return template;
  });
}

export async function publishSurveyTemplate(organizationId: string, profileId: string, templateId: string) {
  await administrator(organizationId, profileId);
  return queries.withSurveyTransaction(async (transaction) => {
    const current = await queries.getSurveyTemplate(organizationId, templateId, transaction, true);
    if (!current) invalid('Survey template not found', 404);
    if (current.status === 'PUBLISHED') return current;

    const template = await queries.updateSurveyTemplate(
      organizationId,
      templateId,
      { status: 'PUBLISHED' },
      transaction
    );
    await addTrainingOperationAudit(
      {
        organizationId,
        actorProfileId: profileId,
        resourceType: 'SURVEY_TEMPLATE',
        resourceId: templateId,
        action: 'PUBLISH'
      },
      transaction
    );
    return template;
  });
}

async function resolveRecipients(organizationId: string, memberIds: number[], departmentIds: string[]) {
  const [members, departments] = await Promise.all([
    listActiveTrainingMembers(organizationId),
    listEnterpriseDepartments(organizationId)
  ]);
  if (memberIds.some((id) => !members.some((member) => member.id === id)))
    invalid('Recipient is inactive or outside this organization');
  if (
    departmentIds.some(
      (id) => !departments.some((department) => department.id === id && department.status === 'ACTIVE')
    )
  )
    invalid('Department is inactive or outside this organization');

  return members.filter(
    (member) =>
      memberIds.includes(member.id) || member.departmentIds.some((departmentId) => departmentIds.includes(departmentId))
  );
}

export async function createSurveyTask(organizationId: string, profileId: string, values: SurveyTaskInput) {
  await administrator(organizationId, profileId);
  const template = await queries.getSurveyTemplate(organizationId, values.templateId);
  if (!template || template.status !== 'PUBLISHED') invalid('Select a published survey template');
  if (values.courseId) {
    const courses = await getOrgTrainingCourses(organizationId, [values.courseId]);
    if (!courses.length) invalid('Course is unavailable or outside this organization');
  }

  const recipients = await resolveRecipients(organizationId, values.memberIds, values.departmentIds);
  if (values.audience === 'TARGETED' && !recipients.length) invalid('Survey has no eligible recipients');

  return queries.withSurveyTransaction(async (transaction) => {
    const { memberIds, departmentIds, ...taskValues } = values;
    const task = await queries.insertSurveyTask(
      { ...taskValues, organizationId, createdByProfileId: profileId },
      transaction
    );
    const targets = [
      ...[...new Set(memberIds)].map((memberId) => ({ organizationId, taskId: task.id, memberId })),
      ...[...new Set(departmentIds)].map((departmentId) => ({ organizationId, taskId: task.id, departmentId }))
    ];
    await queries.insertSurveyTargets(targets, transaction);
    await addTrainingOperationAudit(
      {
        organizationId,
        actorProfileId: profileId,
        resourceType: 'SURVEY_TASK',
        resourceId: task.id,
        action: 'CREATE_DRAFT'
      },
      transaction
    );
    return task;
  });
}

export async function getSurveyTaskAdministration(organizationId: string, profileId: string, taskId: string) {
  await administrator(organizationId, profileId);
  const task = await queries.getSurveyTask(organizationId, taskId);
  if (!task) invalid('Survey task not found', 404);

  const template = await queries.getSurveyTemplate(organizationId, task.templateId);
  const targets = await queries.listSurveyTargets(taskId);
  const recipients =
    task.status === 'DRAFT'
      ? await resolveRecipients(
          organizationId,
          targets.flatMap((target) => (target.memberId ? [target.memberId] : [])),
          targets.flatMap((target) => (target.departmentId ? [target.departmentId] : []))
        )
      : await queries.listSurveyParticipation(taskId);
  return { task, template, recipients, targets };
}

export async function changeSurveyTaskState(
  organizationId: string,
  profileId: string,
  taskId: string,
  action: 'PUBLISH' | 'CLOSE'
) {
  await administrator(organizationId, profileId);
  await queries.withSurveyTransaction(async (transaction) => {
    const task = await queries.getSurveyTask(organizationId, taskId, transaction, true);
    if (!task) invalid('Survey task not found', 404);
    if (action === 'PUBLISH') {
      if (task.status === 'PUBLISHED') return;
      if (task.status !== 'DRAFT' || Date.parse(task.endsAt) <= Date.now())
        invalid('Only unexpired draft surveys can be published');

      const targets = await queries.listSurveyTargets(taskId, transaction);
      const recipients = await resolveRecipients(
        organizationId,
        targets.flatMap((target) => (target.memberId ? [target.memberId] : [])),
        targets.flatMap((target) => (target.departmentId ? [target.departmentId] : []))
      );
      if (task.audience === 'TARGETED' && !recipients.length) invalid('Survey has no eligible recipients');
      if (task.audience === 'TARGETED')
        await queries.insertSurveyParticipants(
          recipients.map((member) => ({ organizationId, taskId, memberId: member.id })),
          transaction
        );

      await queries.updateSurveyTask(
        taskId,
        { status: 'PUBLISHED', publishedAt: new Date().toISOString() },
        transaction
      );
    } else {
      if (task.status === 'DRAFT') invalid('Draft survey cannot be closed');

      await queries.updateSurveyTask(taskId, { status: 'CLOSED' }, transaction);
    }
    await addTrainingOperationAudit(
      { organizationId, actorProfileId: profileId, resourceType: 'SURVEY_TASK', resourceId: taskId, action },
      transaction
    );
  });
  return getSurveyTaskAdministration(organizationId, profileId, taskId);
}

export async function getMySurveys(organizationId: string, profileId: string) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  await requireActiveTrainingMember(organizationId, actor.memberId);
  const tasks = await queries.listSurveyTasks(organizationId);
  const visible = [];
  for (const task of tasks.filter((task) => task.status !== 'DRAFT')) {
    const participation = await queries.getSurveyParticipation(task.id, actor.memberId);
    if (task.audience === 'ORGANIZATION' || participation)
      visible.push({ ...task, submitted: participation?.submitted ?? false, window: surveyWindowState(task) });
  }
  return visible;
}

export async function getMySurvey(organizationId: string, profileId: string, taskId: string) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  await requireActiveTrainingMember(organizationId, actor.memberId);
  const task = await queries.getSurveyTask(organizationId, taskId);
  if (!task || task.status === 'DRAFT') invalid('Survey task not found', 404);

  const participation = await queries.getSurveyParticipation(taskId, actor.memberId);
  if (task.audience === 'TARGETED' && !participation) invalid('You are not invited to this survey', 403);

  const template = await queries.getSurveyTemplate(organizationId, task.templateId);
  if (!template) invalid('Survey template not found', 404);

  return {
    task,
    template,
    submitted: participation?.submitted ?? false,
    answers: participation?.draft ?? {},
    window: surveyWindowState(task)
  };
}

export async function writeMySurvey(
  organizationId: string,
  profileId: string,
  taskId: string,
  answers: SurveyAnswers,
  final: boolean
) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  await requireActiveTrainingMember(organizationId, actor.memberId);
  return queries.withSurveyTransaction(async (transaction) => {
    const task = await queries.getSurveyTask(organizationId, taskId, transaction, true);
    if (!task || task.status === 'DRAFT') invalid('Survey task not found', 404);

    let participation = await queries.getSurveyParticipation(taskId, actor.memberId, transaction);
    if (task.audience === 'TARGETED' && !participation) invalid('You are not invited to this survey', 403);
    if (participation?.submitted) return { submitted: true, saved: false };
    if (surveyWindowState(task) !== 'OPEN') invalid('Survey is not open', 409);

    const template = await queries.getSurveyTemplate(organizationId, task.templateId, transaction);
    if (!template || !validateSurveyAnswers(template.questions, answers, final))
      invalid('Survey answers are incomplete or invalid');
    if (!participation) {
      await queries.insertSurveyParticipants([{ organizationId, taskId, memberId: actor.memberId }], transaction);
      participation = await queries.getSurveyParticipation(taskId, actor.memberId, transaction);
    }
    if (final) {
      await queries.insertSurveyAnswer(
        { organizationId, taskId, memberId: task.anonymous ? null : actor.memberId, answers },
        transaction
      );
      await queries.updateSurveyParticipation(taskId, actor.memberId, { submitted: true, draft: null }, transaction);
    } else await queries.updateSurveyParticipation(taskId, actor.memberId, { draft: answers }, transaction);

    return { submitted: final, saved: !final };
  });
}

export async function getSurveyReport(organizationId: string, profileId: string, taskId: string) {
  const actor = await loadActiveTrainingActor(organizationId, profileId);
  requireTrainingReportReader(actor);
  const task = await queries.getSurveyTask(organizationId, taskId);
  if (!task) invalid('Survey task not found', 404);

  const scope = await resolveTrainingReadScope(actor);
  const participants = await queries.listSurveyParticipation(taskId);
  const visibleParticipants =
    scope.type === 'ALL'
      ? participants
      : participants.filter((participant) => scope.memberIds.includes(participant.memberId));
  if (!actor.canManageTraining && !visibleParticipants.length) invalid('Survey task not found', 404);

  const template = await queries.getSurveyTemplate(organizationId, task.templateId);
  if (!template) invalid('Survey template not found', 404);

  const entireAudienceVisible = participants.length === visibleParticipants.length;
  const canReadWholeTask = actor.canManageTraining && entireAudienceVisible;
  const answersVisible = canReadSurveyAnswers(task.anonymous, task.status === 'CLOSED', canReadWholeTask);
  const answerMemberIds = task.anonymous || scope.type === 'ALL' ? null : scope.memberIds;
  const answerRows = answersVisible ? await queries.listSurveyAnswers(taskId, answerMemberIds) : [];
  const answers = answerRows.map((row) => row.answers);
  const recovery = surveyRecovery(
    visibleParticipants.filter((participant) => participant.submitted).length,
    task.audience === 'TARGETED' ? visibleParticipants.length : null
  );
  const summary = answersVisible ? summarizeSurveyAnswers(template.questions, answers, !task.anonymous) : [];
  const namedAnswers = task.anonymous ? [] : answerRows;
  return {
    task,
    version: template.version,
    observedAt: new Date().toISOString(),
    scope: scope.type,
    recovery,
    participants: visibleParticipants,
    answersVisible,
    summary,
    namedAnswers
  };
}

export async function exportSurveyReport(
  organizationId: string,
  profileId: string,
  taskId: string,
  kind: 'answers' | 'participation'
) {
  const report = await getSurveyReport(organizationId, profileId, taskId);
  if (kind === 'answers' && !report.answersVisible)
    invalid('Anonymous answers become available only as an overall summary after closing', 403);

  const rows: unknown[][] = [
    ['Task', report.task.title],
    ['Task ID', taskId],
    ['Version', report.version],
    ['Purpose', report.task.purpose],
    ['Scope', report.scope],
    ['Starts at', report.task.startsAt],
    ['Ends at', report.task.endsAt],
    ['Observed at', report.observedAt],
    ['Submitted', report.recovery.submitted],
    ['Invited', report.recovery.invited],
    ['Recovery rate', report.recovery.rate],
    []
  ];
  if (kind === 'participation') {
    rows.push(['Employee number', 'Name', 'Email', 'Submitted']);
    for (const participant of report.participants)
      rows.push([participant.employeeNo, participant.fullname, participant.email, participant.submitted]);
  } else if (report.task.anonymous) {
    rows.push(['Question', 'Type', 'Valid answers', 'Option / rating', 'Count', 'Rate / average']);
    for (const item of report.summary) {
      rows.push([item.question.title, item.question.type, item.validAnswers, '', '', item.average]);
      for (const option of item.options)
        rows.push([
          item.question.title,
          item.question.type,
          item.validAnswers,
          option.label,
          option.count,
          option.rate
        ]);
      if (item.question.type === 'RATING')
        for (const bucket of item.distribution)
          rows.push([item.question.title, item.question.type, item.validAnswers, bucket.rating, bucket.count, '']);
    }
  } else {
    const questions = report.summary.map((item) => item.question);
    rows.push(['Employee number', 'Name', ...questions.map((question) => question.title)]);
    for (const answer of report.namedAnswers) {
      const participant = report.participants.find((participant) => participant.memberId === answer.memberId);
      const cells = questions.map((question) => {
        const value = answer.answers[question.id];
        if (Array.isArray(value))
          return value.map((id) => question.options.find((option) => option.id === id)?.label ?? id).join('; ');
        if (question.type === 'SINGLE') return question.options.find((option) => option.id === value)?.label ?? '';

        return value;
      });
      rows.push([participant?.employeeNo, participant?.fullname, ...cells]);
    }
  }
  return '\ufeff' + rows.map((row) => row.map(surveyCsvCell).join(',')).join('\r\n');
}
