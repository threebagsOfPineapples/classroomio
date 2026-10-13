import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const privateDirectory = '/app/test119-private';
const fixturePath = `${privateDirectory}/验收账号与资源.json`;
const lockPath = `${privateDirectory}/acceptance.lock`;
const originAllowlist = ['http://10.60.2.119:3082', 'http://dashboard:3082'];

function validateTarget(environment) {
  assert.equal(environment.TEST119_ACCEPTANCE, 'true', 'Explicit TEST119_ACCEPTANCE=true required');
  const database = new URL(environment.DATABASE_URL);
  assert.ok(['postgres:', 'postgresql:'].includes(database.protocol), 'PostgreSQL URL required');
  assert.equal(database.hostname, 'postgres', 'Database hostname must be postgres');
  assert.equal(database.pathname, '/train_test119', 'Only train_test119 is allowed');
  assert.ok(!database.search && !database.hash, 'Database URL options are forbidden');
  assert.ok(originAllowlist.includes(environment.DASHBOARD_ORIGIN), 'Only the 119 dashboard is allowed');
  if (environment.DASHBOARD_ORIGIN === originAllowlist[1]) {
    assert.equal(environment.TEST119_TARGET_HOST, '10.60.2.119', 'Container origin requires an explicit 119 target');
  }

  return environment.DASHBOARD_ORIGIN;
}

function selfCheck() {
  const environment = {
    TEST119_ACCEPTANCE: 'true',
    DATABASE_URL: 'postgres://fixture:fixture@postgres:5432/train_test119',
    DASHBOARD_ORIGIN: originAllowlist[0]
  };
  assert.equal(validateTarget(environment), originAllowlist[0]);
  for (const override of [
    { TEST119_ACCEPTANCE: 'false' },
    { DATABASE_URL: 'postgres://fixture:fixture@postgres:5432/production' },
    { DATABASE_URL: 'postgres://fixture:fixture@10.60.6.101:5432/train_test119' },
    { DATABASE_URL: `${environment.DATABASE_URL}?host=elsewhere` },
    { DASHBOARD_ORIGIN: 'http://10.60.6.101:3082' },
    { DASHBOARD_ORIGIN: originAllowlist[1] }
  ]) {
    assert.throws(() => validateTarget({ ...environment, ...override }));
  }
  const internal = { ...environment, DASHBOARD_ORIGIN: originAllowlist[1], TEST119_TARGET_HOST: '10.60.2.119' };
  assert.equal(validateTarget(internal), originAllowlist[1]);
  console.log(JSON.stringify({ selfCheck: 'passed', networkRequests: 0, databaseWrites: 0 }));
}

async function saveFixture(fixture) {
  const temporaryPath = `${fixturePath}.pending`;
  await writeFile(temporaryPath, JSON.stringify(fixture, null, 2), { mode: 0o600, flag: 'wx' });
  await rename(temporaryPath, fixturePath);
  await chmod(fixturePath, 0o600);
}

