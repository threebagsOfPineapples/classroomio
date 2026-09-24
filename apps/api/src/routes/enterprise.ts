import { Hono } from '@api/utils/hono';
import { authMiddleware } from '@api/middlewares/auth';
import { AppError, ErrorCodes, handleError } from '@api/utils/errors';
import {
  addEnterpriseDepartment,
  editEnterpriseDepartment,
  editEnterpriseEmployee,
  getEnterpriseEmployee,
  getEnterpriseEmployees,
  getEnterpriseOverview,
  setEnterpriseRoles
} from '@api/services/enterprise';
import {
  ZEnterpriseDepartment,
  ZEnterpriseDepartmentUpdate,
  ZEnterpriseEmployeeUpdate,
  ZEnterpriseRoles
} from '@cio/utils/validation/enterprise';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ZTrainingPlanDraft } from '@cio/utils/validation/training-plan';
import { getMyTraining } from '@api/services/my-training';
import {
  addTrainingPlan,
  editTrainingPlan,
  getAvailableTrainingCourses,
  getTrainingPlanById,
  getTrainingPlans,
  previewTrainingPlan,
  publishTrainingPlan
} from '@api/services/training-plan';

function enterpriseRequest(c: {
  req: { header: (name: string) => string | undefined; param: (name: string) => string };
  get: (name: 'user') => { id: string } | null;
}) {
  const profileId = c.get('user')?.id;
  const organizationId = c.req.header('cio-org-id');
  if (!profileId || !organizationId || !z.uuid().safeParse(organizationId).success) {
    throw new AppError('Organization and session required', ErrorCodes.VALIDATION_ERROR, 400);
  }

  return { profileId, organizationId };
}

function memberIdParam(raw: string) {
  const parsed = z.coerce.number().int().positive().safeParse(raw);
  if (!parsed.success) throw new AppError('Invalid member ID', ErrorCodes.VALIDATION_ERROR, 400);

  return parsed.data;
}

function departmentIdParam(raw: string) {
  const parsed = z.uuid().safeParse(raw);
  if (!parsed.success) throw new AppError('Invalid department ID', ErrorCodes.VALIDATION_ERROR, 400);

  return parsed.data;
}

function planIdParam(raw: string) {
  const parsed = z.uuid().safeParse(raw);
  if (!parsed.success) throw new AppError('Invalid training plan ID', ErrorCodes.VALIDATION_ERROR, 400);

  return parsed.data;
}

export const enterpriseRouter = new Hono()
  .use('*', authMiddleware)
  .get('/overview', async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const data = await getEnterpriseOverview(organizationId, profileId);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .get('/employees', async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const data = await getEnterpriseEmployees(organizationId, profileId);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .get('/employees/:memberId', async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const memberId = memberIdParam(c.req.param('memberId'));
      const data = await getEnterpriseEmployee(organizationId, profileId, memberId);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .put('/employees/:memberId', zValidator('json', ZEnterpriseEmployeeUpdate), async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const memberId = memberIdParam(c.req.param('memberId'));
      const values = c.req.valid('json');
      const data = await editEnterpriseEmployee(organizationId, profileId, memberId, values);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .put('/employees/:memberId/roles', zValidator('json', ZEnterpriseRoles), async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const memberId = memberIdParam(c.req.param('memberId'));
      const values = c.req.valid('json');
      const data = await setEnterpriseRoles(organizationId, profileId, memberId, values);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .post('/departments', zValidator('json', ZEnterpriseDepartment), async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const values = c.req.valid('json');
      const data = await addEnterpriseDepartment(organizationId, profileId, values);
      return c.json({ success: true, data }, 201);
    } catch (error) {
      return handleError(c, error);
    }
  })
  .put('/departments/:departmentId', zValidator('json', ZEnterpriseDepartmentUpdate), async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const departmentId = departmentIdParam(c.req.param('departmentId'));
      const values = c.req.valid('json');
      const data = await editEnterpriseDepartment(organizationId, profileId, departmentId, values);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .get('/plans', async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const data = await getTrainingPlans(organizationId, profileId);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .get('/training-courses', async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const data = await getAvailableTrainingCourses(organizationId, profileId);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .get('/my-training', async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const data = await getMyTraining(organizationId, profileId);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .post('/plans', zValidator('json', ZTrainingPlanDraft), async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const data = await addTrainingPlan(organizationId, profileId, c.req.valid('json'));
      return c.json({ success: true, data }, 201);
    } catch (error) {
      return handleError(c, error);
    }
  })
  .get('/plans/:planId', async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const planId = planIdParam(c.req.param('planId'));
      const data = await getTrainingPlanById(organizationId, profileId, planId);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .put('/plans/:planId', zValidator('json', ZTrainingPlanDraft), async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const planId = planIdParam(c.req.param('planId'));
      const data = await editTrainingPlan(organizationId, profileId, planId, c.req.valid('json'));
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .get('/plans/:planId/preview', async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const planId = planIdParam(c.req.param('planId'));
      const data = await previewTrainingPlan(organizationId, profileId, planId);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .post('/plans/:planId/publish', async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const planId = planIdParam(c.req.param('planId'));
      const data = await publishTrainingPlan(organizationId, profileId, planId);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  });
