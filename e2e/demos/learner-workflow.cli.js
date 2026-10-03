async function verifyLearnerWorkflow(page) {
  const base = new URL(page.url()).origin;
  const originalViewport = page.viewportSize();
  const courseId = '60000000-0000-4000-8000-000000000001';
  const enrollmentId = '60000000-0000-4000-8000-000000000002';
  const now = Date.now();
  const timestamp = (hours) => new Date(now + hours * 3_600_000).toISOString();
  const sampleSubmission = (status_id) => ({ status_id, updated_at: timestamp(-0.2), total: 8, groupmember: [] });
  const task = (id, title, overrides = {}) => ({
    id,
    title,
    updated_at: timestamp(-2),
    isExam: true,
    opensAt: timestamp(-1),
    closesAt: timestamp(1),
    dueBy: null,
    durationMinutes: 30,
    maxAttempts: 1,
    allowMakeup: false,
    attemptCount: 0,
    activeAttemptExpiresAt: null,
    canAttempt: true,
    questions: [{ points: 10 }],
    submission: [],
    lesson: {
      id: 'lesson',
      title: '验收课时',
      order: 1,
      course: { id: courseId, title: '验收培训课程', group: [], groupmember: [] }
    },
    ...overrides
  });
  const tasks = [
    task('open', '验收开放考试'),
    task('active', '验收作答中考试', { activeAttemptExpiresAt: timestamp(0.5) }),
    task('future', '验收未开放考试', { opensAt: timestamp(2), closesAt: timestamp(3), canAttempt: false }),
    task('ended', '验收已截止考试', { opensAt: timestamp(-3), closesAt: timestamp(-2), canAttempt: false }),
    task('submitted', '验收待评分考试', { submission: [sampleSubmission(2)], canAttempt: false }),
    task('graded', '验收已评分考试', { submission: [sampleSubmission(3)], canAttempt: false }),
    task('unknown', '验收资格查询失败'),
    task('denied', '验收无权限任务'),
    task('assignment', '验收普通作业', {
      isExam: false,
      opensAt: null,
      closesAt: null,
      dueBy: timestamp(4),
      canAttempt: false
    })
  ];
  const course = {
    id: courseId,
    title: '验收培训课程',
    description: '',
    type: 'SELF_PACED',
    lessonCount: 5,
    progressRate: 2,
    exerciseCount: 0,
    exercisesCompleted: 0,
    required: true,
    certificateEarnedAt: null
  };
  const assignment = {
    id: 'plan',
    enrollmentId,
    name: '验收培训计划',
    code: 'QA-LEARNER',
    planStatus: 'PUBLISHED',
    enrollmentStatus: 'IN_PROGRESS',
    startAt: timestamp(-24),
    endAt: timestamp(48),
    description: '',
    finalScore: null,
    result: 'PENDING',
    courses: [{ id: courseId, title: course.title, required: true, dueAt: timestamp(48) }],
    exams: tasks.filter((item) => item.isExam).map((item) => ({ ...item, courseId }))
  };
  let failTasks = true;
  let failCourses = false;
  let allowUnknown = false;
  const blockedWrites = [];
  const routePattern = /\/(organization|course|enterprise)\//;
  const success = (route, data) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  const failure = (route, status = 500) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Temporary fixture failure' })
    });
  const intercept = async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!['GET', 'HEAD'].includes(request.method())) {
      blockedWrites.push({ method: request.method(), path });
      return failure(route, 409);
    }
    if (/\/organization\/[^/]+\/exercises\/lms$/.test(path)) return failTasks ? failure(route) : success(route, tasks);
    if (/\/course\/[^/]+\/exercise\/[^/]+$/.test(path)) {
      const id = path.split('/').at(-1);
      if (id === 'denied') return failure(route, 403);
      if (id === 'unknown' && !allowUnknown) return failure(route);

      return success(route, {});
    }
    if (path.endsWith('/organization/courses/enrolled')) return failCourses ? failure(route) : success(route, [course]);
    if (path.endsWith('/enterprise/my-training')) return success(route, [assignment]);
    if (path.endsWith(`/enterprise/enrollments/${enrollmentId}/assessment`)) {
      return success(route, {
        plan: assignment,
        enrollment: { id: enrollmentId, status: 'IN_PROGRESS', progressPercent: 40 },
        scheme: null,
        score: null,
        evaluation: null
      });
    }
    return route.continue();
  };
  const row = (title) => page.locator('li').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  await page.route(routePattern, intercept);

  try {
    await page.goto(`${base}/lms/exercises`);
    await page.getByText('考核任务加载失败，请重试。', { exact: true }).waitFor();
    failTasks = false;
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await row('验收开放考试').getByRole('link', { name: '开始作答', exact: true }).waitFor();
    await row('验收作答中考试').getByRole('link', { name: '继续作答', exact: true }).waitFor();
    await row('验收无权限任务').getByText('当前无法进入此项考核', { exact: true }).waitFor();
    check(
      (await row('验收无权限任务').getByRole('link', { name: '开始作答', exact: true }).count()) === 0,
      'Denied tasks must not offer Start'
    );
    allowUnknown = true;
    await row('验收资格查询失败').getByRole('button', { name: '重试', exact: true }).click();
    await row('验收资格查询失败').getByRole('link', { name: '开始作答', exact: true }).waitFor();
    await page.getByRole('button', { name: /^全部/ }).click();
    await row('验收未开放考试').getByText('尚未开放', { exact: true }).waitFor();
    await row('验收已截止考试').getByText('已截止', { exact: true }).waitFor();
    await row('验收待评分考试').getByRole('link', { name: '查看提交', exact: true }).waitFor();
    check(
      (await row('验收待评分考试').getByRole('link', { name: '继续作答', exact: true }).count()) === 0,
      'Written-answer submissions must not offer Continue'
    );
    await row('验收已评分考试').getByText('成绩: 8 / 10', { exact: true }).waitFor();
    await row('验收普通作业').getByRole('link', { name: '开始作答', exact: true }).waitFor();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const overflows = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
      check(!overflows, `Assessment tasks overflow at ${width}px`);
    }

    await page.goto(`${base}/lms/training`);
    await page.getByRole('heading', { name: '验收培训计划', exact: true }).waitFor();
    await page.locator('summary').filter({ hasText: '验收培训计划' }).click();
    await page.getByRole('heading', { name: '培训课程', exact: true }).waitFor();
    const courseAction = page.locator(`a[href^="/courses/${courseId}/"]`).filter({ hasText: '继续学习' });
    check((await courseAction.count()) > 0, 'Training plan must link to continuing the enrolled course');
    await page.locator(`a[href="/lms/training/${enrollmentId}"]`).click();
    await page.getByRole('heading', { name: '培训课程', exact: true }).waitFor();
    await row('验收开放考试').getByRole('link', { name: '开始作答', exact: true }).waitFor();
    check(
      (await page.locator(`a[href^="/courses/${courseId}/"]`).filter({ hasText: '继续学习' }).count()) > 0,
      'Training details must retain the course entry'
    );

    failCourses = true;
    await page.goto(`${base}/lms/certificates`);
    await page.getByText('证书加载失败，请重试。', { exact: true }).waitFor();
    failCourses = false;
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await page.getByText('证书加载失败，请重试。', { exact: true }).waitFor({ state: 'hidden' });
    check(blockedWrites.length === 0, 'Read-only learner checks attempted a business write');
    return {
      assessmentStates: 9,
      taskFailureRetry: true,
      accessFailureRetry: true,
      deniedStartHidden: true,
      viewportWidths: [1440, 390],
      trainingCourseAndExamLinks: true,
      certificatesFailureRetry: true,
      businessWrites: 0
    };
  } finally {
    await page.unroute(routePattern, intercept);
    if (originalViewport) await page.setViewportSize(originalViewport);
    await page.goto(`${base}/lms`);
  }
}
