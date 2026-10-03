import { beforeEach, expect, it, vi } from 'vitest';

const queries = vi.hoisted(() => ({ lessons: vi.fn(), languages: vi.fn() }));
vi.mock('@cio/db/drizzle', () => ({ db: {} }));
vi.mock('@cio/db/queries/lesson', () => ({
  getLessonsByCourseId: queries.lessons,
  getLessonLanguagesByLessonIds: queries.languages
}));

import { assertCourseCompletionReady } from '@cio/core/services/course/completion-readiness';

beforeEach(() => {
  queries.lessons.mockReset();
  queries.languages.mockReset();
  queries.languages.mockResolvedValue([]);
});

it.each([
  ['manual', [], [], false],
  ['manual', [], [{ type: 'application/pdf', name: '入职.pdf', key: 'pdf-1' }], true],
  ['manual', [], [{ type: 'docx', name: '入职.docx', key: 'doc-1' }], false],
  ['manual', [], [{ type: 'pdf', name: '入职.pdf', key: '' }], false],
  ['manual', [], [{ type: 'pdf', name: '入职.pdf', key: '', assetId: 'asset-1' }], true],
  ['manual', [{ type: 'upload', assetId: 'video-1' }], [], false],
  ['video_watch', [{ type: 'upload', assetId: 'video-1' }], [], true],
  ['video_watch', [{ type: 'youtube', link: 'https://example.com/video' }], [], false],
  ['none', [], [], true]
])('发布检查 %s / %o / %o', async (completionPolicy, videos, documents, allowed) => {
  queries.lessons.mockResolvedValue([{ id: 'lesson-1', title: '入职培训', completionPolicy, videos, documents }]);
  if (allowed) {
    await expect(assertCourseCompletionReady('course-1')).resolves.toBeUndefined();
  } else {
    await expect(assertCourseCompletionReady('course-1')).rejects.toMatchObject({ statusCode: 400 });
  }
});

it('正文课时可发布，查询共用数据库客户端', async () => {
  queries.lessons.mockResolvedValue([{ id: 'lesson-1', title: '入职培训', completionPolicy: 'manual' }]);
  queries.languages.mockResolvedValue([{ lessonId: 'lesson-1', locale: 'zh', content: '<p>真实培训正文</p>' }]);
  await expect(assertCourseCompletionReady('course-1')).resolves.toBeUndefined();
  expect(queries.lessons).toHaveBeenCalledWith('course-1', {});
  expect(queries.languages).toHaveBeenCalledWith(['lesson-1'], {});
});

it('正文不能掩盖同课时中无法核验的幻灯片', async () => {
  queries.lessons.mockResolvedValue([
    { id: 'lesson-1', title: '入职培训', completionPolicy: 'manual', slideUrl: 'https://example.com/slides' }
  ]);
  queries.languages.mockResolvedValue([{ lessonId: 'lesson-1', locale: 'zh', content: '正文' }]);
  await expect(assertCourseCompletionReady('course-1')).rejects.toMatchObject({ statusCode: 400 });
});
