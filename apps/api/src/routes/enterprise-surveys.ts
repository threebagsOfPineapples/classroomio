import { Hono } from '@api/utils/hono';
import { handleError, ErrorCodes } from '@api/utils/errors';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ZSurveyAnswers, ZSurveyTask, ZSurveyTemplate } from '@cio/utils/validation/survey';
import {
  changeSurveyTaskState,
  createSurveyTask,
  exportSurveyReport,
  getMySurvey,
  getMySurveys,
  getSurveyAdministration,
  getSurveyReport,
  getSurveyTaskAdministration,
  getSurveyTemplateAdministration,
  publishSurveyTemplate,
  saveSurveyTemplate,
  writeMySurvey
} from '@api/services/survey';

const templateParam = zValidator('param', z.object({ templateId: z.uuid() }));
const taskParam = zValidator('param', z.object({ taskId: z.uuid() }));

export const enterpriseSurveysRouter = new Hono()
  .use('*', async (context, next) => {
    context.header('Cache-Control', 'no-store');
    if (!context.get('user') || !z.uuid().safeParse(context.req.header('cio-org-id')).success)
      return context.json(
        { success: false, error: 'Organization and session required', code: ErrorCodes.VALIDATION_ERROR },
        400
      );

    await next();
  })
  .get('/templates', async (context) => {
    try {
      const data = await getSurveyTemplateAdministration(context.req.header('cio-org-id')!, context.get('user')!.id);
      return context.json({ success: true, data });
    } catch (error) {
      return handleError(context, error);
    }
  })
  .post('/templates', zValidator('json', ZSurveyTemplate), async (context) => {
    try {
      const data = await saveSurveyTemplate(
        context.req.header('cio-org-id')!,
        context.get('user')!.id,
        context.req.valid('json')
      );
      return context.json({ success: true, data });
    } catch (error) {
      return handleError(context, error);
    }
  })
  .put('/templates/:templateId', templateParam, zValidator('json', ZSurveyTemplate), async (context) => {
    try {
      const data = await saveSurveyTemplate(
        context.req.header('cio-org-id')!,
        context.get('user')!.id,
        context.req.valid('json'),
        context.req.valid('param').templateId
      );
      return context.json({ success: true, data });
    } catch (error) {
      return handleError(context, error);
    }
  })
  .post('/templates/:templateId/publish', templateParam, async (context) => {
    try {
      const data = await publishSurveyTemplate(
        context.req.header('cio-org-id')!,
        context.get('user')!.id,
        context.req.valid('param').templateId
      );
      return context.json({ success: true, data });
    } catch (error) {
      return handleError(context, error);
    }
  })
  .get('/tasks', async (context) => {
    try {
      const data = await getSurveyAdministration(context.req.header('cio-org-id')!, context.get('user')!.id);
      return context.json({ success: true, data });
    } catch (error) {
      return handleError(context, error);
    }
  })
  .post('/tasks', zValidator('json', ZSurveyTask), async (context) => {
    try {
      const data = await createSurveyTask(
        context.req.header('cio-org-id')!,
        context.get('user')!.id,
        context.req.valid('json')
      );
      return context.json({ success: true, data });
    } catch (error) {
      return handleError(context, error);
    }
  })
  .get('/tasks/:taskId', taskParam, async (context) => {
    try {
      const data = await getSurveyTaskAdministration(
        context.req.header('cio-org-id')!,
        context.get('user')!.id,
        context.req.valid('param').taskId
      );
      return context.json({ success: true, data });
    } catch (error) {
      return handleError(context, error);
    }
  })
  .post('/tasks/:taskId/publish', taskParam, async (context) => {
    try {
      const data = await changeSurveyTaskState(
        context.req.header('cio-org-id')!,
        context.get('user')!.id,
        context.req.valid('param').taskId,
        'PUBLISH'
      );
      return context.json({ success: true, data });
    } catch (error) {
      return handleError(context, error);
    }
  })
  .post('/tasks/:taskId/close', taskParam, async (context) => {
    try {
      const data = await changeSurveyTaskState(
        context.req.header('cio-org-id')!,
        context.get('user')!.id,
        context.req.valid('param').taskId,
        'CLOSE'
      );
      return context.json({ success: true, data });
    } catch (error) {
      return handleError(context, error);
    }
  })
  .get('/tasks/:taskId/report', taskParam, async (context) => {
    try {
      const data = await getSurveyReport(
        context.req.header('cio-org-id')!,
        context.get('user')!.id,
        context.req.valid('param').taskId
      );
      return context.json({ success: true, data });
    } catch (error) {
      return handleError(context, error);
    }
  })
  .get(
    '/tasks/:taskId/export',
    taskParam,
    zValidator('query', z.object({ kind: z.enum(['answers', 'participation']) })),
    async (context) => {
      try {
        const csv = await exportSurveyReport(
          context.req.header('cio-org-id')!,
          context.get('user')!.id,
          context.req.valid('param').taskId,
          context.req.valid('query').kind
        );
        context.header('Content-Type', 'text/csv; charset=utf-8');
        context.header('Content-Disposition', 'attachment; filename="survey.csv"');
        context.header('Cache-Control', 'no-store');
        return context.body(csv);
      } catch (error) {
        return handleError(context, error);
      }
    }
  )
  .get('/mine', async (context) => {
    try {
      const data = await getMySurveys(context.req.header('cio-org-id')!, context.get('user')!.id);
      return context.json({ success: true, data });
    } catch (error) {
      return handleError(context, error);
    }
  })
  .get('/mine/:taskId', taskParam, async (context) => {
    try {
      const data = await getMySurvey(
        context.req.header('cio-org-id')!,
        context.get('user')!.id,
        context.req.valid('param').taskId
      );
      return context.json({ success: true, data });
    } catch (error) {
      return handleError(context, error);
    }
  })
  .put('/mine/:taskId/draft', taskParam, zValidator('json', ZSurveyAnswers), async (context) => {
    try {
      const data = await writeMySurvey(
        context.req.header('cio-org-id')!,
        context.get('user')!.id,
        context.req.valid('param').taskId,
        context.req.valid('json').answers,
        false
      );
      return context.json({ success: true, data });
    } catch (error) {
      return handleError(context, error);
    }
  })
  .post('/mine/:taskId/submit', taskParam, zValidator('json', ZSurveyAnswers), async (context) => {
    try {
      const data = await writeMySurvey(
        context.req.header('cio-org-id')!,
        context.get('user')!.id,
        context.req.valid('param').taskId,
        context.req.valid('json').answers,
        true
      );
      return context.json({ success: true, data });
    } catch (error) {
      return handleError(context, error);
    }
  });
