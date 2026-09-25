import { describe, expect, it } from 'vitest';
import { config } from './translations';

describe('Chinese translations', () => {
  it('loads translated training copy and preserves untranslated messages', async () => {
    const loader = config.loaders.find((item) => item.locale === 'zh');
    expect(loader).toBeDefined();

    const messages = await loader!.loader();
    expect(messages.enterprise.assessment.title).toBe('培训考核');
    expect(messages.course.navItem.lessons.heading_v2).toBe('课程内容');
    expect(messages.course.navItem.lessons.exercises.all_exercises.view_mode.attempt_counter).toBe(
      '第 {current} 次尝试，共 {total} 次'
    );
    expect(messages.certificates.empty_title).toBe('暂无证书');
    expect(messages.aiTutor.page.org.title).toBe('AI Tutor settings');
  });
});
