import { describe, expect, it } from 'vitest';
import { isScrollToTopVisible } from './scroll-to-top';

describe('scroll to top visibility', () => {
  it('requires overflow, shows after a viewport, and hides below 0.8 viewports', () => {
    expect(isScrollToTopVisible(1000, 1000, 1000, false)).toBe(false);
    expect(isScrollToTopVisible(999, 1000, 3000, false)).toBe(false);
    expect(isScrollToTopVisible(1000, 1000, 3000, false)).toBe(true);
    expect(isScrollToTopVisible(850, 1000, 3000, true)).toBe(true);
    expect(isScrollToTopVisible(799, 1000, 3000, true)).toBe(false);
  });
});
