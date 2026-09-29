import { z } from 'zod';

export const ZTrainingPlanTarget = z.discriminatedUnion('targetType', [
  z.object({
    targetType: z.literal('DEPARTMENT'),
    departmentId: z.uuid(),
    includeDescendants: z.boolean().default(true)
  }),
  z.object({ targetType: z.literal('POSITION'), position: z.string().trim().min(1).max(128) }),
  z.object({ targetType: z.literal('USER'), memberId: z.number().int().positive() })
]);

export const ZTrainingPlanDraft = z
  .object({
    name: z.string().trim().min(1).max(200),
    code: z.string().trim().min(1).max(64),
    description: z.string().trim().max(5000).nullable().optional(),
    year: z.number().int().min(2000).max(2100),
    planType: z.enum(['ANNUAL', 'QUARTERLY', 'MONTHLY', 'ONBOARDING', 'SPECIAL', 'MANDATORY', 'CUSTOM']),
    ownerMemberId: z.number().int().positive().optional(),
    departmentId: z.uuid().nullable().optional(),
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    passScore: z.number().int().min(0).max(100).nullable().optional(),
    courseIds: z.array(z.uuid()).min(1).max(100),
    targets: z.array(ZTrainingPlanTarget).min(1).max(100)
  })
  .refine((value) => Date.parse(value.endAt) >= Date.parse(value.startAt), {
    path: ['endAt'],
    message: 'End time must be after start time'
  });

export const ZTrainingPlanSupplement = z.object({
  memberIds: z.array(z.number().int().positive()).min(1).max(100)
});

export const ZTrainingPlanExtension = z.object({
  previousEndAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true })
});

export const ZLearningHeartbeat = z.object({ courseId: z.uuid() });

export type TTrainingPlanDraft = z.infer<typeof ZTrainingPlanDraft>;
export type TTrainingPlanTarget = z.infer<typeof ZTrainingPlanTarget>;

export const ZTrainingMakeup = z
  .object({
    exerciseId: z.uuid(),
    memberIds: z.array(z.number().int().positive()).min(1).max(100),
    opensAt: z.string().datetime({ offset: true }),
    closesAt: z.string().datetime({ offset: true })
  })
  .refine((value) => Date.parse(value.closesAt) > Date.parse(value.opensAt), {
    path: ['closesAt'],
    message: '补考截止时间必须晚于开始时间'
  });
export type TTrainingMakeup = z.infer<typeof ZTrainingMakeup>;
