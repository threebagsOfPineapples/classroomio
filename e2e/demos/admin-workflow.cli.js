async function verifyAdminWorkflow(page) {
  const base = new URL(page.url()).origin;
  const planIds = [
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003'
  ];
  const courseId = '20000000-0000-4000-8000-000000000001';
  const itemId = '30000000-0000-4000-8000-000000000001';
  const departmentId = '40000000-0000-4000-8000-000000000001';
  const enrollmentIds = { 11: '50000000-0000-4000-8000-000000000011', 12: '50000000-0000-4000-8000-000000000012' };
  const employees = [11, 12].map((memberId) => ({
    fullname: memberId === 11 ? '验收员工甲' : '验收员工乙',
    email: `fixture${memberId}@example.test`,
    member: {
      id: memberId,
      email: `fixture${memberId}@example.test`,
      employeeNo: `Z${memberId}`,
      departmentId,
      position: '运营',
      status: 'ACTIVE',
      employmentStatus: 'ACTIVE',
      managerMemberId: null,
      joinDate: null
    }
  }));
  const plans = planIds.map((id, index) => ({
    id,
    name: `验收计划${index + 1}`,
    code: `QA${index + 1}`,
    year: 2026,
    planType: 'CUSTOM',
    status: index === 2 ? 'DRAFT' : 'PUBLISHED',
    ownerMemberId: 11,
    startAt: '2026-10-01T00:00:00.000Z',
    endAt: '2026-12-31T23:59:59.000Z',
    description: '',
    departmentId: null,
    passScore: 80
  }));
  const schemes = Object.fromEntries(
    planIds.map((id, index) => [
      id,
      {
        id: `scheme-${index}`,
        planId: id,
        name: '验收考核',
        description: '',
        passScore: 80,
        status: index === 0 ? 'DRAFT' : 'PUBLISHED',
        items: [
          {
            id: itemId,
            type: 'INSTRUCTOR',
            name: '实操评分',
            weight: 100,
            maxScore: 100,
            required: true,
            exerciseId: null
          }
        ]
      }
    ])
  );
  const writes = [];
  const scores = {};
  let activePlanId = planIds[0];
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const respond = (route, data) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  const intercept = async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.split('/enterprise')[1];
    if (!['GET', 'HEAD'].includes(request.method())) {
      const body = request.postDataJSON();
      writes.push({ method: request.method(), path, body });
      const assessment = path.match(/^\/plans\/([^/]+)\/assessment$/);
      if (assessment && request.method() === 'PUT') {
        schemes[assessment[1]] = {
          ...schemes[assessment[1]],
          ...body,
          items: body.items.map((item) => ({ ...item, id: itemId }))
        };
        return respond(route, schemes[assessment[1]]);
      }
      const publication = path.match(/^\/plans\/([^/]+)\/assessment\/publish$/);
      if (publication) {
        schemes[publication[1]].status = 'PUBLISHED';
        return respond(route, schemes[publication[1]]);
      }
      const scoreInput = path.match(/^\/enrollments\/([^/]+)\/items\/([^/]+)\/input$/);
      if (scoreInput) {
        scores[scoreInput[1]] = body.score;
        return respond(route, {});
      }
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: '验收脚本已阻断此写入' })
      });
    }

    if (path === '/overview')
      return respond(route, {
        memberId: 11,
        roles: ['SUPER_ADMIN'],
        canManage: true,
        isSuperAdmin: true,
        departments: [
          {
            id: departmentId,
            name: '运营部',
            code: 'OPS',
            status: 'ACTIVE',
            parentId: null,
            leaderMemberId: 11,
            sort: 0
          }
        ]
      });
    if (path === '/employees') return respond(route, employees);
    const employee = path.match(/^\/employees\/(\d+)$/);
    if (employee)
      return respond(route, {
        ...employees.find((item) => item.member.id === Number(employee[1])),
        roles: ['EMPLOYEE']
      });
    if (path === '/plans') return respond(route, plans);
    if (path === '/training-courses') return respond(route, [{ id: courseId, title: '验收课程' }]);
    const planDetail = path.match(/^\/plans\/([^/]+)$/);
    if (planDetail)
      return respond(route, {
        plan: plans.find((plan) => plan.id === planDetail[1]),
        courses: [{ courseId }],
        targets: [{ targetType: 'USER', memberId: 11 }],
        enrollmentCount: 2,
        enrolledMemberIds: [11, 12],
        reminders: []
      });
    const assessment = path.match(/^\/plans\/([^/]+)\/assessment$/);
    if (assessment) {
      activePlanId = assessment[1];
      return respond(route, schemes[assessment[1]]);
    }
    if (/^\/plans\/[^/]+\/exercises$/.test(path)) return respond(route, []);
    if (/^\/plans\/[^/]+\/statistics$/.test(path)) return respond(route, null);
    if (path === '/archive')
      return respond(
        route,
        employees.map((employee) => ({
          enrollmentId: enrollmentIds[employee.member.id],
          memberId: employee.member.id,
          memberEmail: employee.email,
          planId: activePlanId,
          status: 'IN_PROGRESS',
          finalScore: null
        }))
      );
    const enrollment = path.match(/^\/enrollments\/([^/]+)\/assessment$/);
    if (enrollment) {
      const memberId = Number(Object.entries(enrollmentIds).find(([, id]) => id === enrollment[1])[0]);
      return respond(route, {
        enrollment: { id: enrollment[1], memberId },
        plan: plans.find((plan) => plan.id === activePlanId),
        scheme: schemes[activePlanId],
        score: { finalScore: scores[enrollment[1]] ?? null, details: [], adjustments: [], result: 'PENDING' }
      });
    }
    return respond(route, []);
  };

  await page.route('**/enterprise/**', intercept);
  try {
    await page.goto(`${base}/admin/assessment?planId=${planIds[0]}`);
    await page.getByTestId('assessment-pass-score').waitFor();
    check(await page.getByTestId('assessment-publish').isEnabled(), 'Saved scheme should be publishable');
    await page.getByTestId('assessment-pass-score').fill('90');
    check(await page.getByTestId('assessment-publish').isDisabled(), 'Unsaved assessment must not be publishable');
    check(writes.length === 0, 'Editing the scheme must not write before Save');
    await page.getByTestId('page-settings-discard').click();
    check(
      (await page.getByTestId('assessment-pass-score').inputValue()) === '80',
      'Discard must restore the saved scheme'
    );
    await page.getByTestId('assessment-pass-score').fill('90');
    await page.getByTestId('page-settings-save').click();
    await page.getByTestId('page-settings-save').waitFor({ state: 'hidden' });
    await page.getByTestId('assessment-publish').click();
    await page.getByTestId('assessment-publish').waitFor({ state: 'hidden' });
    check(schemes[planIds[0]].passScore === 90, 'Publication must use the newly saved assessment');

    await page.getByTestId('assessment-tab-grading').click();
    await page.getByTestId('assessment-employee-11').click();
    const score = page.getByTestId(`assessment-score-${itemId}`);
    await score.fill('91');
    await page.getByTestId('assessment-adjustment').fill('3');
    await page.getByTestId('assessment-adjustment-reason').fill('甲员工调整说明');
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByTestId('assessment-employee-12').click();
    check((await score.inputValue()) === '91', 'Cancel switching must preserve the current employee draft');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('assessment-employee-12').click();
    await score.waitFor();
    check((await score.inputValue()) === '', 'New employee must not inherit a score');
    check(
      (await page.getByTestId('assessment-adjustment').inputValue()) === '0',
      'New employee must not inherit an adjustment'
    );
    check(
      (await page.getByTestId('assessment-adjustment-reason').inputValue()) === '',
      'New employee must not inherit an adjustment reason'
    );
    await score.fill('77');
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes(`/enrollments/${enrollmentIds[12]}/items/${itemId}/input`)
      ),
      page.getByTestId(`assessment-save-score-${itemId}`).click()
    ]);
    await page.waitForFunction(
      (id) => document.querySelector(`[data-testid="assessment-score-${id}"]`)?.value === '',
      itemId
    );
    check(
      writes.some(
        (write) => write.path === `/enrollments/${enrollmentIds[12]}/items/${itemId}/input` && write.body.score === 77
      ),
      'The new score must target only employee B'
    );

    await page.goto(`${base}/admin/plans?planId=${planIds[2]}`);
    await page.waitForFunction(
      () => document.querySelector('[data-testid="training-plan-name"]')?.value === '验收计划3'
    );
    await page.waitForFunction(
      () => document.querySelector('[data-testid="plan-step-assessment-status"]')?.textContent === '已发布'
    );
    check(
      (await page.getByTestId('plan-step-basics-status').locator('..').getAttribute('data-state')) === 'complete',
      'Saved plan basics must be marked complete'
    );
    check(
      (await page.getByTestId('plan-step-targets-status').locator('..').getAttribute('data-state')) === 'complete',
      'Saved courses and targets must be marked complete'
    );
    check(
      (await page.getByTestId('plan-step-publish-status').locator('..').getAttribute('aria-current')) === 'step',
      'An unpublished plan with a prepared assessment must point to publication'
    );
    await page.getByTestId('training-plan-name').fill('未保存计划名称');
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="plan-step-basics-status"]')
          ?.parentElement?.getAttribute('aria-current') === 'step'
    );
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByTestId('training-plan-new').click();
    check(
      (await page.getByTestId('training-plan-name').inputValue()) === '未保存计划名称',
      'Cancel New must preserve the plan draft'
    );
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('training-plan-new').click();
    check(
      (await page.getByTestId('training-plan-name').inputValue()) === '',
      'Confirm New must clear the previous plan draft'
    );

    await page.goto(`${base}/admin?view=employees`);
    await page.getByTestId('employee-11').click();
    await page.getByTestId('employee-number').fill('未保存工号');
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByTestId('employee-12').click();
    check(
      (await page.getByTestId('employee-number').inputValue()) === '未保存工号',
      'Cancel employee switch must preserve personnel edits'
    );
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('employee-12').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="employee-number"]')?.value === 'Z12');
    return {
      stalePublicationBlocked: true,
      scoreDraftIsolation: true,
      planDiscardGuard: true,
      employeeDiscardGuard: true,
      planPreparationStates: true,
      interceptedWrites: writes,
      realBusinessWrites: 0
    };
  } finally {
    const acceptDialog = (dialog) => dialog.accept();
    page.on('dialog', acceptDialog);
    await page.unroute('**/enterprise/**', intercept);
    await page.goto(`${base}/admin?view=employees`);
    page.off('dialog', acceptDialog);
  }
}
