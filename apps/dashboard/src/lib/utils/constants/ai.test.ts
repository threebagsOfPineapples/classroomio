import { expect, it, vi } from 'vitest';

const { publicEnvironment } = vi.hoisted(() => {
  const publicEnvironment: Record<string, string | undefined> = {};
  return { publicEnvironment };
});

vi.mock('$env/dynamic/public', () => ({ env: publicEnvironment }));

it('keeps AI hidden unless the operator explicitly enables it', async () => {
  for (const value of [undefined, 'false', '', 'invalid', 'true']) {
    vi.resetModules();
    publicEnvironment.PUBLIC_IS_AI_ENABLED = value;
    const { IS_AI_ENABLED } = await import('./ai');
    expect(IS_AI_ENABLED).toBe(value === 'true');
  }
});
