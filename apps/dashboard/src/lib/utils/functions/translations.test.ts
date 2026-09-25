import { describe, expect, it } from 'vitest';
import { config } from './translations';

describe('Chinese translations', () => {
  it('loads translated training copy and preserves untranslated messages', async () => {
    const loader = config.loaders.find((item) => item.locale === 'zh');
    expect(loader).toBeDefined();

    const messages = await loader!.loader();
    expect(messages.enterprise.assessment.title).toBe('培训考核');
    expect(messages.aiTutor.page.org.title).toBe('AI Tutor settings');
  });
});
