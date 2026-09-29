async function verifyTrainingPlanFlow(page) {
  const origin = page.url().split('/').slice(0, 3).join('/');
  const errors = [];
  const mutations = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/enterprise/') && request.method() !== 'GET') mutations.push(request.url());
  });
  await page.goto(origin + '/admin/matrix', { waitUntil: 'domcontentloaded' });
  await page.getByText('筛选培训计划', { exact: true }).waitFor();
  await page.getByRole('button', { name: '全部计划', exact: true }).waitFor();
  const search = page.getByRole('textbox', { name: '搜索员工' });
  const employeeName = await page.locator('tbody tr th').first().innerText();
  await search.fill('不存在员工验收');
  const exportButton = page.getByRole('button', { name: '导出当前筛选（Excel）' });
  if (!(await exportButton.isDisabled())) throw new Error('Empty export enabled');
  await search.fill(employeeName);
  const exportEvent = page.waitForEvent('download');
  await exportButton.click();
  const exportFile = await exportEvent;
  await exportFile.saveAs('output/playwright/training-flow-filtered.xlsx');

  await page.goto(origin + '/admin/plans', { waitUntil: 'domcontentloaded' });
  await page.getByRole('navigation', { name: '培训计划', exact: true }).getByRole('button').first().click();
  const assessmentLink = page.getByRole('link', { name: '配置本次培训的考核方案' });
  await assessmentLink.waitFor();
  const planId = (await assessmentLink.getAttribute('href')).split('planId=')[1];
  await assessmentLink.click();
  await page.getByRole('heading', { name: '课程内考试与作业' }).waitFor();
  await page.getByRole('link', { name: '返回培训计划' }).click();
  await page.getByRole('button', { name: '复制为新草稿' }).click();
  if ((await page.getByRole('textbox', { name: '名称', exact: true }).inputValue()) !== '') {
    throw new Error('Copied draft retains the original name');
  }
  if ((await page.getByRole('textbox', { name: '编码', exact: true }).inputValue()) !== '') {
    throw new Error('Copied draft retains the original code');
  }
  if (!(await page.getByRole('group', { name: '课程', exact: true }).locator('[aria-checked=true]').count())) {
    throw new Error('Copied draft lost its courses');
  }

  const detailPattern = '**/enterprise/plans/' + planId;
  await page.route(detailPattern, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.plan.status = 'DRAFT';
    await route.fulfill({ response, json: body });
  });
  await page.goto(origin + '/admin/plans?planId=' + planId, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '预览培训对象', exact: true }).click();
  await page.getByRole('heading', { name: '培训对象名单预览' }).waitFor();
  await page.getByRole('button', { name: '发布并分配', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('heading', { name: '确认发布培训' }).waitFor();
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await page.unroute(detailPattern);
  if (errors.length || mutations.length) throw new Error(JSON.stringify({ errors, mutations }));
  return {
    filteredDownload: true,
    copyDraft: true,
    assessmentNavigation: true,
    mockedPublishConfirmation: true,
    mutations: 0,
    pageErrors: 0
  };
}
