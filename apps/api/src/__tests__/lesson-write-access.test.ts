import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const state = vi.hoisted(() => ({
  team: false,
  lessonCourseId: '10000000-0000-4000-8000-000000000001',
  write: vi.fn(),
  list: vi.fn(),
  access: vi.fn()
}));

vi.mock('@cio/db/queries/group', () => ({
  isCourseTeamMemberOrOrgAdmin: async () => state.team,
  isUserCourseMemberOrOrgAdmin: async () => true
}));
vi.mock('@cio/db/queries/lesson', () => ({
  getLessonById: async () => ({ id: '20000000-0000-4000-8000-000000000001', courseId: state.lessonCourseId })
}));
vi.mock('@cio/core/services/course/course', () => ({
  ensureProgramCourseAccess: vi.fn(),
  ensureCourseGroupMemberId: vi.fn()
}));
vi.mock('@api/services/lesson', () => ({
  createLesson: state.write,
  updateLessonService: state.write,
  deleteLessonService: state.write,
  listLessons: state.list
}));
vi.mock('@cio/core/services/lesson-language', () => ({
  getLessonLanguage: state.list,
  listLessonLanguages: state.list,
  updateLessonLanguageService: state.write,
  upsertLessonLanguageService: state.write
}));
vi.mock('@api/services/course/access', () => ({ assertEnrolledStudentContentAccess: state.access }));
vi.mock('@api/services/course/completion', () => ({ evaluateCourseCertification: vi.fn() }));
vi.mock('@api/services/assessment', () => ({ syncAssessmentsForCourse: vi.fn() }));
vi.mock('@api/services/lesson-reading', () => ({ recordLessonReadingProgress: vi.fn() }));
vi.mock('@api/services/course/notify-session', () => ({ notifyCourseSessionUpdateService: state.write }));
vi.mock('@api/utils/lesson', () => ({ generateLessonPdf: vi.fn() }));

import { AppError, ErrorCodes } from '@api/utils/errors';
import { lessonRouter } from '@api/routes/course/lesson';

const app = new Hono<{ Variables: { user: { id: string }; session: { id: string } } }>()
  .use('*', async (context, next) => {
    context.set('user', { id: 'user-a' });
    context.set('session', { id: 'session-a' });
    await next();
  })
  .route('/course/:courseId/lesson', lessonRouter);

function request(method: string, suffix = '', body?: unknown) {
  return app.request(`/course/10000000-0000-4000-8000-000000000001/lesson${suffix}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.team = false;
  state.lessonCourseId = '10000000-0000-4000-8000-000000000001';
  state.write.mockResolvedValue({ id: '20000000-0000-4000-8000-000000000001' });
  state.list.mockResolvedValue([]);
  state.access.mockResolvedValue(undefined);
});

describe('课时写入权限', () => {
  it.each([
    ['POST', ''],
    ['PUT', '/20000000-0000-4000-8000-000000000001'],
    ['DELETE', '/20000000-0000-4000-8000-000000000001'],
    ['POST', '/20000000-0000-4000-8000-000000000001/language'],
    ['PUT', '/20000000-0000-4000-8000-000000000001/language/zh']
  ])('拒绝学员 %s %s', async (method, suffix) => {
    const response = await request(method, suffix, {});
    expect(response.status).toBe(403);
    expect(state.write).not.toHaveBeenCalled();
  });

  it.each([
    ['PUT', '/20000000-0000-4000-8000-000000000001'],
    ['DELETE', '/20000000-0000-4000-8000-000000000001'],
    ['POST', '/20000000-0000-4000-8000-000000000001/language'],
    ['PUT', '/20000000-0000-4000-8000-000000000001/language/zh'],
    ['GET', '/20000000-0000-4000-8000-000000000001/language'],
    ['GET', '/20000000-0000-4000-8000-000000000001/language/zh']
  ])('拒绝跨课程 %s %s', async (method, suffix) => {
    state.team = true;
    state.lessonCourseId = '10000000-0000-4000-8000-000000000002';
    const response = await request(method, suffix, method === 'GET' ? undefined : {});
    expect(response.status).toBe(404);
    expect(state.write).not.toHaveBeenCalled();
    expect(state.list).not.toHaveBeenCalled();
  });

  it('允许授课团队修改本课程课时', async () => {
    state.team = true;
    const response = await request('PUT', '/20000000-0000-4000-8000-000000000001', { title: '入职培训' });
    expect(response.status).toBe(200);
    expect(state.write).toHaveBeenCalledWith('20000000-0000-4000-8000-000000000001', { title: '入职培训' });
  });

  it('正文读取继续遵守课时锁定', async () => {
    state.access.mockRejectedValueOnce(new AppError('课时尚未解锁', ErrorCodes.UNAUTHORIZED, 403));
    const response = await request('GET', '/20000000-0000-4000-8000-000000000001/language');
    expect(response.status).toBe(403);
    expect(state.list).not.toHaveBeenCalled();
  });

  it('允许授课团队保存本课程正文', async () => {
    state.team = true;
    const response = await request('PUT', '/20000000-0000-4000-8000-000000000001/language/zh', {
      content: '入职培训正文'
    });
    expect(response.status).toBe(200);
    expect(state.write).toHaveBeenCalledWith(
      '20000000-0000-4000-8000-000000000001',
      'zh',
      { content: '入职培训正文' },
      { authorId: 'user-a', versionIntent: undefined, versionLabel: undefined }
    );
  });

  it('非法课时编号返回参数错误', async () => {
    state.team = true;
    const response = await request('DELETE', '/invalid');
    expect(response.status).toBe(400);
    expect(state.write).not.toHaveBeenCalled();
  });

  it('列表查询不能用 query 切换到其他课程', async () => {
    const response = await request('GET', '?courseId=10000000-0000-4000-8000-000000000002');
    expect(response.status).toBe(200);
    expect(state.list).toHaveBeenCalledWith('10000000-0000-4000-8000-000000000001', undefined);
  });
});
