async function verifyEnterpriseNavigation(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  const origin = page.url().split('/').slice(0, 3).join('/');
  await page.goto(origin + '/admin', { waitUntil: 'domcontentloaded' });
  const brand = page.locator('.enterprise-brand:visible');
  await brand.waitFor();
  const sidebar = page.locator('.enterprise-sidebar:visible');
  await sidebar.locator('a[href$="/courses"]:not([href*="*"])').waitFor();
  const navigation = await sidebar.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  const courses = sidebar.locator('a[href$="/courses"]');
  const coursesPath = await courses.getAttribute('href');
  const sidebarWidth = (await sidebar.boundingBox()).width;
  await courses.click();
  await page.waitForURL((url) => url.pathname === coursesPath, { waitUntil: 'domcontentloaded' });
  await brand.waitFor();
  await sidebar.locator('a[href$="/courses"]:not([href*="*"])').waitFor();
  const courseNavigation = await sidebar
    .locator('a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  if (JSON.stringify(navigation) !== JSON.stringify(courseNavigation)) throw new Error('Course navigation changed');
  if ((await sidebar.boundingBox()).width !== sidebarWidth) throw new Error('Sidebar width changed');
  if ((await courses.getAttribute('aria-current')) !== 'page') throw new Error('Course navigation is not active');
  if (await sidebar.locator('a[href$="/widgets"]').count())
    throw new Error('External widgets exposed in primary navigation');
  await page.screenshot({ path: 'output/playwright/enterprise-course-navigation.png', fullPage: true });
  if (await sidebar.locator('a[href$="/cohorts"], a[href$="/media"], a[href$="/tags"]').count())
    throw new Error('Secondary tools remain in primary navigation');
  await page.getByRole('navigation', { name: '课程与资源' }).getByRole('link', { name: '媒体资源' }).click();
  await page.waitForURL((url) => url.pathname.endsWith('/media'), { waitUntil: 'domcontentloaded' });
  if ((await courses.getAttribute('aria-current')) !== 'page')
    throw new Error('Resource navigation lost course selection');
  await courses.click();
  await page.waitForURL((url) => url.pathname === coursesPath, { waitUntil: 'domcontentloaded' });
  await page.locator('a[href^="/courses/"]').first().click();
  await page.waitForURL((url) => url.pathname.startsWith('/courses/'), { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: '课程', exact: true }).click();
  await page.waitForURL((url) => url.pathname === coursesPath, { waitUntil: 'domcontentloaded' });
  await brand.waitFor();
  await sidebar.locator('a[href="/admin?view=employees"]').click();
  await page.getByRole('link', { name: '导入员工', exact: true }).click();
  await page.getByRole('heading', { name: '导入员工', exact: true }).waitFor();
  await page.getByRole('textbox').fill('training-check@example.com\ntraining-check@example.com\ninvalid-email');
  await page.getByRole('button', { name: '预览并检查', exact: true }).click();
  await page.getByText('可导入 1 人', { exact: true }).waitFor();
  await page.getByText('重复 1 人', { exact: true }).waitFor();
  await page.getByText('需处理 1 人', { exact: true }).waitFor();
  if (await page.getByText('培训班分配', { exact: true }).count())
    throw new Error('Legacy cohort assignment is visible');
  await page.screenshot({ path: 'output/playwright/enterprise-employee-import.png', fullPage: true });
  if (/Import Users|Course Access|Cohort Access|\bStatus\b|Select courses/.test(await page.locator('body').innerText()))
    throw new Error('Employee import is not localized');
  if ((await sidebar.locator('a[href="/admin?view=employees"]').getAttribute('aria-current')) !== 'page')
    throw new Error('Employee navigation lost selection');
  await page.getByRole('link', { name: '返回', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/admin' && url.searchParams.get('view') === 'employees', {
    waitUntil: 'domcontentloaded'
  });
  await page.goto(origin + coursesPath.replace(/\/courses$/, '/widgets'), { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '课程展示组件', exact: true }).waitFor();
  if (/Create Widget|No widgets yet|Publish branded/.test(await page.locator('body').innerText()))
    throw new Error('Untranslated widget page');
  await brand.waitFor();
  await page.goto(origin + coursesPath, { waitUntil: 'domcontentloaded' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('app-sidebar-trigger').click();
  await page.locator('.enterprise-brand:visible').waitFor();
  await page.getByRole('link', { name: '工作台', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/admin', { waitUntil: 'domcontentloaded' });
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflows) throw new Error('Mobile page overflows');
  if (errors.length) throw new Error(errors.join('\n'));
  return {
    consistentNavigation: true,
    activeCourse: true,
    courseReturn: true,
    employeeImportPreview: true,
    resourceNavigation: true,
    widgetsInChinese: true,
    mobileNavigation: true,
    pageErrors: errors.length
  };
}