async function initializeFixture(sql, bcrypt) {
  let fixture;
  try {
    const metadata = await lstat(fixturePath);
    assert.ok(metadata.isFile() && !metadata.isSymbolicLink(), 'Fixture must be a regular private file');
    assert.equal(metadata.mode & 0o777, 0o600, 'Fixture permission must be 600');
    const serialized = await readFile(fixturePath, 'utf8');
    fixture = JSON.parse(serialized);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;

    const prefix = `test119-${randomBytes(6).toString('hex')}`;
    const accounts = {};
    for (const name of [
      'admin',
      'learner',
      'mentor',
      'supervisor',
      'parallel',
      'leave',
      'absent',
      'uninvited',
      'excluded',
      'terminated'
    ]) {
      const profileId = randomUUID();
      const password = randomBytes(24).toString('base64url');
      const email = `${prefix}-${name}@example.test`;
      accounts[name] = { profileId, password, email };
    }
    const organizationId = randomUUID();
    const groupId = randomUUID();
    const courseId = randomUUID();
    const headquarters = randomUUID();
    const first = randomUUID();
    const second = randomUUID();
    const third = randomUUID();
    const excluded = randomUUID();
    fixture = {
      version: 1,
      prefix,
      organizationId,
      groupId,
      courseId,
      departments: { headquarters, first, second, third, excluded },
      accounts,
      runs: [],
      initialized: false
    };
    await saveFixture(fixture);
  }
  assert.equal(fixture.version, 1, 'Unsupported fixture version');
  assert.match(fixture.prefix, /^test119-[a-f0-9]{12}$/);
  if (!fixture.initialized) {
    const recovered = await sql`select id from organization where id = ${fixture.organizationId}`;
    if (recovered.length) {
      for (const account of Object.values(fixture.accounts)) {
        const members =
          await sql`select id from organizationmember where organization_id = ${fixture.organizationId} and profile_id = ${account.profileId}`;
        assert.equal(members.length, 1, 'Incomplete fixture transaction');
        account.memberId = Number(members[0].id);
      }
    } else {
      await sql.begin(async (transaction) => {
        await transaction`insert into role (id, type) values (1, 'ADMIN'), (3, 'STUDENT') on conflict (id) do nothing`;
        await transaction`insert into organization (id, name, "siteName") values (${fixture.organizationId}, ${fixture.prefix}, ${fixture.prefix})`;
        for (const [name, departmentId] of Object.entries(fixture.departments)) {
          const parentId = name === 'headquarters' ? null : fixture.departments.headquarters;
          const externalId = name === 'headquarters' ? '967223303' : name === 'excluded' ? '1076307045' : name;
          await transaction`insert into department (id, organization_id, parent_id, name, code, external_source, external_id) values (${departmentId}, ${fixture.organizationId}, ${parentId}, ${name}, ${name}, 'dingtalk:test119-fixture', ${externalId})`;
        }
        for (const [name, account] of Object.entries(fixture.accounts)) {
          const fullname = `${fixture.prefix}-${name}`;
          const passwordHash = await bcrypt.hash(account.password, 10);
          await transaction`insert into "user" (id, name, email, email_verified, updated_at) values (${account.profileId}, ${fullname}, ${account.email}, true, now())`;
          await transaction`insert into profile (id, fullname, username, email) values (${account.profileId}, ${fullname}, ${fullname}, ${account.email})`;
          await transaction`insert into account (account_id, provider_id, user_id, password, updated_at) values (${account.profileId}, 'credential', ${account.profileId}, ${passwordHash}, now())`;
          const roleId = name === 'admin' ? 1 : 3;
          const departmentId = ['admin', 'learner'].includes(name)
            ? null
            : name === 'excluded'
              ? fixture.departments.excluded
              : name === 'parallel'
                ? fixture.departments.second
                : name === 'uninvited'
                  ? fixture.departments.third
                  : fixture.departments.first;
          const employmentStatus = name === 'terminated' ? 'TERMINATED' : 'ACTIVE';
          const members =
            await transaction`insert into organizationmember (organization_id, role_id, profile_id, email, department_id, employment_status, verified) values (${fixture.organizationId}, ${roleId}, ${account.profileId}, ${account.email}, ${departmentId}, ${employmentStatus}, true) returning id`;
          account.memberId = Number(members[0].id);
          const enterpriseRole =
            name === 'mentor'
              ? 'MENTOR'
              : ['supervisor', 'parallel'].includes(name)
                ? 'DEPARTMENT_MANAGER'
                : 'EMPLOYEE';
          await transaction`insert into organization_member_enterprise_role (organization_id, member_id, role) values (${fixture.organizationId}, ${account.memberId}, ${enterpriseRole})`;
        }
        for (const departmentId of [fixture.departments.first, fixture.departments.second]) {
          await transaction`insert into organization_member_department (organization_id, member_id, department_id, source) values (${fixture.organizationId}, ${fixture.accounts.learner.memberId}, ${departmentId}, 'MANUAL')`;
        }
        for (const name of ['supervisor', 'parallel']) {
          const memberId = fixture.accounts[name].memberId;
          const departmentId = name === 'supervisor' ? fixture.departments.first : fixture.departments.second;
          await transaction`insert into enterprise_department_scope (organization_id, member_id, department_id) values (${fixture.organizationId}, ${memberId}, ${departmentId})`;
        }
        await transaction`insert into "group" (id, name, organization_id) values (${fixture.groupId}, ${fixture.prefix}, ${fixture.organizationId})`;
        await transaction`insert into course (id, title, description, group_id, is_published) values (${fixture.courseId}, '公司介绍验收课程', '仅独立验收库使用', ${fixture.groupId}, true)`;
      });
    }
    fixture.initialized = true;
    await saveFixture(fixture);
  }
  const organizations = await sql`select name from organization where id = ${fixture.organizationId}`;
  assert.equal(organizations.length, 1, 'Fixture organization missing');
  assert.equal(organizations[0].name, fixture.prefix, 'Fixture organization identity changed');
  for (const account of Object.values(fixture.accounts)) {
    const members =
      await sql`select member.id, member.profile_id, auth.email from organizationmember member join "user" auth on auth.id = member.profile_id where member.organization_id = ${fixture.organizationId} and member.id = ${account.memberId}`;
    assert.equal(members.length, 1, 'Fixture member missing');
    assert.equal(members[0].profile_id, account.profileId, 'Fixture profile changed');
    assert.equal(members[0].email, account.email, 'Fixture email changed');
  }

  return fixture;
}

