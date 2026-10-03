import { beforeEach, describe, expect, it, vi } from 'vitest';

const queries = vi.hoisted(() => ({
  course: vi.fn(),
  lesson: vi.fn(),
  member: vi.fn(),
  manager: vi.fn(),
  programAccess: vi.fn(),
  organizationId: vi.fn(),
  asset: vi.fn(),
  assets: vi.fn(),
  sign: vi.fn()
}));

vi.mock('@cio/db/queries/course', () => ({ getCourseById: queries.course }));
vi.mock('@cio/db/queries/lesson', () => ({ getLessonById: queries.lesson }));
vi.mock('@cio/db/queries/group', () => ({
  isUserCourseMemberOrOrgAdmin: queries.member,
  isCourseTeamMemberOrOrgAdmin: queries.manager
}));
vi.mock('@cio/db/queries/tag', () => ({ getCourseOrganizationId: queries.organizationId }));
vi.mock('@cio/db/queries/assets', () => ({ getAssetById: queries.asset, getAssetsByIds: queries.assets }));
vi.mock('@cio/core/services/course/course', () => ({ ensureProgramCourseAccess: queries.programAccess }));
vi.mock('@cio/core/utils/s3', () => ({ generateDocumentDownloadPresignedUrls: queries.sign }));

import {
  assertCourseDocumentDownloadAllowed,
  getLessonDocumentDownload
} from '@cio/core/services/lesson/document-download';

const uploadedDocument = {
  key: 'company.pdf',
  name: '公司介绍.pdf',
  type: 'pdf',
  link: 'https://old.example.com/file'
};

beforeEach(() => {
  vi.clearAllMocks();
  queries.course.mockResolvedValue([{ id: 'course-1', metadata: { lessonDownload: true } }]);
  queries.lesson.mockResolvedValue({ id: 'lesson-1', courseId: 'course-1', documents: [uploadedDocument] });
  queries.member.mockResolvedValue(true);
  queries.manager.mockResolvedValue(false);
  queries.programAccess.mockResolvedValue(false);
  queries.organizationId.mockResolvedValue('org-1');
  queries.asset.mockResolvedValue(null);
  queries.assets.mockResolvedValue([]);
  queries.sign.mockResolvedValue({ 'company.pdf': 'https://storage.example.com/company.pdf?signed=1' });
});

