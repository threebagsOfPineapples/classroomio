import { describe, expect, it } from 'vitest';
import { canRecordReadingActivity, getVisibleReadingBounds } from './reading-activity';

describe('有效阅读区域', () => {
  const viewport = { top: 0, bottom: 800, left: 0, right: 1200 };

  it('正文在屏幕内时可读，滚到评论区后不可计时', () => {
    expect(getVisibleReadingBounds({ top: 150, bottom: 650, left: 300, right: 1000 }, viewport)).not.toBeNull();
    expect(getVisibleReadingBounds({ top: -600, bottom: -20, left: 300, right: 1000 }, viewport)).toBeNull();
  });

  it('PDF 必须在阅读器的实际可见窗口内，不能仅靠画布在浏览器内', () => {
    const canvas = { top: 200, bottom: 600, left: 300, right: 1000 };
    const hiddenClip = { top: 100, bottom: 180, left: 250, right: 1100, horizontal: true, vertical: true };
    const visibleClip = { ...hiddenClip, bottom: 700 };
    expect(getVisibleReadingBounds(canvas, viewport, [hiddenClip])).toBeNull();
    expect(getVisibleReadingBounds(canvas, viewport, [visibleClip])).not.toBeNull();
  });

  it('不将页边的一小条或隐藏的空区域当作有效阅读', () => {
    expect(getVisibleReadingBounds({ top: -400, bottom: 1, left: 300, right: 1000 }, viewport)).toBeNull();
    expect(getVisibleReadingBounds({ top: 100, bottom: 100, left: 300, right: 1000 }, viewport)).toBeNull();
  });
});

describe('阅读活跃状态', () => {
  const reading = {
    visible: true,
    focused: true,
    editing: false,
    hasReadingSurface: true,
    lastInteraction: 1000,
    now: 6000
  };

  it('仅在可见的阅读区域且近期操作时累计', () => {
    expect(canRecordReadingActivity(reading)).toBe(true);
    expect(canRecordReadingActivity({ ...reading, hasReadingSurface: false })).toBe(false);
    expect(canRecordReadingActivity({ ...reading, now: 61000 })).toBe(false);
  });

  it('评论输入、切换后台和窗口失焦都暂停', () => {
    expect(canRecordReadingActivity({ ...reading, editing: true })).toBe(false);
    expect(canRecordReadingActivity({ ...reading, visible: false })).toBe(false);
    expect(canRecordReadingActivity({ ...reading, focused: false })).toBe(false);
    expect(canRecordReadingActivity({ ...reading, lastInteraction: 0 })).toBe(false);
  });
});