async function runAcceptance() {
  const origin = validateTarget(process.env);
  await mkdir(privateDirectory, { recursive: true, mode: 0o700 });
  const directoryMetadata = await lstat(privateDirectory);
  assert.ok(
    directoryMetadata.isDirectory() && !directoryMetadata.isSymbolicLink(),
    'Private directory must not be a symlink'
  );
  await chmod(privateDirectory, 0o700);
  await writeFile(lockPath, String(process.pid), { flag: 'wx', mode: 0o600 });
  const cookies = new Map();
  const checks = [];
  let sql;
  let fixture;
  let step = 'initialize';
  const check = (name, condition) => {
    assert.ok(condition, name);
    checks.push(name);
  };
  async function request(actor, path, { method = 'GET', body, status = 200, csv = false } = {}) {
    step = `${actor}:${method}:${path.split('?')[0]}`;
    const headers = { Origin: originAllowlist[0], 'cio-org-id': fixture.organizationId };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (cookies.has(actor)) headers.Cookie = cookies.get(actor);
    const serialized = body === undefined ? undefined : JSON.stringify(body);
    const response = await fetch(`${origin}${path}`, {
      method,
      headers,
      body: serialized,
      redirect: 'error',
      signal: AbortSignal.timeout(30000)
    });
    const cookieValues = response.headers.getSetCookie();
    if (cookieValues.length) {
      const previousCookies = (cookies.get(actor) ?? '').split('; ').filter(Boolean);
      const cookieJar = new Map(previousCookies.map((value) => [value.slice(0, value.indexOf('=')), value]));
      for (const value of cookieValues) {
        const cookie = value.split(';')[0];
        const name = cookie.slice(0, cookie.indexOf('='));
        if (/;\s*max-age=0(?:;|$)/i.test(value)) cookieJar.delete(name);
        else cookieJar.set(name, cookie);
      }
      cookies.set(actor, [...cookieJar.values()].join('; '));
    }
    if (response.status !== status) {
      let diagnostic = '';
      if (path.startsWith('/proxy/enterprise')) {
        const failure = await response.json().catch(() => ({}));
        const code = typeof failure.code === 'string' ? failure.code : undefined;
        const message =
          typeof failure.message === 'string'
            ? failure.message
            : typeof failure.error === 'string'
              ? failure.error
              : undefined;
        diagnostic = JSON.stringify({ code, message });
      }
      assert.fail(`${step} expected ${status}, received ${response.status} ${diagnostic}`);
    }
    if (status < 200 || status >= 300) {
      const rejected = await response.json();
      assert.notEqual(rejected.success, true, `${step} rejection shape`);

      return rejected;
    }
    if (csv) {
      assert.match(response.headers.get('content-type') ?? '', /^text\/csv/);

      return response.text();
    }
    const result = await response.json();
    if (!path.startsWith('/proxy/api/auth/')) assert.equal(result.success, true, `${step} success required`);

    return result;
  }
  const enterprise = async (actor, path, options) => {
    const response = await request(actor, `/proxy/enterprise${path}`, options);

    return options?.csv ? response : response.data;
  };
  try {
    const require = createRequire('/app/packages/db/package.json');
    const postgres = require('postgres');
    const bcrypt = require('bcrypt');
    sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
    fixture = await initializeFixture(sql, bcrypt);
    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    const run = { runId, startedAt, resources: [], status: 'RUNNING' };
    fixture.runs.push(run);
    await saveFixture(fixture);
    const remember = async (kind, id) => {
      assert.match(id, /^[a-f0-9-]{36}$/i, `${kind} ID required`);
      run.resources.push({ kind, id });
      await saveFixture(fixture);

      return id;
    };
    for (const [name, account] of Object.entries(fixture.accounts)) {
      const login = await request(name, '/proxy/api/auth/sign-in/email', {
        method: 'POST',
        body: { email: account.email, password: account.password }
      });
      check(`login-${name}`, login.user?.id === account.profileId && cookies.has(name));
    }
    const { accounts, departments } = fixture;
    const startsAt = new Date(Date.now() - 60000).toISOString();
    const endsAt = new Date(Date.now() + 3600000).toISOString();
    const candidates = await enterprise('admin', '/sessions/candidates');
    check(
      'multi-department-no-primary-candidate-once',
      candidates.filter((member) => member.memberId === accounts.learner.memberId).length === 1
    );
    check(
      'out-of-hq-and-terminated-excluded',
      !candidates.some((member) => [accounts.excluded.memberId, accounts.terminated.memberId].includes(member.memberId))
    );
    const preview = await enterprise('admin', '/sessions/preview', {
      method: 'POST',
      body: { departmentIds: [departments.first, departments.second], memberIds: [accounts.learner.memberId] }
    });
    check(
      'audience-deduplicates',
      preview.members.filter((member) => member.memberId === accounts.learner.memberId).length === 1 &&
        preview.count === preview.members.length
    );
    const planCode = `t119-${runId.slice(0, 8)}`;
    const planDraft = {
      name: planCode,
      code: planCode,
      year: new Date().getUTCFullYear(),
      planType: 'SPECIAL',
      startAt: startsAt,
      endAt: endsAt,
      courseIds: [fixture.courseId],
      targets: [
        { targetType: 'DEPARTMENT', departmentId: departments.first, includeDescendants: true },
        { targetType: 'DEPARTMENT', departmentId: departments.second, includeDescendants: true }
      ]
    };
    const plan = await enterprise('admin', '/plans', { method: 'POST', body: planDraft, status: 201 });
    const planId = await remember('plan', plan.plan.id);
    const planPreview = await enterprise('admin', `/plans/${planId}/preview`);
    check(
      'plan-multi-department-dedup-and-scope',
      planPreview.memberIds.filter((id) => id === accounts.learner.memberId).length === 1 &&
        !planPreview.memberIds.includes(accounts.excluded.memberId) &&
        !planPreview.memberIds.includes(accounts.terminated.memberId)
    );
    const manualTarget = { targetType: 'USER', memberId: accounts.learner.memberId };
    const manualTargets = [...planDraft.targets, manualTarget];
    const manualDraft = { ...planDraft, targets: manualTargets };
    await enterprise('admin', `/plans/${planId}`, { method: 'PUT', body: manualDraft });
    const manualPreview = await enterprise('admin', `/plans/${planId}/preview`);
    assert.deepEqual([...manualPreview.memberIds].sort(), [...planPreview.memberIds].sort());
    check('plan-manual-selection-does-not-duplicate', manualPreview.count === planPreview.count);
    const publishedPlan = await enterprise('admin', `/plans/${planId}/publish`, { method: 'POST' });
    check(
      'plan-published-enrollment-count',
      publishedPlan.plan.status === 'PUBLISHED' && publishedPlan.enrollmentCount === planPreview.count
    );
    const repeatedPlan = await enterprise('admin', `/plans/${planId}/publish`, { method: 'POST' });
    check('plan-publish-idempotent', repeatedPlan.enrollmentCount === publishedPlan.enrollmentCount);
    for (const anonymous of [false, true]) {
      const questionId = randomUUID();
      const templateBody = {
        title: `${planCode}-survey-${anonymous}`,
        description: '',
        questions: [{ id: questionId, title: '满意度', type: 'RATING', required: true, options: [], ratingMax: 5 }]
      };
      const template = await enterprise('admin', '/surveys/templates', { method: 'POST', body: templateBody });
      const templateId = await remember('survey-template', template.id);
      await enterprise('admin', `/surveys/templates/${templateId}/publish`, { method: 'POST' });
      const taskBody = {
        title: templateBody.title,
        templateId,
        purpose: 'NEEDS',
        courseId: null,
        anonymous,
        audience: 'TARGETED',
        startsAt,
        endsAt,
        memberIds: [accounts.learner.memberId, accounts.leave.memberId],
        departmentIds: [departments.first, departments.second]
      };
      const task = await enterprise('admin', '/surveys/tasks', { method: 'POST', body: taskBody });
      const taskId = await remember('survey-task', task.id);
      const published = await enterprise('admin', `/surveys/tasks/${taskId}/publish`, { method: 'POST' });
      check(
        `survey-${anonymous}-recipient-once`,
        published.recipients.filter((member) => member.memberId === accounts.learner.memberId).length === 1
      );
      const answers = { answers: { [questionId]: 4 } };
      const draft = await enterprise('learner', `/surveys/mine/${taskId}/draft`, { method: 'PUT', body: answers });
      check(`survey-${anonymous}-draft`, draft.saved === true && draft.submitted === false);
      const submission = await enterprise('learner', `/surveys/mine/${taskId}/submit`, {
        method: 'POST',
        body: answers
      });
      check(`survey-${anonymous}-submit`, submission.submitted === true);
      const duplicate = await enterprise('learner', `/surveys/mine/${taskId}/submit`, {
        method: 'POST',
        body: answers
      });
      check(`survey-${anonymous}-duplicate-idempotent`, duplicate.submitted === true && duplicate.saved === false);
      await request('excluded', `/proxy/enterprise/surveys/mine/${taskId}/submit`, {
        method: 'POST',
        body: answers,
        status: 403
      });
      await request('uninvited', `/proxy/enterprise/surveys/mine/${taskId}/submit`, {
        method: 'POST',
        body: answers,
        status: 403
      });
      await request('terminated', `/proxy/enterprise/surveys/mine/${taskId}/submit`, {
        method: 'POST',
        body: answers,
        status: 403
      });
      if (anonymous)
        await request('admin', `/proxy/enterprise/surveys/tasks/${taskId}/export?kind=answers`, { status: 403 });
      await enterprise('admin', `/surveys/tasks/${taskId}/close`, { method: 'POST' });
      await request('leave', `/proxy/enterprise/surveys/mine/${taskId}/submit`, {
        method: 'POST',
        body: answers,
        status: 409
      });
      const report = await enterprise('admin', `/surveys/tasks/${taskId}/report`);
      check(`survey-${anonymous}-recovery`, report.recovery.submitted === 1 && report.answersVisible === true);
      check(`survey-${anonymous}-identity-policy`, report.namedAnswers.length === (anonymous ? 0 : 1));
      const rows = await sql`select member_id from survey_answer where task_id = ${taskId}`;
      check(
        `survey-${anonymous}-stored-dedup`,
        rows.length === 1 &&
          (anonymous ? rows[0].member_id === null : Number(rows[0].member_id) === accounts.learner.memberId)
      );
      const answersCsv = await enterprise('admin', `/surveys/tasks/${taskId}/export?kind=answers`, { csv: true });
      check(`survey-${anonymous}-csv`, answersCsv.includes(taskId) && answersCsv.includes('满意度'));
      const participantsCsv = await enterprise('admin', `/surveys/tasks/${taskId}/export?kind=participation`, {
        csv: true
      });
      check(`survey-${anonymous}-participation-csv`, participantsCsv.includes(accounts.learner.email));
      if (!anonymous) {
        const deadline = new Date(Date.now() + 5000).toISOString();
        const expiring = await enterprise('admin', '/surveys/tasks', {
          method: 'POST',
          body: {
            ...taskBody,
            title: `${planCode}-deadline`,
            memberIds: [accounts.learner.memberId],
            departmentIds: [],
            endsAt: deadline
          }
        });
        const expiringId = await remember('survey-task', expiring.id);
        await enterprise('admin', `/surveys/tasks/${expiringId}/publish`, { method: 'POST' });
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, Date.parse(deadline) - Date.now()) + 100));
        await request('learner', `/proxy/enterprise/surveys/mine/${expiringId}/submit`, {
          method: 'POST',
          body: answers,
          status: 409
        });
        const expiredAnswers = await sql`select id from survey_answer where task_id = ${expiringId}`;
        check('survey-deadline-rejected-without-write', expiredAnswers.length === 0);
      }
    }
    const sessionBody = {
      title: `${planCode}-session`,
      instructor: '测试导师',
      location: '119验收',
      startAt: new Date(Date.now() + 60000).toISOString(),
      endAt: endsAt,
      checkinOpensAt: startsAt,
      checkinClosesAt: endsAt,
      memberIds: [accounts.learner.memberId, accounts.leave.memberId, accounts.absent.memberId]
    };
    await request('admin', '/proxy/enterprise/sessions', {
      method: 'POST',
      body: { ...sessionBody, memberIds: [accounts.excluded.memberId] },
      status: 403
    });
    const session = await enterprise('admin', '/sessions', { method: 'POST', body: sessionBody });
    const sessionId = await remember('session', session.id);
    await enterprise('admin', `/sessions/${sessionId}/status`, { method: 'POST', body: { action: 'PUBLISH' } });
    const issued = await enterprise('admin', `/sessions/${sessionId}/token`, { method: 'POST', body: { issue: true } });
    assert.ok(
      typeof issued.token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(issued.token),
      'Issued token shape invalid'
    );
    const tokenBody = { token: issued.token };
    const scans = await Promise.all([
      enterprise('learner', `/sessions/${sessionId}/checkin`, { method: 'POST', body: tokenBody }),
      enterprise('learner', `/sessions/${sessionId}/checkin`, { method: 'POST', body: tokenBody })
    ]);
    check(
      'self-checkin-concurrent-dedup',
      scans.filter((scan) => scan.duplicate).length === 1 &&
        scans.every((scan) => scan.attendance.memberId === accounts.learner.memberId)
    );
    await request('excluded', `/proxy/enterprise/sessions/${sessionId}/checkin`, {
      method: 'POST',
      body: tokenBody,
      status: 403
    });
    await request('uninvited', `/proxy/enterprise/sessions/${sessionId}/checkin`, {
      method: 'POST',
      body: tokenBody,
      status: 403
    });
    await request('learner', `/proxy/enterprise/sessions/${sessionId}/checkin`, {
      method: 'POST',
      body: { ...tokenBody, memberId: accounts.leave.memberId },
      status: 400
    });
    const correction = { memberId: accounts.leave.memberId, action: 'LEAVE', reason: '验收请假' };
    await request('learner', `/proxy/enterprise/sessions/${sessionId}/correction`, {
      method: 'POST',
      body: correction,
      status: 403
    });
    await enterprise('admin', `/sessions/${sessionId}/correction`, { method: 'POST', body: correction });
    await enterprise('admin', `/sessions/${sessionId}/token`, { method: 'POST', body: { issue: false } });
    await request('absent', `/proxy/enterprise/sessions/${sessionId}/checkin`, {
      method: 'POST',
      body: tokenBody,
      status: 409
    });
    await enterprise('admin', `/sessions/${sessionId}/status`, { method: 'POST', body: { action: 'CLOSE' } });
    const detail = await enterprise('admin', `/sessions/${sessionId}`);
    check(
      'session-attendance-summary',
      detail.summary.expected === 3 &&
        detail.summary.present === 1 &&
        detail.summary.leave === 1 &&
        detail.summary.absent === 1
    );
    check(
      'session-audit-retained',
      detail.audit.filter((entry) => entry.action === 'SELF_CHECKIN').length === 1 &&
        detail.audit.some((entry) => entry.action === 'CORRECT_LEAVE')
    );
    const sessionCsv = await enterprise('admin', `/sessions/${sessionId}/export`, { csv: true });
    check(
      'session-csv-leave-and-absent',
      sessionCsv.includes('LEAVE') && sessionCsv.includes('ABSENT') && sessionCsv.includes('验收请假')
    );
    const expiryDeadline = new Date(Date.now() + 5000).toISOString();
    const expiringSession = await enterprise('admin', '/sessions', {
      method: 'POST',
      body: {
        ...sessionBody,
        title: `${planCode}-expiry`,
        checkinClosesAt: expiryDeadline,
        memberIds: [accounts.absent.memberId]
      }
    });
    const expiringSessionId = await remember('session', expiringSession.id);
    await enterprise('admin', `/sessions/${expiringSessionId}/status`, { method: 'POST', body: { action: 'PUBLISH' } });
    const expiringToken = await enterprise('admin', `/sessions/${expiringSessionId}/token`, {
      method: 'POST',
      body: { issue: true }
    });
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, Date.parse(expiryDeadline) - Date.now()) + 100));
    await request('absent', `/proxy/enterprise/sessions/${expiringSessionId}/checkin`, {
      method: 'POST',
      body: { token: expiringToken.token },
      status: 409
    });
    const expiredAttendance = await enterprise('admin', `/sessions/${expiringSessionId}`);
    check('expired-checkin-without-write', expiredAttendance.summary.present === 0);
    let relationId = fixture.relationId;
    if (!relationId) {
      const relations = await enterprise('admin', '/mentorships/relations');
      const existing = relations.find(
        (row) => row.relation.learnerMemberId === accounts.learner.memberId && row.relation.status === 'ACTIVE'
      );
      if (existing) relationId = existing.relation.id;
      else {
        const relationEnd = new Date(Date.now() + 10 * 365 * 86400000).toISOString();
        const relationsCreated = await enterprise('admin', '/mentorships/relations/bulk', {
          method: 'POST',
          body: {
            learnerMemberIds: [accounts.learner.memberId],
            mentorMemberId: accounts.mentor.memberId,
            planId: null,
            startsAt,
            endsAt: relationEnd
          }
        });
        check('mentorship-one-relation', relationsCreated.length === 1);
        relationId = relationsCreated[0].id;
      }
      fixture.relationId = relationId;
      await saveFixture(fixture);
    }
    const tasks = await enterprise('admin', '/mentorships/tasks', {
      method: 'POST',
      body: {
        relationIds: [relationId],
        title: `${planCode}-practical`,
        objective: '演示作业步骤',
        scoringCriteria: '完整演示全部步骤',
        dueAt: endsAt,
        courseId: null,
        exerciseId: null,
        submissionType: 'TEXT',
        maxScore: 100,
        passScore: 60,
        requiresSupervisorReview: true,
        reviewerMemberId: accounts.supervisor.memberId,
        certifier: 'REVIEWER'
      }
    });
    check('mentorship-one-task', tasks.length === 1);
    const taskId = await remember('mentorship-task', tasks[0].id);
    const submissionBody = { expectedRevision: tasks[0].revision, content: '演示完成', confirmed: true };
    await request('mentor', `/proxy/enterprise/mentorships/tasks/${taskId}/submissions`, {
      method: 'POST',
      body: submissionBody,
      status: 403
    });
    await enterprise('learner', `/mentorships/tasks/${taskId}/submissions`, { method: 'POST', body: submissionBody });
    await request('learner', `/proxy/enterprise/mentorships/tasks/${taskId}/submissions`, {
      method: 'POST',
      body: submissionBody,
      status: 409
    });
    let mentorshipDetail = await enterprise('mentor', `/mentorships/tasks/${taskId}`);
    check('mentorship-one-submission', mentorshipDetail.history.submissions.length === 1);
    const submissionId = mentorshipDetail.history.submissions[0].id;
    await enterprise('mentor', `/mentorships/tasks/${taskId}/reviews`, {
      method: 'POST',
      body: {
        expectedRevision: mentorshipDetail.task.revision,
        submissionId,
        decision: 'PASS',
        score: 90,
        content: '导师观察并评分',
        observedAt: startsAt
      }
    });
    mentorshipDetail = await enterprise('supervisor', `/mentorships/tasks/${taskId}`);
    const reviewId = mentorshipDetail.history.reviews[0].id;
    const certificationBody = {
      expectedRevision: mentorshipDetail.task.revision,
      submissionId,
      reviewId,
      content: '主管认证'
    };
    await request('supervisor', `/proxy/enterprise/mentorships/tasks/${taskId}/certifications`, {
      method: 'POST',
      body: certificationBody,
      status: 400
    });
    const supervisorBody = { ...certificationBody, decision: 'PASS' };
    await request('parallel', `/proxy/enterprise/mentorships/tasks/${taskId}/supervisor-reviews`, {
      method: 'POST',
      body: supervisorBody,
      status: 403
    });
    await enterprise('supervisor', `/mentorships/tasks/${taskId}/supervisor-reviews`, {
      method: 'POST',
      body: supervisorBody
    });
    mentorshipDetail = await enterprise('supervisor', `/mentorships/tasks/${taskId}`);
    certificationBody.expectedRevision = mentorshipDetail.task.revision;
    await request('parallel', `/proxy/enterprise/mentorships/tasks/${taskId}/certifications`, {
      method: 'POST',
      body: certificationBody,
      status: 403
    });
    await enterprise('supervisor', `/mentorships/tasks/${taskId}/certifications`, {
      method: 'POST',
      body: certificationBody
    });
    await request('supervisor', `/proxy/enterprise/mentorships/tasks/${taskId}/certifications`, {
      method: 'POST',
      body: certificationBody,
      status: 409
    });
    mentorshipDetail = await enterprise('admin', `/mentorships/tasks/${taskId}`);
    check(
      'mentorship-certified-history-retained',
      mentorshipDetail.task.state === 'CERTIFIED' &&
        mentorshipDetail.history.submissions.length === 1 &&
        mentorshipDetail.history.reviews.length === 1 &&
        mentorshipDetail.history.supervisorReviews.length === 1 &&
        mentorshipDetail.history.certifications.length === 1
    );
    const mentorshipCsv = await enterprise('admin', '/mentorships/export', { csv: true });
    check(
      'mentorship-csv-certified',
      mentorshipCsv.includes(taskId) && mentorshipCsv.includes('CERTIFICATION') && mentorshipCsv.includes('CERTIFIED')
    );
    const audit =
      await sql`select action, resource_id from training_operation_audit where organization_id = ${fixture.organizationId}`;
    check(
      'audit-preserved',
      run.resources
        .filter((resource) => ['survey-task', 'session', 'mentorship-task'].includes(resource.kind))
        .every((resource) => audit.some((entry) => entry.resource_id === resource.id))
    );
    run.status = 'PASSED';
    run.completedAt = new Date().toISOString();
    await saveFixture(fixture);
    console.log(
      JSON.stringify({
        target: '10.60.2.119',
        origin,
        database: 'train_test119',
        runId,
        organizationId: fixture.organizationId,
        fixturePath,
        checks,
        status: 'PASSED'
      })
    );
  } catch (error) {
    if (fixture?.runs.at(-1)?.status === 'RUNNING') {
      fixture.runs.at(-1).status = 'FAILED';
      await saveFixture(fixture);
    }
    const assertion = error.code === 'ERR_ASSERTION' ? error.message : undefined;
    console.error(
      JSON.stringify({ status: 'FAILED', step, errorType: error.name, assertion, checksCompleted: checks.length })
    );
    process.exitCode = 1;
  } finally {
    const cleanupFailures = [];
    if (fixture) {
      for (const actor of cookies.keys()) {
        try {
          await request(actor, '/proxy/api/auth/sign-out', { method: 'POST', body: {} });
        } catch {
          cleanupFailures.push(actor);
        }
      }
    }
    cookies.clear();
    await sql?.end();
    await unlink(lockPath);
    if (cleanupFailures.length) {
      console.error(JSON.stringify({ status: 'SESSION_CLEANUP_FAILED', accounts: cleanupFailures }));
      process.exitCode = 1;
    }
  }
}

if (process.argv.includes('--self-check')) selfCheck();
else {
  await runAcceptance().catch((error) => {
    console.error(JSON.stringify({ status: 'FAILED', step: 'guard-or-cleanup', errorType: error.name }));
    process.exitCode = 1;
  });
}
