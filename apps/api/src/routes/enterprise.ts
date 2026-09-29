import { ZTrainingMakeup } from '@cio/utils/validation/training-plan';
import { Hono } from '@api/utils/hono';
import { authMiddleware } from '@api/middlewares/auth';
import { AppError, ErrorCodes, handleError } from '@api/utils/errors';
import {
  addEnterpriseDepartment,
  editEnterpriseDepartment,
  editEnterpriseEmployee,
  getEnterpriseEmployee,
  getEnterpriseEmployees,
  getEnterpriseGradingQueue,
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
import {
  ZLearningHeartbeat,
  ZTrainingPlanDraft,
  ZTrainingPlanSupplement,
  ZTrainingPlanExtension
} from '@cio/utils/validation/training-plan';
import { getMyTraining, recordCourseLearning } from '@api/services/my-training';
import {
  adjustAssessmentScore,
  enterAssessmentInput,
  getEnrollmentAssessment,
  getPlanAssessment,
  getPlanAssessmentExercises,
  getTrainingArchive,
  getTrainingArchiveSummary,
  getTrainingMatrix,
  getTrainingStatistics,
  publishPlanAssessment,
  recalculateAssessment,
  savePlanAssessment,
  submitTrainingEvaluation
} from '@api/services/assessment';
import {
  ZAssessmentAdjustment,
  ZAssessmentInput,
  ZAssessmentSchemeDraft,
  ZTrainingEvaluation
} from '@cio/utils/validation/assessment';
import {
  addTrainingPlan,
  grantTrainingMakeup,
  remindTrainingPlan,
  extendTrainingPlan,
  editTrainingPlan,
  getAvailableTrainingCourses,
  getTrainingPlanById,
  getTrainingPlans,
  previewTrainingPlan,
  publishTrainingPlan,
  supplementTrainingPlan
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

function enrollmentIdParam(raw: string) {
  const parsed = z.uuid().safeParse(raw);
  if (!parsed.success) throw new AppError('Invalid training enrollment ID', ErrorCodes.VALIDATION_ERROR, 400);

  return parsed.data;
}

function itemIdParam(raw: string) {
  const parsed = z.uuid().safeParse(raw);
  if (!parsed.success) throw new AppError('Invalid assessment item ID', ErrorCodes.VALIDATION_ERROR, 400);

  return parsed.data;
}

function dateParam(raw: string | undefined) {
  if (!raw) return undefined;

  const parsed = z.iso.date().safeParse(raw);
  if (!parsed.success) throw new AppError('Invalid date', ErrorCodes.VALIDATION_ERROR, 400);

  return parsed.data;
}

export const enterpriseRouter = new Hono()
  .use('*', authMiddleware)
  .get('/grading-queue', async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const data = await getEnterpriseGradingQueue(organizationId, profileId);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
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
  .post('/learning/heartbeat', zValidator('json', ZLearningHeartbeat), async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const { courseId } = c.req.valid('json');
      await recordCourseLearning(organizationId, profileId, courseId);
      return c.json({ success: true, data: { recorded: true } });
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
  .post('/plans/:planId/extend', zValidator('json', ZTrainingPlanExtension), async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const planId = planIdParam(c.req.param('planId'));
      const { previousEndAt, endAt } = c.req.valid('json');
      const data = await extendTrainingPlan(organizationId, profileId, planId, previousEndAt, endAt);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .post('/plans/:planId/remind', async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const planId = planIdParam(c.req.param('planId'));
      const data = await remindTrainingPlan(organizationId, profileId, planId);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .post('/plans/:planId/makeup', zValidator('json', ZTrainingMakeup), async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const planId = planIdParam(c.req.param('planId'));
      const data = await grantTrainingMakeup(organizationId, profileId, planId, c.req.valid('json'));
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
  })
  .post('/plans/:planId/supplement', zValidator('json', ZTrainingPlanSupplement), async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const planId = planIdParam(c.req.param('planId'));
      const data = await supplementTrainingPlan(organizationId, profileId, planId, c.req.valid('json').memberIds);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .get('/plans/:planId/assessment', async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const data = await getPlanAssessment(organizationId, profileId, planIdParam(c.req.param('planId')));
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .get('/plans/:planId/exercises', async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const data = await getPlanAssessmentExercises(organizationId, profileId, planIdParam(c.req.param('planId')));
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .put('/plans/:planId/assessment', zValidator('json', ZAssessmentSchemeDraft), async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const data = await savePlanAssessment(
        organizationId,
        profileId,
        planIdParam(c.req.param('planId')),
        c.req.valid('json')
      );
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .post('/plans/:planId/assessment/publish', async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const data = await publishPlanAssessment(organizationId, profileId, planIdParam(c.req.param('planId')));
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .get('/plans/:planId/statistics', async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const from = dateParam(c.req.query('from'));
      const to = dateParam(c.req.query('to'));
      const data = await getTrainingStatistics(organizationId, profileId, planIdParam(c.req.param('planId')), from, to);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .get('/statistics', async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const from = dateParam(c.req.query('from'));
      const to = dateParam(c.req.query('to'));
      const data = await getTrainingStatistics(organizationId, profileId, undefined, from, to);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .get('/archive', async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const rawMemberId = c.req.query('memberId');
      const memberId = rawMemberId ? memberIdParam(rawMemberId) : undefined;
      const rawPlanId = c.req.query('planId');
      const planId = rawPlanId ? planIdParam(rawPlanId) : undefined;
      const data = await getTrainingArchive(organizationId, profileId, memberId, planId);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .get('/archive/summary', async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const rawMemberId = c.req.query('memberId');
      const memberId = rawMemberId ? memberIdParam(rawMemberId) : undefined;
      const data = await getTrainingArchiveSummary(organizationId, profileId, memberId);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .get('/matrix', async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const data = await getTrainingMatrix(organizationId, profileId);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .get('/enrollments/:enrollmentId/assessment', async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const data = await getEnrollmentAssessment(
        organizationId,
        profileId,
        enrollmentIdParam(c.req.param('enrollmentId'))
      );
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .post('/enrollments/:enrollmentId/assessment/recalculate', async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const data = await recalculateAssessment(
        organizationId,
        profileId,
        enrollmentIdParam(c.req.param('enrollmentId'))
      );
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .post('/enrollments/:enrollmentId/items/:itemId/input', zValidator('json', ZAssessmentInput), async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const enrollmentId = enrollmentIdParam(c.req.param('enrollmentId'));
      const itemId = itemIdParam(c.req.param('itemId'));
      const data = await enterAssessmentInput(
        organizationId,
        profileId,
        enrollmentId,
        itemId,
        c.req.valid('json').score
      );
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .post('/enrollments/:enrollmentId/assessment/adjust', zValidator('json', ZAssessmentAdjustment), async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const enrollmentId = enrollmentIdParam(c.req.param('enrollmentId'));
      const { amount, reason } = c.req.valid('json');
      const data = await adjustAssessmentScore(organizationId, profileId, enrollmentId, amount, reason);
      return c.json({ success: true, data });
    } catch (error) {
      return handleError(c, error);
    }
  })
  .post('/enrollments/:enrollmentId/evaluation', zValidator('json', ZTrainingEvaluation), async (c) => {
    try {
      const { organizationId, profileId } = enterpriseRequest(c);
      const data = await submitTrainingEvaluation(
        organizationId,
        profileId,
        enrollmentIdParam(c.req.param('enrollmentId')),
        c.req.valid('json')
      );
      return c.json({ success: true, data }, 201);
    } catch (error) {
      return handleError(c, error);
    }
  });
