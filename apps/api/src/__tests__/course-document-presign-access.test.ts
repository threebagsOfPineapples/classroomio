import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({ references: vi.fn(), downloadAccess: vi.fn(), lessonAccess: vi.fn() }));

vi.mock('@cio/db/queries/lesson', () => ({ getLessonDocumentStorageReferences: dependencies.references }));
vi.mock('@cio/core/services/lesson/document-download', () => ({
  assertCourseDocumentDownloadAllowed: dependencies.downloadAccess
}));
vi.mock('@api/services/course/access', () => ({ assertEnrolledStudentContentAccess: dependencies.lessonAccess }));

import { assertCourseDocumentPresignAllowed } from '@api/services/course/document-download';
import { AppError } from '@api/utils/errors';

const reference = {
  lessonId: 'lesson-1',
  courseId: 'course-1',
  organizationId: 'org-1',
  documentKey: 'old-company.pdf',
  storageKey: 'company.pdf',
  assetId: 'asset-1',
  assetOrganizationId: 'org-1'
};

beforeEach(() => {
  vi.clearAllMocks();
  dependencies.references.mockResolvedValue([reference]);
  dependencies.downloadAccess.mockResolvedValue(undefined);
  dependencies.lessonAccess.mockResolvedValue(undefined);
});

describe('旧预签名课程文件权限', () => {
  it.each(['old-company.pdf', 'company.pdf'])('旧 key 与 canonical key %s 都执行课程检查', async (key) => {
    await assertCourseDocumentPresignAllowed([key], 'student-1');

    expect(dependencies.downloadAccess).toHaveBeenCalledWith('course-1', 'student-1');
    expect(dependencies.lessonAccess).toHaveBeenCalledWith({
      courseId: 'course-1',
      profileId: 'student-1',
      contentId: 'lesson-1',
      type: 'LESSON'
    });
  });

  it('课程关闭下载时旧预签名不可绕过', async () => {
    dependencies.downloadAccess.mockRejectedValue(
      new AppError('管理员已关闭课程文件下载', 'COURSE_DOCUMENT_DOWNLOAD_DISABLED', 403)
    );

    await expect(assertCourseDocumentPresignAllowed(['company.pdf'], 'student-1')).rejects.toMatchObject({
      statusCode: 403,
      code: 'COURSE_DOCUMENT_DOWNLOAD_DISABLED'
    });
  });

  it('课时未解锁时旧预签名不可绕过', async () => {
    dependencies.lessonAccess.mockRejectedValue(new AppError('课时尚未解锁', 'VALIDATION_ERROR', 403));

    await expect(assertCourseDocumentPresignAllowed(['company.pdf'], 'student-1')).rejects.toMatchObject({
      statusCode: 403
    });
  });

  it('非课程素材及作业 key 保留现有认证流程', async () => {
    dependencies.references.mockResolvedValue([]);

    await expect(assertCourseDocumentPresignAllowed(['own-homework.docx'], 'student-1')).resolves.toBeUndefined();
    expect(dependencies.downloadAccess).not.toHaveBeenCalled();
    expect(dependencies.lessonAccess).not.toHaveBeenCalled();
  });

  it('相同文件多课引用允许使用本人已获授权的允许下载课时', async () => {
    dependencies.references.mockResolvedValue([
      reference,
      { ...reference, lessonId: 'lesson-2', courseId: 'course-2' }
    ]);
    dependencies.downloadAccess.mockImplementation(async (courseId) => {
      if (courseId === 'course-1') throw new AppError('当前课程关闭下载', 'COURSE_DOCUMENT_DOWNLOAD_DISABLED', 403);
    });

    await expect(assertCourseDocumentPresignAllowed(['company.pdf'], 'student-1')).resolves.toBeUndefined();
    expect(dependencies.lessonAccess).toHaveBeenCalledWith(expect.objectContaining({ courseId: 'course-2' }));
  });

  it('请求混有允许文件与禁止文件时整批拒绝', async () => {
    dependencies.references.mockResolvedValue([
      reference,
      { ...reference, lessonId: 'lesson-2', courseId: 'course-2', documentKey: 'blocked.pdf', storageKey: null }
    ]);
    dependencies.downloadAccess.mockImplementation(async (courseId) => {
      if (courseId === 'course-2') throw new AppError('当前课程关闭下载', 'COURSE_DOCUMENT_DOWNLOAD_DISABLED', 403);
    });

    await expect(assertCourseDocumentPresignAllowed(['company.pdf', 'blocked.pdf'], 'student-1')).rejects.toMatchObject(
      {
        code: 'COURSE_DOCUMENT_DOWNLOAD_DISABLED'
      }
    );
  });

  it('多课引用全部拒绝时保留本人课程下载关闭的稳定 code', async () => {
    dependencies.references.mockResolvedValue([
      reference,
      { ...reference, lessonId: 'lesson-2', courseId: 'course-2' }
    ]);
    dependencies.downloadAccess.mockImplementation(async (courseId) => {
      if (courseId === 'course-1') throw new AppError('当前课程关闭下载', 'COURSE_DOCUMENT_DOWNLOAD_DISABLED', 403);

      throw new AppError('你没有此课程的访问权限', 'UNAUTHORIZED', 403);
    });

    await expect(assertCourseDocumentPresignAllowed(['company.pdf'], 'student-1')).rejects.toMatchObject({
      code: 'COURSE_DOCUMENT_DOWNLOAD_DISABLED'
    });
  });

  it('跨组织资产关联不能变成允许引用', async () => {
    dependencies.references.mockResolvedValue([{ ...reference, assetOrganizationId: 'org-2' }]);

    await expect(assertCourseDocumentPresignAllowed(['company.pdf'], 'student-1')).rejects.toMatchObject({
      statusCode: 404
    });
    expect(dependencies.downloadAccess).not.toHaveBeenCalled();
  });

  it('数据库或权限检查失败时拒绝签名，不绕到另一引用', async () => {
    dependencies.references.mockResolvedValue([
      reference,
      { ...reference, lessonId: 'lesson-2', courseId: 'course-2' }
    ]);
    dependencies.downloadAccess.mockRejectedValue(new Error('database unavailable'));

    await expect(assertCourseDocumentPresignAllowed(['company.pdf'], 'student-1')).rejects.toThrow(
      'database unavailable'
    );
    expect(dependencies.downloadAccess).toHaveBeenCalledTimes(1);
  });
});
