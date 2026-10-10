import { Hono } from '@api/utils/hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ZDingtalkDirectorySync } from '@cio/utils/validation/auth/dingtalk';
import {
  getDingtalkDirectoryStatus,
  previewDingtalkDirectory,
  syncDingtalkDirectory
} from '@api/services/dingtalk-directory';
import { ErrorCodes, handleError } from '@api/utils/errors';

export const enterpriseDingtalkRouter = new Hono()
  .use('*', async (c, next) => {
    if (!c.get('user') || !z.uuid().safeParse(c.req.header('cio-org-id')).success)
      return c.json(
        { success: false, error: 'Organization and session required', code: ErrorCodes.VALIDATION_ERROR },
        400
      );

    await next();
  })
  .get('/', async (c) => {
    try {
      const data = await getDingtalkDirectoryStatus(c.req.header('cio-org-id')!, c.get('user')!.id);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .post('/preview', async (c) => {
    try {
      const data = await previewDingtalkDirectory(c.req.header('cio-org-id')!, c.get('user')!.id);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .post('/sync', zValidator('json', ZDingtalkDirectorySync), async (c) => {
    try {
      const data = await syncDingtalkDirectory(c.req.header('cio-org-id')!, c.get('user')!.id, c.req.valid('json'));
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  });
