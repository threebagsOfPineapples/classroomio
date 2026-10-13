import { Hono } from '@api/utils/hono';
import { authMiddleware } from '@api/middlewares/auth';
import { AppError, ErrorCodes, handleError } from '@api/utils/errors';
import {
  assignMentorshipTasks,
  bindMentorships,
  certifyMentorshipTask,
  changeMentorshipMentor,
  exportMentorships,
  getMentorshipDetail,
  getMentorshipOptions,
  getMentorshipRelations,
  getMentorships,
  reviewMentorshipTask,
  submitMentorshipTask,
  supervisorReviewMentorshipTask
} from '@api/services/mentorship';
import {
  ZMentorshipBulk,
  ZMentorshipCertification,
  ZMentorshipChangeMentor,
  ZMentorshipFilter,
  ZMentorshipReview,
  ZMentorshipSubmission,
  ZMentorshipSupervisorReview,
  ZMentorshipTask
} from '@cio/utils/validation/mentorship';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

function identity(c: {
  req: { header: (name: string) => string | undefined };
  get: (name: 'user') => { id: string } | null;
}) {
  const organizationId = c.req.header('cio-org-id');
  const profileId = c.get('user')?.id;
  if (!organizationId || !profileId || !z.uuid().safeParse(organizationId).success) {
    throw new AppError('Organization and session required', ErrorCodes.VALIDATION_ERROR, 400);
  }

  return { organizationId, profileId };
}

function uuidParam(value: string) {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new AppError('Invalid mentorship ID', ErrorCodes.VALIDATION_ERROR, 400);

  return parsed.data;
}

export const enterpriseMentorshipsRouter = new Hono()
  .use('*', authMiddleware)
  .get('/', zValidator('query', ZMentorshipFilter), async (c) => {
    try {
      const actor = identity(c);
      const data = await getMentorships(actor.organizationId, actor.profileId, c.req.valid('query'));
      return c.json({ success: true as const, data });
    } catch (error) {
      return handleError(c, error, 'Failed to load mentorship tasks');
    }
  })
  .get('/options', async (c) => {
    try {
      const actor = identity(c);
      const data = await getMentorshipOptions(actor.organizationId, actor.profileId);
      return c.json({ success: true as const, data });
    } catch (error) {
      return handleError(c, error, 'Failed to load mentorship options');
    }
  })
  .get('/relations', async (c) => {
    try {
      const actor = identity(c);
      const data = await getMentorshipRelations(actor.organizationId, actor.profileId);
      return c.json({ success: true as const, data });
    } catch (error) {
      return handleError(c, error, 'Failed to load mentorship relationships');
    }
  })
  .get('/export', zValidator('query', ZMentorshipFilter), async (c) => {
    try {
      const actor = identity(c);
      const csv = await exportMentorships(actor.organizationId, actor.profileId, c.req.valid('query'));
      return c.body(csv, 200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="mentorships.csv"'
      });
    } catch (error) {
      return handleError(c, error, 'Failed to export mentorship tasks');
    }
  })
  .post('/relations/bulk', zValidator('json', ZMentorshipBulk), async (c) => {
    try {
      const actor = identity(c);
      const data = await bindMentorships(actor.organizationId, actor.profileId, c.req.valid('json'));
      return c.json({ success: true as const, data });
    } catch (error) {
      return handleError(c, error, 'Failed to bind mentorship relationships');
    }
  })
  .post('/relations/:id/change-mentor', zValidator('json', ZMentorshipChangeMentor), async (c) => {
    try {
      const actor = identity(c);
      const relationId = uuidParam(c.req.param('id'));
      const data = await changeMentorshipMentor(actor.organizationId, actor.profileId, relationId, c.req.valid('json'));
      return c.json({ success: true as const, data });
    } catch (error) {
      return handleError(c, error, 'Failed to change mentor');
    }
  })
  .post('/tasks', zValidator('json', ZMentorshipTask), async (c) => {
    try {
      const actor = identity(c);
      const data = await assignMentorshipTasks(actor.organizationId, actor.profileId, c.req.valid('json'));
      return c.json({ success: true as const, data });
    } catch (error) {
      return handleError(c, error, 'Failed to assign mentorship tasks');
    }
  })
  .get('/tasks/:id', async (c) => {
    try {
      const actor = identity(c);
      const taskId = uuidParam(c.req.param('id'));
      const data = await getMentorshipDetail(actor.organizationId, actor.profileId, taskId);
      return c.json({ success: true as const, data });
    } catch (error) {
      return handleError(c, error, 'Failed to load mentorship task');
    }
  })
  .post('/tasks/:id/submissions', zValidator('json', ZMentorshipSubmission), async (c) => {
    try {
      const actor = identity(c);
      const taskId = uuidParam(c.req.param('id'));
      const data = await submitMentorshipTask(actor.organizationId, actor.profileId, taskId, c.req.valid('json'));
      return c.json({ success: true as const, data });
    } catch (error) {
      return handleError(c, error, 'Failed to submit mentorship task');
    }
  })
  .post('/tasks/:id/reviews', zValidator('json', ZMentorshipReview), async (c) => {
    try {
      const actor = identity(c);
      const taskId = uuidParam(c.req.param('id'));
      const data = await reviewMentorshipTask(actor.organizationId, actor.profileId, taskId, c.req.valid('json'));
      return c.json({ success: true as const, data });
    } catch (error) {
      return handleError(c, error, 'Failed to review mentorship task');
    }
  })
  .post('/tasks/:id/supervisor-reviews', zValidator('json', ZMentorshipSupervisorReview), async (c) => {
    try {
      const actor = identity(c);
      const taskId = uuidParam(c.req.param('id'));
      const data = await supervisorReviewMentorshipTask(
        actor.organizationId,
        actor.profileId,
        taskId,
        c.req.valid('json')
      );
      return c.json({ success: true as const, data });
    } catch (error) {
      return handleError(c, error, 'Failed to verify mentorship review');
    }
  })
  .post('/tasks/:id/certifications', zValidator('json', ZMentorshipCertification), async (c) => {
    try {
      const actor = identity(c);
      const taskId = uuidParam(c.req.param('id'));
      const data = await certifyMentorshipTask(actor.organizationId, actor.profileId, taskId, c.req.valid('json'));
      return c.json({ success: true as const, data });
    } catch (error) {
      return handleError(c, error, 'Failed to certify mentorship task');
    }
  });
