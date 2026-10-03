/** Checks a previewable lesson with a following lesson, using temporary PDF responses without saving data. */
async function verifyPdfReaderRegression(page, lessonPath) {
  const lessonUrl = new URL(lessonPath, page.url());
  lessonUrl.searchParams.set('preview', 'true');
  const lessonId = lessonUrl.pathname.split('/').at(-1);
  const lessonPattern = '**' + lessonUrl.pathname + '/__data.json*';
  const resourceUrl = lessonUrl.origin + '/pdf-reader-regression.pdf';
  const fixtureName = 'pdf-reader-regression.pdf';
  const originalViewport = page.viewportSize();
  const pdfObjects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 1800] /Resources << >> /Contents 5 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 1800] /Resources << >> /Contents 5 0 R >>',
    '<< /Length 0 >>\nstream\nendstream'
  ];
  let pdfSource = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of pdfObjects.entries()) {
    offsets.push(pdfSource.length);
    pdfSource += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = pdfSource.length;
  pdfSource += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdfSource += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdfSource += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const mutations = [];
  const collectMutation = (request) => {
    if (
      /\/(?:course|enterprise)\//.test(request.url()) &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())
    ) {
      mutations.push(request.url());
    }
  };
  const supplyLesson = async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    let injected = false;
    for (const node of body.nodes ?? []) {
      if (!Array.isArray(node?.data)) continue;

      const lesson = node.data.find(
        (value) => value && typeof value === 'object' && 'documents' in value && node.data[value.id] === lessonId
      );
      if (!lesson) continue;

      const attachment = {
        key: fixtureName,
        name: fixtureName,
        type: 'application/pdf',
        size: pdfSource.length,
        link: resourceUrl
      };
      const attachmentReferences = {};
      for (const [key, value] of Object.entries(attachment)) {
        attachmentReferences[key] = node.data.length;
        node.data.push(value);
      }
      const attachmentIndex = node.data.length;
      node.data.push(attachmentReferences);
      node.data[lesson.documents] = [attachmentIndex];
      injected = true;
    }
    if (!injected) throw new Error('Expected the requested lesson in the server load response');

    await route.fulfill({ response, json: body });
  };
  const supplyPdf = (route) => route.fulfill({ contentType: 'application/pdf', body: pdfSource });
  page.on('request', collectMutation);
  await page.route(lessonPattern, supplyLesson);
  await page.route(resourceUrl, supplyPdf);

  try {
    await page.setViewportSize({ width: 1440, height: 960 });
    const contentsUrl = new URL(lessonUrl.href);
    contentsUrl.pathname = lessonUrl.pathname.slice(0, lessonUrl.pathname.lastIndexOf('/'));
    await page.goto(contentsUrl.href);
    await page.locator(`a[href="${lessonUrl.pathname}"]`).first().click();
    await page.getByText(fixtureName, { exact: true }).waitFor();
    await page.evaluate(() => {
      window.pdfReaderEvidence = [];
      window.addEventListener('lesson-reading-resource', (event) => window.pdfReaderEvidence.push(event.detail));
    });
    const attachment = page.getByText(fixtureName, { exact: true }).locator('../..');
    await attachment.getByRole('button').first().click();
    const viewer = page.getByTestId('lesson-pdf-viewer');
    const viewport = page.getByTestId('lesson-pdf-viewport');
    await viewer.locator('canvas').waitFor();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(350);
    if (new URL(page.url()).pathname !== lessonUrl.pathname) throw new Error('PDF page navigation changed the lesson');

    await page.keyboard.press('Escape');
    await viewer.waitFor({ state: 'detached' });
    await attachment.getByRole('button').first().click();
    await viewer.locator('canvas').waitFor();
    await page.bringToFront();
    await page.waitForFunction(() => document.hasFocus());
    for (const pageNumber of [1, 2]) {
      await page.waitForTimeout(350);
      await viewport.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
        element.dispatchEvent(new Event('scroll'));
      });
      if (pageNumber === 1) {
        await page.keyboard.press('ArrowRight');
        await viewport.evaluate((element) => {
          element.scrollTop = 0;
        });
      }
    }
    await page.waitForFunction(() =>
      window.pdfReaderEvidence.some((event) => event.resource === 'pdf:pdf-reader-regression.pdf')
    );
    await page.setViewportSize({ width: 390, height: 844 });
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
    if (overflows) throw new Error('PDF reader overflows the mobile viewport');
    if (mutations.length) throw new Error('Preview wrote learning data: ' + mutations.join(', '));

    return {
      keyboardStaysInLesson: true,
      readingAfterEscapeAndReopen: true,
      mobileViewportFits: true,
      previewMutations: 0
    };
  } finally {
    await page.unroute(lessonPattern, supplyLesson);
    await page.unroute(resourceUrl, supplyPdf);
    page.off('request', collectMutation);
    if (originalViewport) await page.setViewportSize(originalViewport);
    await page.goto(lessonUrl.href);
  }
}
