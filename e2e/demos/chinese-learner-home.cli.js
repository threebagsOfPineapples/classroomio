async function verifyLearnerHome(page) {
  await page.goto('http://localhost:4173/lms');
  await page.getByText('课程进度', { exact: true }).waitFor();
  const checks = [];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflows) throw new Error(`学员首页在 ${width}px 出现横向溢出`);
    checks.push({ width, overflows });
  }
  await page.getByRole('button', { name: /^全部/ }).click();
  const allCourses = await page.locator('.learner-course-tile').count();
  await page.getByRole('button', { name: /^已完成课程/ }).click();
  const completedCourses = await page.locator('.learner-course-tile').count();
  if (completedCourses > allCourses) throw new Error('完成课程数超过全部课程');
  const failures = await page.locator('.learner-course-tile').getByText('加载失败', { exact: true }).count();
  if (failures) throw new Error('失效课程封面没有使用占位图');
  return { checks, allCourses, completedCourses };
}
