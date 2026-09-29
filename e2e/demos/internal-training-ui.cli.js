async function verifyInternalTrainingUi(page, mode = 'admin') {
  const base = new URL(page.url()).origin;
  const courseId = '96a50285-b974-450c-9bbe-6a973020cf91';
  const orgPath = '/org/zhizhen-training';
  const paths =
    mode === 'admin'
      ? [
          '/admin',
          '/admin?view=departments',
          '/admin?view=employees',
          '/admin/plans',
          '/admin/assessment',
          '/admin/matrix',
          '/admin/statistics',
          `${orgPath}/courses`,
          `${orgPath}/media`,
          `${orgPath}/tags`,
          `${orgPath}/settings/org`,
          `/courses/${courseId}/lessons`,
          `/courses/${courseId}/settings`
        ]
      : ['/lms', '/lms/training', '/lms/explore', '/lms/exercises', '/lms/training/archive', '/lms/certificates'];
  const results = [];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    for (const path of paths) {
      await page.goto(base + path);
      await page.locator('[data-interface-language]').first().waitFor({ state: 'visible', timeout: 20000 });
      await page.waitForTimeout(250);
      const state = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
        languages: document.querySelectorAll('[data-interface-language]').length,
        heading: document.querySelector('h1')?.textContent?.trim() ?? '',
        english: /(?:^|\n)(?:Widgets|Create Widget|Self-paced|Curriculum|Your instructor|Free)(?:\n|$)/i.test(
          document.body.innerText
        )
      }));
      results.push({ path, width, ...state });
      if (state.overflow || state.languages !== 1 || state.english) throw new Error(JSON.stringify(results));
    }
  }
  return results;
}

async function verifyCoursePreview(page) {
  const base = new URL(page.url()).origin;
  const coursePath = '/courses/96a50285-b974-450c-9bbe-6a973020cf91';
  const writes = [];
  const track = (request) => {
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method()) &&
      /\/(?:course|enterprise)\//.test(request.url())
    ) {
      writes.push({ method: request.method(), path: new URL(request.url()).pathname });
    }
  };
  page.on('request', track);
  try {
    await page.goto(`${base}${coursePath}/settings?preview=true`);
    await page.waitForURL(`**${coursePath}/lessons?preview=true`);
    await page.getByText('仅查看课程内容，不记录学习进度、时长、考核提交或证书。', { exact: true }).waitFor();
    await page.goto(`${base}${coursePath}/lessons/407c6e85-57a0-4bdd-82bf-715e73e2308d`);
    await page.getByText('仅查看课程内容，不记录学习进度、时长、考核提交或证书。', { exact: true }).waitFor();
    await page.waitForTimeout(65000);
    if (writes.length) throw new Error(JSON.stringify(writes));
    await page.getByRole('button', { name: '返回课程管理', exact: true }).click();
    await page
      .getByText('仅查看课程内容，不记录学习进度、时长、考核提交或证书。', { exact: true })
      .waitFor({ state: 'hidden' });
    return { redirectedSettings: true, previewSurvivedReload: true, writes, explicitExit: true };
  } finally {
    page.off('request', track);
  }
}
