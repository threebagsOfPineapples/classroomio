import { describe, expect, it } from 'vitest';
import { generateSitename } from './org';

describe('organization site names', () => {
  it('keeps readable Latin names and gives Chinese names a valid stable address', () => {
    expect(generateSitename('My Company')).toBe('my-company');
    const chineseSiteName = generateSitename('智云科技');
    expect(chineseSiteName).toMatch(/^org-[a-z0-9]{7,}$/);
    expect(generateSitename('智云科技')).toBe(chineseSiteName);
    expect(generateSitename('')).toBe('');
  });
});
