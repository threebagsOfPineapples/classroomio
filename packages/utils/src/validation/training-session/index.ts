import { z } from 'zod';

export const ZTrainingSessionDraft = z
  .object({
    title: z.string().trim().min(1).max(200),
    courseId: z.uuid().nullable().optional(),
    planId: z.uuid().nullable().optional(),
    instructor: z.string().trim().max(2000).default(''),
    location: z.string().trim().max(2000).default(''),
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    checkinOpensAt: z.string().datetime({ offset: true }),
    checkinClosesAt: z.string().datetime({ offset: true }),
    memberIds: z.array(z.number().int().positive()).min(1).max(5000)
  })
  .strict()
  .refine((value) => Date.parse(value.endAt) > Date.parse(value.startAt), {
    path: ['endAt'],
    message: 'Invalid session dates'
  })
  .refine(
    (value) =>
      Date.parse(value.checkinClosesAt) > Date.parse(value.checkinOpensAt) &&
      Date.parse(value.checkinClosesAt) <= Date.parse(value.endAt),
    { path: ['checkinClosesAt'], message: 'Invalid check-in window' }
  );

export const ZTrainingSessionSelection = z
  .object({
    departmentIds: z.array(z.uuid()).max(200).default([]),
    memberIds: z.array(z.number().int().positive()).max(5000).default([])
  })
  .strict();
export const ZTrainingSessionCheckin = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();
export const ZTrainingSessionCorrection = z
  .object({
    memberId: z.number().int().positive(),
    action: z.enum(['PRESENT', 'LEAVE', 'REVOKE']),
    reason: z.string().trim().min(1).max(2000)
  })
  .strict();
export const ZTrainingSessionFilter = z.object({
  search: z.string().trim().max(200).default(''),
  status: z.enum(['ALL', 'PENDING', 'PRESENT', 'LATE', 'LEAVE', 'ABSENT']).default('ALL')
});
export type TTrainingSessionDraft = z.infer<typeof ZTrainingSessionDraft>;
export type TTrainingSessionSelection = z.infer<typeof ZTrainingSessionSelection>;
export type TTrainingSessionCorrection = z.infer<typeof ZTrainingSessionCorrection>;
export type TTrainingSessionFilter = z.infer<typeof ZTrainingSessionFilter>;
