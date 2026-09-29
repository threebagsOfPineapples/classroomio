async function verifyDialogOutsideClick(page) {
  const courseList = new URL(page.url());
  courseList.search = '';
  await page.goto(courseList.href);
  await page.getByRole('button', { name: '创建课程', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '下一步', exact: true }).click();
  const name = dialog.getByRole('textbox', { name: '课程名称', exact: true });
  const draft = '弹窗保留验证（不保存）';
  await name.fill(draft);
  await page.mouse.click(10, 10);
  await page.waitForTimeout(350);
  if (!(await dialog.isVisible()) || (await name.inputValue()) !== draft) {
    throw new Error('点击空白关闭了弹窗或丢失了输入');
  }

  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  return { outsideClickIgnored: true, draftPreserved: true, explicitCloseWorks: true };
}