describe('课程文件下载权限', () => {
  it.each([false, undefined, 'true'])('学员在开关 %s 时不能下载', async (lessonDownload) => {
    queries.course.mockResolvedValue([{ id: 'course-1', metadata: { lessonDownload } }]);

    await expect(getLessonDocumentDownload('course-1', 'lesson-1', 'student-1', 'company.pdf')).rejects.toMatchObject({
      statusCode: 403,
      code: 'COURSE_DOCUMENT_DOWNLOAD_DISABLED'
    });
    expect(queries.sign).not.toHaveBeenCalled();
  });

  it('允许学员下载已开启课程内的真实附件', async () => {
    const result = await getLessonDocumentDownload('course-1', 'lesson-1', 'student-1', 'company.pdf');

    expect(result).toEqual({ url: 'https://storage.example.com/company.pdf?signed=1', name: '公司介绍.pdf' });
    expect(queries.sign).toHaveBeenCalledWith(['company.pdf']);
  });

  it('允许实际课程管理者在开关关闭时下载', async () => {
    queries.course.mockResolvedValue([{ id: 'course-1', metadata: { lessonDownload: false } }]);
    queries.manager.mockResolvedValue(true);

    await expect(getLessonDocumentDownload('course-1', 'lesson-1', 'manager-1', 'company.pdf')).resolves.toMatchObject({
      name: '公司介绍.pdf'
    });
  });

  it('非课程成员不能因下载开关开启获得文件', async () => {
    queries.member.mockResolvedValue(false);

    await expect(getLessonDocumentDownload('course-1', 'lesson-1', 'outsider', 'company.pdf')).rejects.toMatchObject({
      statusCode: 403
    });
    expect(queries.sign).not.toHaveBeenCalled();
  });

  it('保留培训项目分配的课程访问', async () => {
    queries.member.mockResolvedValue(false);
    queries.programAccess.mockResolvedValue(true);

    await expect(assertCourseDocumentDownloadAllowed('course-1', 'student-1')).resolves.toBeUndefined();
    expect(queries.programAccess).toHaveBeenCalledWith('course-1', 'student-1');
  });

  it('拒绝跨课程课时', async () => {
    queries.lesson.mockResolvedValue({ id: 'lesson-1', courseId: 'course-2', documents: [uploadedDocument] });

    await expect(getLessonDocumentDownload('course-1', 'lesson-1', 'student-1', 'company.pdf')).rejects.toMatchObject({
      statusCode: 404
    });
    expect(queries.sign).not.toHaveBeenCalled();
  });

  it('拒绝任意客户端 URL 或未挂载文件 key', async () => {
    await expect(
      getLessonDocumentDownload('course-1', 'lesson-1', 'student-1', 'https://other.example.com/private.pdf')
    ).rejects.toMatchObject({ statusCode: 404, code: 'COURSE_DOCUMENT_NOT_FOUND' });
    expect(queries.sign).not.toHaveBeenCalled();
  });

  it('只使用同组织资产的 canonical storageKey，保留原文件名及扩展名', async () => {
    queries.lesson.mockResolvedValue({
      id: 'lesson-1',
      courseId: 'course-1',
      documents: [{ ...uploadedDocument, assetId: 'asset-1' }]
    });
    queries.asset.mockResolvedValue({
      id: 'asset-1',
      organizationId: 'org-1',
      provider: 'upload',
      storageKey: 'canonical.pdf',
      title: '正式公司介绍'
    });
    queries.sign.mockResolvedValue({ 'canonical.pdf': 'https://storage.example.com/canonical.pdf' });

    await expect(getLessonDocumentDownload('course-1', 'lesson-1', 'student-1', 'company.pdf')).resolves.toEqual({
      url: 'https://storage.example.com/canonical.pdf',
      name: '公司介绍.pdf'
    });
    expect(queries.asset).toHaveBeenCalledWith('asset-1', 'org-1');
    expect(queries.sign).toHaveBeenCalledWith(['canonical.pdf']);
  });

  it('接受预览返回的 canonical 附件身份', async () => {
    const asset = { id: 'asset-1', organizationId: 'org-1', provider: 'upload', storageKey: 'canonical.pdf' };
    queries.lesson.mockResolvedValue({
      id: 'lesson-1',
      courseId: 'course-1',
      documents: [{ ...uploadedDocument, assetId: asset.id }]
    });
    queries.assets.mockResolvedValue([asset]);
    queries.asset.mockResolvedValue(asset);
    queries.sign.mockResolvedValue({ 'canonical.pdf': 'https://storage.example.com/canonical.pdf' });

    await expect(
      getLessonDocumentDownload('course-1', 'lesson-1', 'student-1', 'canonical.pdf')
    ).resolves.toMatchObject({
      url: 'https://storage.example.com/canonical.pdf'
    });
    expect(queries.assets).toHaveBeenCalledWith(['asset-1'], 'org-1');
  });

  it('拒绝关联其他组织的资产', async () => {
    queries.lesson.mockResolvedValue({
      id: 'lesson-1',
      courseId: 'course-1',
      documents: [{ ...uploadedDocument, assetId: 'asset-other-org' }]
    });
    queries.asset.mockResolvedValue({ organizationId: 'org-2', provider: 'upload', storageKey: 'private.pdf' });

    await expect(getLessonDocumentDownload('course-1', 'lesson-1', 'student-1', 'company.pdf')).rejects.toMatchObject({
      statusCode: 404
    });
    expect(queries.sign).not.toHaveBeenCalled();
  });

  it('外链附件通过持久 asset 身份获取 URL，保留预览用途', async () => {
    queries.lesson.mockResolvedValue({
      id: 'lesson-1',
      courseId: 'course-1',
      documents: [{ ...uploadedDocument, assetId: 'external-asset' }]
    });
    queries.asset.mockResolvedValue({
      id: 'external-asset',
      organizationId: 'org-1',
      provider: 'external_url',
      sourceUrl: 'https://training.example.com/company.pdf',
      title: '外链公司介绍'
    });

    await expect(
      getLessonDocumentDownload('course-1', 'lesson-1', 'student-1', 'asset:external-asset')
    ).resolves.toEqual({
      url: 'https://training.example.com/company.pdf',
      name: '公司介绍.pdf'
    });
    expect(queries.sign).not.toHaveBeenCalled();
  });

  it('拒绝持久附件中的危险 URL scheme', async () => {
    queries.lesson.mockResolvedValue({
      id: 'lesson-1',
      courseId: 'course-1',
      documents: [{ ...uploadedDocument, key: '', assetId: 'external-asset' }]
    });
    queries.asset.mockResolvedValue({
      organizationId: 'org-1',
      provider: 'external_url',
      sourceUrl: 'javascript:alert(1)'
    });

    await expect(
      getLessonDocumentDownload('course-1', 'lesson-1', 'student-1', 'asset:external-asset')
    ).rejects.toMatchObject({
      statusCode: 404
    });
  });
});
