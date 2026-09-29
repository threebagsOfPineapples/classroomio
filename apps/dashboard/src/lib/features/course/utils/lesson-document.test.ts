import { describe, expect, it } from 'vitest';
import { isPdfDocument } from '@cio/utils/functions/lesson-document';
import { isPdfPageEndVisible } from '../components/lesson/document/document-utils';

describe('PDF 阅读器文件识别', () => {
  it.each([
    ['pdf', '培训资料', true],
    ['application/pdf', '培训资料', true],
    ['application/pdf; charset=binary', '培训资料', true],
    ['application/octet-stream', '入职培训.PDF', true],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '培训.docx', false],
    ['not-pdf', '培训.txt', false]
  ])('%s / %s', (type, name, expected) => {
    expect(isPdfDocument({ type, name })).toBe(expected);
  });
});

describe('PDF 页末可见范围', () => {
  it.each([
    [900, { top: 100, bottom: 700 }, 800, false],
    [650, { top: 100, bottom: 700 }, 800, true],
    [50, { top: 100, bottom: 700 }, 800, false],
    [850, { top: 100, bottom: 1000 }, 800, false],
    [500, { top: 900, bottom: 1000 }, 800, false]
  ])('页末 %s / 容器 %o', (bottom, viewport, height, expected) => {
    expect(isPdfPageEndVisible(bottom, viewport, height)).toBe(expected);
  });
});
