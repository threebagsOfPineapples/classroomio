import { z } from 'zod';

export const ZAssessmentSchemeDraft = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  passScore: z.number().int().min(0).max(100),
  items: z
    .array(
      z.object({
        type: z.enum(['EXAM', 'ASSIGNMENT', 'INSTRUCTOR', 'ATTENDANCE', 'PROGRESS', 'CUSTOM']),
        name: z.string().trim().min(1).max(200),
        weight: z.number().int().min(0).max(100),
        maxScore: z.number().positive().max(10000),
        required: z.boolean().default(true),
        exerciseId: z.uuid().nullable().optional()
      })
    )
    .min(1)
    .max(30)
});

export const ZAssessmentInput = z.object({ score: z.number().finite().min(0) });
export const ZAssessmentAdjustment = z.object({
  amount: z
    .number()
    .finite()
    .min(-100)
    .max(100)
    .refine((value) => value !== 0),
  reason: z.string().trim().min(3).max(2000)
});
export const ZTrainingEvaluation = z.object({
  contentRating: z.number().int().min(1).max(5),
  instructorRating: z.number().int().min(1).max(5),
  usefulnessRating: z.number().int().min(1).max(5),
  difficultyRating: z.number().int().min(1).max(5),
  satisfactionRating: z.number().int().min(1).max(5),
  helpfulContent: z.string().trim().max(5000).nullable().optional(),
  improvements: z.string().trim().max(5000).nullable().optional(),
  suggestions: z.string().trim().max(5000).nullable().optional()
});

export type TAssessmentSchemeDraft = z.infer<typeof ZAssessmentSchemeDraft>;
export type TTrainingEvaluation = z.infer<typeof ZTrainingEvaluation>;
