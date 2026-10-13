import { Hono } from '@api/utils/hono';
import { authMiddleware } from '@api/middlewares/auth';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppError, ErrorCodes, handleError } from '@api/utils/errors';
import {
  ZTrainingSessionCheckin,
  ZTrainingSessionCorrection,
  ZTrainingSessionDraft,
  ZTrainingSessionFilter,
  ZTrainingSessionSelection
} from '@cio/utils/validation/training-session';
import {
  changeTrainingSessionStatus,
  changeTrainingSessionToken,
  checkInTrainingSession,
  correctTrainingSessionAttendance,
  exportTrainingSession,
  getTrainingSessionCandidates,
  getTrainingSessionDetail,
  getTrainingSessionList,
  previewTrainingSessionAudience,
  saveTrainingSessionDraft
} from '@api/services/training-session';

const sessionParam = z.object({ sessionId: z.uuid() });

export const enterpriseSessionsRouter = new Hono()
  .use('*', authMiddleware)
  .use('*', async (context, next) => {
    if (!z.uuid().safeParse(context.req.header('cio-org-id')).success)
      throw new AppError('Organization required', ErrorCodes.VALIDATION_ERROR, 400);
    await next();
  })
  .get('/', async (context) => {
    try {
      const data = await getTrainingSessionList(context.req.header('cio-org-id')!, context.get('user')!.id);
      return context.json({ success: true as const, data });
    } catch (error) {
      return handleError(context, error);
    }
  })
  .get('/mine', async (context) => {
    try {
      const data = await getTrainingSessionList(context.req.header('cio-org-id')!, context.get('user')!.id, true);
      return context.json({ success: true as const, data });
    } catch (error) {
      return handleError(context, error);
    }
  })
  .get('/candidates', async (context) => {
    try {
      const data = await getTrainingSessionCandidates(context.req.header('cio-org-id')!, context.get('user')!.id);
      return context.json({ success: true as const, data });
    } catch (error) {
      return handleError(context, error);
    }
  })
  .post('/preview', zValidator('json', ZTrainingSessionSelection), async (context) => {
    try {
      const data = await previewTrainingSessionAudience(
        context.req.header('cio-org-id')!,
        context.get('user')!.id,
        context.req.valid('json')
      );
      return context.json({ success: true as const, data });
    } catch (error) {
      return handleError(context, error);
    }
  })
  .post('/', zValidator('json', ZTrainingSessionDraft), async (context) => {
    try {
      const data = await saveTrainingSessionDraft(
        context.req.header('cio-org-id')!,
        context.get('user')!.id,
        context.req.valid('json')
      );
      return context.json({ success: true as const, data });
    } catch (error) {
      return handleError(context, error);
    }
  })
  .get(
    '/:sessionId',
    zValidator('param', sessionParam),
    zValidator('query', ZTrainingSessionFilter),
    async (context) => {
      try {
        const data = await getTrainingSessionDetail(
          context.req.header('cio-org-id')!,
          context.get('user')!.id,
          context.req.valid('param').sessionId,
          context.req.valid('query')
        );
        return context.json({ success: true as const, data });
      } catch (error) {
        return handleError(context, error);
      }
    }
  )
  .get('/:sessionId/mine', zValidator('param', sessionParam), async (context) => {
    try {
      const data = await getTrainingSessionDetail(
        context.req.header('cio-org-id')!,
        context.get('user')!.id,
        context.req.valid('param').sessionId,
        { search: '', status: 'ALL' },
        true
      );
      return context.json({ success: true as const, data });
    } catch (error) {
      return handleError(context, error);
    }
  })
  .put('/:sessionId', zValidator('param', sessionParam), zValidator('json', ZTrainingSessionDraft), async (context) => {
    try {
      const data = await saveTrainingSessionDraft(
        context.req.header('cio-org-id')!,
        context.get('user')!.id,
        context.req.valid('json'),
        context.req.valid('param').sessionId
      );
      return context.json({ success: true as const, data });
    } catch (error) {
      return handleError(context, error);
    }
  })
  .post(
    '/:sessionId/status',
    zValidator('param', sessionParam),
    zValidator('json', z.object({ action: z.enum(['PUBLISH', 'CLOSE']) }).strict()),
    async (context) => {
      try {
        const data = await changeTrainingSessionStatus(
          context.req.header('cio-org-id')!,
          context.get('user')!.id,
          context.req.valid('param').sessionId,
          context.req.valid('json').action
        );
        return context.json({ success: true as const, data });
      } catch (error) {
        return handleError(context, error);
      }
    }
  )
  .post(
    '/:sessionId/token',
    zValidator('param', sessionParam),
    zValidator('json', z.object({ issue: z.boolean() }).strict()),
    async (context) => {
      try {
        const data = await changeTrainingSessionToken(
          context.req.header('cio-org-id')!,
          context.get('user')!.id,
          context.req.valid('param').sessionId,
          context.req.valid('json').issue
        );
        context.header('Cache-Control', 'no-store');
        return context.json({ success: true as const, data });
      } catch (error) {
        return handleError(context, error);
      }
    }
  )
  .post(
    '/:sessionId/checkin',
    zValidator('param', sessionParam),
    zValidator('json', ZTrainingSessionCheckin),
    async (context) => {
      try {
        const data = await checkInTrainingSession(
          context.req.header('cio-org-id')!,
          context.get('user')!.id,
          context.req.valid('param').sessionId,
          context.req.valid('json').token
        );
        return context.json({ success: true as const, data });
      } catch (error) {
        return handleError(context, error);
      }
    }
  )
  .post(
    '/:sessionId/correction',
    zValidator('param', sessionParam),
    zValidator('json', ZTrainingSessionCorrection),
    async (context) => {
      try {
        const data = await correctTrainingSessionAttendance(
          context.req.header('cio-org-id')!,
          context.get('user')!.id,
          context.req.valid('param').sessionId,
          context.req.valid('json')
        );
        return context.json({ success: true as const, data });
      } catch (error) {
        return handleError(context, error);
      }
    }
  )
  .get(
    '/:sessionId/export',
    zValidator('param', sessionParam),
    zValidator('query', ZTrainingSessionFilter),
    async (context) => {
      try {
        const csv = await exportTrainingSession(
          context.req.header('cio-org-id')!,
          context.get('user')!.id,
          context.req.valid('param').sessionId,
          context.req.valid('query')
        );
        context.header('Content-Type', 'text/csv; charset=utf-8');
        context.header('Content-Disposition', 'attachment; filename="session-attendance.csv"');
        context.header('Cache-Control', 'no-store');
        return context.body(csv);
      } catch (error) {
        return handleError(context, error);
      }
    }
  );
