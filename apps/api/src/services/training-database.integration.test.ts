import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.TRAINING_TEST_DATABASE_URL;
const integration = describe.skipIf(!databaseUrl);

integration('phase one training on isolated PostgreSQL', () => {
  let connection: (strings: TemplateStringsArray, ...parameters: unknown[]) => Promise<Record<string, unknown>[]>;
  let access: typeof import('@cio/db/queries/enterprise/access');
  let employees: typeof import('@cio/db/queries/enterprise');
  let surveys: typeof import('./survey');
  let sessions: typeof import('./training-session');
  let mentorships: typeof import('./mentorship');
  const organizationId = randomUUID();
  const foreignOrganizationId = randomUUID();
  const headquartersId = randomUUID();
  const firstTeamId = randomUUID();
  const secondTeamId = randomUUID();
  const excludedDepartmentId = randomUUID();
  const foreignDepartmentId = randomUUID();
  const adminProfileId = randomUUID();
  const learnerProfileId = randomUUID();
  const managerProfileId = randomUUID();
  const excludedProfileId = randomUUID();
  let adminMemberId: number;
  let learnerMemberId: number;
  let managerMemberId: number;
  let excludedMemberId: number;

  beforeAll(async () => {
    const parsedUrl = new URL(databaseUrl!);
    if (!['127.0.0.1', 'localhost'].includes(parsedUrl.hostname) || parsedUrl.pathname !== '/training_phase_one') {
      throw new Error('Integration tests require a loopback training_phase_one database');
    }

    process.env.DATABASE_URL = databaseUrl;
    process.env.PGBOUNCER_DATABASE_URL = '';
    process.env.PRIVATE_DATABASE_URL = databaseUrl;
    const database = await import('@cio/db/drizzle');
    connection = (strings, ...parameters) => database.db.execute(database.sql(strings, ...parameters));
    await connection`insert into role (id, type) values (1, 'ADMIN'), (3, 'STUDENT') on conflict (id) do nothing`;
    await connection`insert into organization (id, name) values (${organizationId}, 'Integration headquarters'), (${foreignOrganizationId}, 'Integration foreign organization')`;
    for (const [profileId, label] of [
      [adminProfileId, 'Admin'],
      [learnerProfileId, 'Learner'],
      [managerProfileId, 'Manager'],
      [excludedProfileId, 'Excluded']
    ]) {
      const email = `${profileId}@example.test`;
      await connection`insert into "user" (id, name, email, updated_at) values (${profileId}, ${label}, ${email}, now())`;
      await connection`insert into profile (id, fullname, username, email) values (${profileId}, ${label}, ${profileId}, ${email})`;
    }
    await connection`insert into department (id, organization_id, name, code, external_source, external_id) values (${headquartersId}, ${organizationId}, 'Headquarters', 'hq', 'dingtalk:integration', '967223303'), (${foreignDepartmentId}, ${foreignOrganizationId}, 'Foreign', 'foreign', null, null)`;
    for (const [departmentId, code, externalId] of [
      [firstTeamId, 'a', '101'],
      [secondTeamId, 'b', '102'],
      [excludedDepartmentId, 'excluded', '1076307045']
    ]) {
      await connection`insert into department (id, organization_id, parent_id, name, code, external_source, external_id) values (${departmentId}, ${organizationId}, ${headquartersId}, ${code}, ${code}, 'dingtalk:integration', ${externalId})`;
    }
    const members = [];
    for (const [profileId, departmentId, roleId] of [
      [adminProfileId, headquartersId, 1],
      [learnerProfileId, null, 3],
      [managerProfileId, firstTeamId, 3],
      [excludedProfileId, excludedDepartmentId, 3]
    ] as const) {
      const [member] =
        await connection`insert into organizationmember (organization_id, role_id, profile_id, department_id) values (${organizationId}, ${roleId}, ${profileId}, ${departmentId}) returning id`;
      members.push(Number(member.id));
    }
    [adminMemberId, learnerMemberId, managerMemberId, excludedMemberId] = members;
    for (const departmentId of [firstTeamId, secondTeamId]) {
      await connection`insert into organization_member_department (organization_id, member_id, department_id, source) values (${organizationId}, ${learnerMemberId}, ${departmentId}, 'DINGTALK')`;
    }
    await connection`insert into organization_member_enterprise_role (organization_id, member_id, role) values (${organizationId}, ${managerMemberId}, 'DEPARTMENT_MANAGER')`;
    access = await import('@cio/db/queries/enterprise/access');
    employees = await import('@cio/db/queries/enterprise');
    surveys = await import('./survey');
    sessions = await import('./training-session');
    mentorships = await import('./mentorship');
  }, 30000);

  afterAll(async () => {
    const testRuntime = globalThis as typeof globalThis & { __cioDatabaseClient?: { end: () => Promise<void> } };
    await testRuntime.__cioDatabaseClient?.end();
  });

  it('fails closed for an empty data scope and deduplicates a member with no primary department', async () => {
    expect(await access.listEnterpriseScopedMemberIds(organizationId, [], [])).toEqual([]);
    expect(await employees.listEnterpriseEmployees(organizationId, [])).toEqual([]);
    const scoped = await access.listEnterpriseScopedMemberIds(organizationId, [firstTeamId, secondTeamId], []);
    expect(scoped.filter((member) => member.id === learnerMemberId)).toHaveLength(1);
    const candidates = await access.listActiveTrainingMembers(organizationId);
    const learner = candidates.find((member) => member.id === learnerMemberId);
    expect(learner?.departmentId).toBeNull();
    expect(learner?.departmentIds.sort()).toEqual([firstTeamId, secondTeamId].sort());
    expect(candidates.some((member) => member.id === excludedMemberId)).toBe(false);
    const sessionCandidates = await sessions.getTrainingSessionCandidates(organizationId, adminProfileId);
    expect(sessionCandidates.some((member) => member.memberId === excludedMemberId)).toBe(false);
  });

  it('rejects a foreign organization department at the database boundary', async () => {
    await expect(
      connection`insert into enterprise_department_scope (organization_id, member_id, department_id) values (${organizationId}, ${managerMemberId}, ${foreignDepartmentId})`
    ).rejects.toMatchObject({ cause: { code: '23503' } });
  });

  it('submits one anonymous response under simultaneous retries and freezes a deduplicated recipient list', async () => {
    const questionId = randomUUID();
    const template = await surveys.saveSurveyTemplate(organizationId, adminProfileId, {
      title: 'Integration needs survey',
      description: '',
      questions: [{ id: questionId, title: 'Rating', type: 'RATING', required: true, options: [], ratingMax: 5 }]
    });
    await surveys.publishSurveyTemplate(organizationId, adminProfileId, template.id);
    const startsAt = new Date(Date.now() - 60000).toISOString();
    const endsAt = new Date(Date.now() + 3600000).toISOString();
    const task = await surveys.createSurveyTask(organizationId, adminProfileId, {
      title: 'Integration distribution',
      templateId: template.id,
      purpose: 'NEEDS',
      courseId: null,
      anonymous: true,
      audience: 'TARGETED',
      startsAt,
      endsAt,
      memberIds: [learnerMemberId],
      departmentIds: [firstTeamId, secondTeamId]
    });
    await surveys.changeSurveyTaskState(organizationId, adminProfileId, task.id, 'PUBLISH');
    const results = await Promise.all([
      surveys.writeMySurvey(organizationId, learnerProfileId, task.id, { [questionId]: 4 }, true),
      surveys.writeMySurvey(organizationId, learnerProfileId, task.id, { [questionId]: 4 }, true)
    ]);
    expect(results.every((result) => result.submitted)).toBe(true);
    const answers = await connection`select member_id from survey_answer where task_id = ${task.id}`;
    expect(answers).toHaveLength(1);
    expect(answers[0].member_id).toBeNull();
    const participation =
      await connection`select member_id from survey_participation where task_id = ${task.id} and member_id = ${learnerMemberId}`;
    expect(participation).toHaveLength(1);
    await surveys.changeSurveyTaskState(organizationId, adminProfileId, task.id, 'CLOSE');
    const report = await surveys.getSurveyReport(organizationId, adminProfileId, task.id);
    expect(report.answersVisible).toBe(true);
    expect(report.recovery.submitted).toBe(1);
    expect(report.namedAnswers).toEqual([]);
  });

  it('records one check-in under concurrent scans and enforces HQ on forged recipient IDs', async () => {
    const startAt = new Date(Date.now() + 60000).toISOString();
    const endAt = new Date(Date.now() + 3600000).toISOString();
    const checkinOpensAt = new Date(Date.now() - 60000).toISOString();
    const values = {
      title: 'Integration class',
      instructor: '',
      location: '',
      startAt,
      endAt,
      checkinOpensAt,
      checkinClosesAt: endAt,
      memberIds: [learnerMemberId]
    };
    await expect(
      sessions.saveTrainingSessionDraft(organizationId, adminProfileId, { ...values, memberIds: [excludedMemberId] })
    ).rejects.toMatchObject({ statusCode: 403 });
    const session = await sessions.saveTrainingSessionDraft(organizationId, adminProfileId, values);
    await sessions.changeTrainingSessionStatus(organizationId, adminProfileId, session.id, 'PUBLISH');
    const issued = await sessions.changeTrainingSessionToken(organizationId, adminProfileId, session.id, true);
    const scans = await Promise.all([
      sessions.checkInTrainingSession(organizationId, learnerProfileId, session.id, issued.token!),
      sessions.checkInTrainingSession(organizationId, learnerProfileId, session.id, issued.token!)
    ]);
    expect(scans.filter((scan) => scan.duplicate)).toHaveLength(1);
    const audit =
      await connection`select id from training_operation_audit where resource_id = ${session.id} and action = 'SELF_CHECKIN'`;
    expect(audit).toHaveLength(1);
    await expect(
      sessions.checkInTrainingSession(organizationId, excludedProfileId, session.id, issued.token!)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('requires the configured supervisor review before creating one independent certification', async () => {
    await connection`insert into organization_member_enterprise_role (organization_id, member_id, role) values (${organizationId}, ${adminMemberId}, 'MENTOR')`;
    await connection`insert into enterprise_person_scope (organization_id, member_id, target_member_id) values (${organizationId}, ${managerMemberId}, ${learnerMemberId})`;
    const startsAt = new Date(Date.now() - 60000).toISOString();
    const endsAt = new Date(Date.now() + 3600000).toISOString();
    const relations = await mentorships.bindMentorships(organizationId, adminProfileId, {
      learnerMemberIds: [learnerMemberId],
      mentorMemberId: adminMemberId,
      planId: null,
      startsAt,
      endsAt
    });
    const tasks = await mentorships.assignMentorshipTasks(organizationId, adminProfileId, {
      relationIds: [relations[0].id],
      title: 'Integration practical task',
      objective: 'Explain the procedure',
      scoringCriteria: 'All steps demonstrated',
      dueAt: endsAt,
      courseId: null,
      exerciseId: null,
      submissionType: 'TEXT',
      maxScore: 100,
      passScore: 60,
      requiresSupervisorReview: true,
      reviewerMemberId: managerMemberId,
      certifier: 'REVIEWER'
    });
    const task = tasks[0];
    await mentorships.submitMentorshipTask(organizationId, learnerProfileId, task.id, {
      expectedRevision: task.revision,
      content: 'Demonstrated all steps',
      confirmed: true
    });
    const submitted = await mentorships.getMentorshipDetail(organizationId, adminProfileId, task.id);
    const submissionId = submitted.history.submissions[0].id;
    await mentorships.reviewMentorshipTask(organizationId, adminProfileId, task.id, {
      expectedRevision: submitted.task.revision,
      submissionId,
      decision: 'PASS',
      score: 90,
      content: 'Observed the complete procedure',
      observedAt: startsAt
    });
    const reviewed = await mentorships.getMentorshipDetail(organizationId, managerProfileId, task.id);
    const reviewId = reviewed.history.reviews[0].id;
    await expect(
      mentorships.certifyMentorshipTask(organizationId, managerProfileId, task.id, {
        expectedRevision: reviewed.task.revision,
        submissionId,
        reviewId,
        content: 'Too early'
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    await mentorships.supervisorReviewMentorshipTask(organizationId, managerProfileId, task.id, {
      expectedRevision: reviewed.task.revision,
      submissionId,
      reviewId,
      decision: 'PASS',
      content: 'Supervisor verified'
    });
    const approved = await mentorships.getMentorshipDetail(organizationId, managerProfileId, task.id);
    const certificateRequest = {
      expectedRevision: approved.task.revision,
      submissionId,
      reviewId,
      content: 'Certified'
    };
    await mentorships.certifyMentorshipTask(organizationId, managerProfileId, task.id, certificateRequest);
    await expect(
      mentorships.certifyMentorshipTask(organizationId, managerProfileId, task.id, certificateRequest)
    ).rejects.toMatchObject({ statusCode: 409 });
    const certificates = await connection`select id from mentorship_certification where task_id = ${task.id}`;
    expect(certificates).toHaveLength(1);
    await connection`delete from organization_member_enterprise_role where organization_id = ${organizationId} and member_id = ${adminMemberId} and role = 'MENTOR'`;
    const revoked = await mentorships.getMentorshipDetail(organizationId, adminProfileId, task.id);
    expect(revoked.permissions.review).toBe(false);
  });

  it('blocks terminated accounts in the legacy manual attendance authorization', async () => {
    const groups = await import('@cio/db/queries/group');
    const attendance = await import('@cio/db/queries/attendance');
    const groupId = randomUUID();
    const courseId = randomUUID();
    const studentId = randomUUID();
    await connection`insert into "group" (id, name, organization_id) values (${groupId}, 'Integration course group', ${organizationId})`;
    await connection`insert into course (id, title, description, group_id) values (${courseId}, 'Integration course', '', ${groupId})`;
    await connection`insert into groupmember (id, group_id, profile_id, role_id) values (${studentId}, ${groupId}, ${learnerProfileId}, 3)`;
    expect(await groups.isCourseTeamMemberOrOrgAdmin(courseId, adminProfileId)).toBe(true);
    expect(await attendance.getActiveAttendanceStudent(courseId, studentId)).not.toBeNull();
    await connection`update organizationmember set employment_status = 'TERMINATED' where id in (${adminMemberId}, ${learnerMemberId})`;
    expect(await groups.isCourseTeamMemberOrOrgAdmin(courseId, adminProfileId)).toBe(false);
    expect(await groups.isUserCourseMemberOrOrgAdmin(courseId, learnerProfileId)).toBe(false);
    expect(await attendance.getActiveAttendanceStudent(courseId, studentId)).toBeNull();
    await connection`update organizationmember set employment_status = null where id in (${adminMemberId}, ${learnerMemberId})`;
  });
});
