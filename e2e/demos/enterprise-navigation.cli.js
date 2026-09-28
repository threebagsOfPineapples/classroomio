async function verifyEnterpriseNavigation(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  const origin = page.url().split('/').slice(0, 3).join('/');
  await page.goto(origin + '/admin');
  const brand = page.locator('.enterprise-brand:visible');
  await brand.waitFor();
  const sidebar = page.locator('.enterprise-sidebar:visible');
  await sidebar.locator('a[href$="/tags"]').waitFor();
  const navigation = await sidebar.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  const courses = sidebar.locator('a[href$="/courses"]');
  const coursesPath = await courses.getAttribute('href');
  const sidebarWidth = (await sidebar.boundingBox()).width;
  await courses.click();
  await page.waitForURL((url) => url.pathname === coursesPath);
  await brand.waitFor();
  await sidebar.locator('a[href$="/tags"]').waitFor();
  const courseNavigation = await sidebar
    .locator('a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  if (JSON.stringify(navigation) !== JSON.stringify(courseNavigation)) throw new Error('Course navigation changed');
  if ((await sidebar.boundingBox()).width !== sidebarWidth) throw new Error('Sidebar width changed');
  if ((await courses.getAttribute('aria-current')) !== 'page') throw new Error('Course navigation is not active');
  if (await sidebar.locator('a[href$="/widgets"]').count())
    throw new Error('External widgets exposed in primary navigation');
  await page.screenshot({ path: 'output/playwright/enterprise-course-navigation.png', fullPage: true });
  await page.locator('a[href^="/courses/"]').first().click();
  await page.waitForURL((url) => url.pathname.startsWith('/courses/'));
  await page.getByRole('link', { name: '课程', exact: true }).click();
  await page.waitForURL((url) => url.pathname === coursesPath);
  await brand.waitFor();
  await page.goto(origin + coursesPath.replace(/\/courses$/, '/widgets'));
  await page.getByRole('heading', { name: '课程展示组件', exact: true }).waitFor();
  if (/Create Widget|No widgets yet|Publish branded/.test(await page.locator('body').innerText()))
    throw new Error('Untranslated widget page');
  await brand.waitFor();
  await page.goto(origin + coursesPath);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('app-sidebar-trigger').click();
  await page.locator('.enterprise-brand:visible').waitFor();
  await page.getByRole('link', { name: '工作台', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/admin');
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflows) throw new Error('Mobile page overflows');
  if (errors.length) throw new Error(errors.join('\n'));
  return {
    consistentNavigation: true,
    activeCourse: true,
    courseReturn: true,
    widgetsInChinese: true,
    mobileNavigation: true,
    pageErrors: errors.length
  };
}
