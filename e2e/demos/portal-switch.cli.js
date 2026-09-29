async function verifyPortalSwitch(page) {
  const origin = new URL(page.url()).origin;
  await page.goto(`${origin}/admin`);
  await page.getByTestId('switch-to-learning').click();
  await page.waitForURL('**/lms');
  await page.getByTestId('switch-to-management').waitFor();
  await page.reload();
  await page.getByTestId('switch-to-management').waitFor();

  if ((await page.evaluate(() => sessionStorage.getItem('training-portal'))) !== 'learner') {
    throw new Error('学习端状态未保留');
  }

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
      throw new Error(`学习端在 ${width}px 出现横向溢出`);
    }
  }

  await page.getByTestId('switch-to-management').click();
  await page.waitForURL('**/admin');
  await page.getByTestId('switch-to-learning').waitFor();
  if ((await page.evaluate(() => sessionStorage.getItem('training-portal'))) !== 'management') {
    throw new Error('返回管理端后状态未重置');
  }

  return { switchedBothWays: true, refresh: true, widths: [1440, 390] };
}
