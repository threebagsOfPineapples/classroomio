import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const state = vi.hoisted(() => ({
  authenticated: true,
  member: true,
  lessonCourseId: '10000000-0000-4000-8000-000000000001',
  download: vi.fn(),
  access: vi.fn(),
  presignAccess: vi.fn(),
  documentSign: vi.fn(),
  videoSign: vi.fn()
}));

vi.mock('@cio/db/queries/group', () => ({ isUserCourseMemberOrOrgAdmin: async () => state.member }));
vi.mock('@cio/db/queries/lesson', () => ({ getLessonById: async () => ({ courseId: state.lessonCourseId }) }));
vi.mock('@cio/core/services/course/course', () => ({ ensureProgramCourseAccess: async () => false }));
vi.mock('@cio/core/services/lesson/document-download', () => ({ getLessonDocumentDownload: state.download }));
vi.mock('@api/services/lesson', () => ({}));
vi.mock('@cio/core/services/lesson-language', () => ({}));
vi.mock('@api/services/course/access', () => ({ assertEnrolledStudentContentAccess: state.access }));
vi.mock('@api/services/course/completion', () => ({ evaluateCourseCertification: vi.fn() }));
vi.mock('@api/services/assessment', () => ({ syncAssessmentsForCourse: vi.fn() }));
vi.mock('@api/services/lesson-reading', () => ({ recordLessonReadingProgress: vi.fn() }));
vi.mock('@api/services/course/notify-session', () => ({ notifyCourseSessionUpdateService: vi.fn() }));
vi.mock('@api/utils/lesson', () => ({ generateLessonPdf: vi.fn() }));
vi.mock('@api/services/course/document-download', () => ({ assertCourseDocumentPresignAllowed: state.presignAccess }));
vi.mock('@cio/core/utils/s3', () => ({
  generateDocumentDownloadPresignedUrls: state.documentSign,
  generateVideoDownloadPresignedUrls: state.videoSign,
  generateDocumentUploadPresignedUrl: vi.fn(),
  generateVideoUploadPresignedUrl: vi.fn()
}));

import { lessonRouter } from '@api/routes/course/lesson';
import { presignRouter } from '@api/routes/course/presign';
import { AppError } from '@api/utils/errors';

const courseId = '10000000-0000-4000-8000-000000000001';
const lessonId = '20000000-0000-4000-8000-000000000001';
const app = new Hono<{ Variables: { user: { id: string }; session: { id: string } } }>()
  .use('*', async (context, next) => {
    if (state.authenticated) {
      context.set('user', { id: 'student-1' });
      context.set('session', { id: 'session-1' });
    }
    await next();
  })
  .route('/course/:courseId/lesson', lessonRouter)
  .route('/course/presign', presignRouter);

function post(path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.authenticated = true;
  state.member = true;
  state.lessonCourseId = courseId;
  state.download.mockResolvedValue({ url: 'https://storage.example.com/company.pdf', name: '公司介绍.pdf' });
  state.access.mockResolvedValue(undefined);
  state.presignAccess.mockResolvedValue(undefined);
  state.documentSign.mockResolvedValue({ 'company.pdf': 'https://storage.example.com/company.pdf' });
  state.videoSign.mockResolvedValue({ 'company.pdf': 'https://storage.example.com/company.pdf' });
});

describe('正式课程文件下载路由', () => {
  const path = `/course/${courseId}/lesson/${lessonId}/document/download`;

  it('返回已授权文件 URL 与名称，先执行课时访问检查', async () => {
    const response = await post(path, { documentId: 'company.pdf' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: { url: 'https://storage.example.com/company.pdf', name: '公司介绍.pdf' }
    });
    expect(state.download).toHaveBeenCalledWith(courseId, lessonId, 'student-1', 'company.pdf');
    expect(state.access.mock.invocationCallOrder[0]).toBeLessThan(state.download.mock.invocationCallOrder[0]);
  });

  it('未登录无法取得文件', async () => {
    state.authenticated = false;
    expect((await post(path, { documentId: 'company.pdf' })).status).toBe(401);
    expect(state.download).not.toHaveBeenCalled();
  });

  it('非成员无法取得文件', async () => {
    state.member = false;
    expect((await post(path, { documentId: 'company.pdf' })).status).toBe(403);
    expect(state.download).not.toHaveBeenCalled();
  });

  it('不能将别的课程课时放到路径中', async () => {
    state.lessonCourseId = '10000000-0000-4000-8000-000000000002';
    expect((await post(path, { documentId: 'company.pdf' })).status).toBe(404);
    expect(state.download).not.toHaveBeenCalled();
  });

  it('课时锁定时不执行文件下载服务', async () => {
    state.access.mockRejectedValue(new AppError('课时尚未解锁', 'VALIDATION_ERROR', 403));
    expect((await post(path, { documentId: 'company.pdf' })).status).toBe(403);
    expect(state.download).not.toHaveBeenCalled();
  });

  it('下载关闭返回稳定错误 code', async () => {
    state.download.mockRejectedValue(
      new AppError('管理员已关闭课程文件下载，可继续在线预览', 'COURSE_DOCUMENT_DOWNLOAD_DISABLED', 403)
    );
    const response = await post(path, { documentId: 'company.pdf' });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ success: false, code: 'COURSE_DOCUMENT_DOWNLOAD_DISABLED' });
  });

  it.each([{ documentId: '' }, { documentId: 'company.pdf', url: 'https://other.example.com/file.pdf' }])(
    '仅接受有效文件身份字段',
    async (body) => {
      expect((await post(path, body)).status).toBe(400);
      expect(state.download).not.toHaveBeenCalled();
    }
  );
});

describe('旧预签名端点拒绝课程文件绕过', () => {
  it.each(['document', 'video'])('%s 签名在权限失败时不签名', async (kind) => {
    state.presignAccess.mockRejectedValue(
      new AppError('管理员已关闭课程文件下载', 'COURSE_DOCUMENT_DOWNLOAD_DISABLED', 403)
    );

    const response = await post(`/course/presign/${kind}/download`, { keys: ['company.pdf'] });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'COURSE_DOCUMENT_DOWNLOAD_DISABLED' });
    expect(state.documentSign).not.toHaveBeenCalled();
    expect(state.videoSign).not.toHaveBeenCalled();
  });

  it.each(['document', 'video'])('%s 非课程文件保持原请求形状与响应', async (kind) => {
    const response = await post(`/course/presign/${kind}/download`, { keys: ['own-homework.pdf'] });

    expect(response.status).toBe(200);
    expect(state.presignAccess).toHaveBeenCalledWith(['own-homework.pdf'], 'student-1');
    const sign = kind === 'document' ? state.documentSign : state.videoSign;
    expect(sign).toHaveBeenCalledWith(['own-homework.pdf']);
  });
});
