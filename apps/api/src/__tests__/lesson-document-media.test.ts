import { beforeEach, expect, it, vi } from 'vitest';

const media = vi.hoisted(() => ({
  assets: vi.fn(),
  documentUrls: vi.fn(),
  videoUrls: vi.fn()
}));

vi.mock('@cio/db/queries/assets', () => ({ getAssetsByIds: media.assets }));
vi.mock('@cio/core/services/assets/assets', () => ({ queueVimeoBackfill: vi.fn() }));
vi.mock('@cio/core/utils/s3', () => ({
  generateDocumentDownloadPresignedUrls: media.documentUrls,
  generateVideoDownloadPresignedUrls: media.videoUrls
}));

import { enrichLessonWithPresignedUrls } from '@cio/core/utils/lesson-media';

beforeEach(() => {
  vi.clearAllMocks();
  media.videoUrls.mockResolvedValue({});
  media.documentUrls.mockResolvedValue({ 'uploaded.pdf': 'https://storage.example.com/signed.pdf' });
});

it('keeps registered external PDF URLs and only signs uploaded documents', async () => {
  media.assets.mockResolvedValue([
    {
      id: 'external-asset',
      provider: 'external_url',
      storageKey: null,
      sourceUrl: 'https://training.example.com/company.pdf',
      mimeType: 'application/pdf',
      title: '公司介绍.pdf'
    },
    {
      id: 'uploaded-asset',
      provider: 'upload',
      storageKey: 'uploaded.pdf',
      mimeType: 'application/pdf'
    }
  ]);
  const lesson: Parameters<typeof enrichLessonWithPresignedUrls>[0] = {
    id: 'lesson-1',
    courseId: 'course-1',
    title: '公司介绍',
    note: null,
    videoUrl: null,
    slideUrl: null,
    slides: [],
    createdAt: '2026-10-03T00:00:00.000Z',
    updatedAt: '2026-10-03T00:00:00.000Z',
    public: false,
    lessonAt: null,
    teacherId: null,
    isComplete: false,
    callUrl: null,
    order: 1,
    isUnlocked: true,
    completionPolicy: 'manual',
    videoWatchThreshold: 95,
    commentsEnabled: true,
    sectionId: null,
    slug: 'company-intro',
    lessonLanguages: [],
    videos: [],
    documents: [
      {
        assetId: 'external-asset',
        type: 'pdf',
        name: '外链.pdf',
        key: 'old-key',
        link: 'https://old.example.com/file.pdf'
      },
      { assetId: 'uploaded-asset', type: 'pdf', name: '上传.pdf', key: 'uploaded.pdf', link: '' }
    ]
  };

  const enriched = await enrichLessonWithPresignedUrls(lesson);

  expect(media.documentUrls).toHaveBeenCalledWith(['uploaded.pdf']);
  expect(enriched.documents?.[0]).toMatchObject({
    assetId: 'external-asset',
    key: '',
    link: 'https://training.example.com/company.pdf',
    name: '公司介绍.pdf'
  });
  expect(enriched.documents?.[1].link).toBe('https://storage.example.com/signed.pdf');
});
