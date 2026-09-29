import { describe, expect, it } from 'vitest';
import { getReadingRequirements, isReadingComplete } from './lesson-reading-rules';
import { ZLessonReadingProgress } from '@cio/utils/validation/lesson';

const lesson = {
  completionPolicy: 'manual',
  lessonLanguages: [{ locale: 'zh', content: '<p>安全入职培训</p>' }],
  documents: [{ key: 'guide.pdf', name: '入职指南.pdf', type: 'application/pdf' }]
};

describe('system reading completion', () => {
  it('requires both server accumulated time and every reading resource', () => {
    const requirements = getReadingRequirements(lesson);
    expect(requirements.resources).toEqual(['note', 'pdf:guide.pdf']);
    expect(isReadingComplete(requirements, 999, ['note'])).toBe(false);
    expect(isReadingComplete(requirements, 0, requirements.resources)).toBe(false);
    expect(isReadingComplete(requirements, requirements.requiredSeconds, requirements.resources)).toBe(true);
  });
  it('does not treat unsupported or empty material as completed', () => {
    for (const change of [
      { videos: [{}] },
      { completionPolicy: 'video_watch' },
      { completionPolicy: 'none' },
      { slideUrl: 'https://example.com/slides' },
      { documents: [{ key: 'file', name: 'file.docx', type: 'docx' }] },
      { lessonLanguages: [], documents: [] }
    ]) {
      const requirements = getReadingRequirements({ ...lesson, ...change });
      expect(isReadingComplete(requirements, 99999, requirements.resources)).toBe(false);
    }
  });
  it('does not accept client supplied time or completion flags', () => {
    expect(
      ZLessonReadingProgress.safeParse({ active: true, resources: ['note'], seconds: 9999, isComplete: true }).success
    ).toBe(false);
    expect(ZLessonReadingProgress.safeParse({ active: true, resources: ['note'] }).success).toBe(true);
  });
});
