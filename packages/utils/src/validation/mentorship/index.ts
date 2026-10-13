import { z } from 'zod';

const memberId = z.number().int().positive();
const content = z.string().trim().min(1).max(12000);
const timestamp = z.iso.datetime({ offset: true });
export const ZMentorshipBulk = z
  .object({
    learnerMemberIds: z.array(memberId).min(1).max(200),
    mentorMemberId: memberId,
    planId: z.uuid().nullable().default(null),
    startsAt: timestamp,
    endsAt: timestamp
  })
  .refine(
    (value) =>
      new Set(value.learnerMemberIds).size === value.learnerMemberIds.length &&
      !value.learnerMemberIds.includes(value.mentorMemberId) &&
      Date.parse(value.endsAt) > Date.parse(value.startsAt),
    'Invalid relationship members or dates'
  );
export const ZMentorshipChangeMentor = z.object({ mentorMemberId: memberId, reason: content });
export const ZMentorshipTask = z
  .object({
    relationIds: z.array(z.uuid()).min(1).max(200),
    title: z.string().trim().min(1).max(200),
    objective: content,
    scoringCriteria: content,
    dueAt: timestamp,
    courseId: z.uuid().nullable().default(null),
    exerciseId: z.uuid().nullable().default(null),
    submissionType: z.enum(['TEXT', 'CONFIRMATION']).default('TEXT'),
    maxScore: z.number().int().min(1).max(10000).default(100),
    passScore: z.number().int().min(0).default(60),
    requiresSupervisorReview: z.boolean().default(false),
    reviewerMemberId: memberId.nullable().default(null),
    certifier: z.enum(['MENTOR', 'REVIEWER']).default('MENTOR')
  })
  .refine(
    (value) =>
      value.passScore <= value.maxScore &&
      (!value.requiresSupervisorReview || value.reviewerMemberId !== null) &&
      (value.requiresSupervisorReview || (value.reviewerMemberId === null && value.certifier === 'MENTOR')) &&
      (!value.exerciseId || value.courseId !== null),
    'Invalid score, reference, review or certification configuration'
  );
export const ZMentorshipSubmission = z.object({
  expectedRevision: z.number().int().min(0),
  content: z.string().trim().max(12000).default(''),
  confirmed: z.literal(true)
});
export const ZMentorshipReview = z.object({
  expectedRevision: z.number().int().min(0),
  submissionId: z.uuid(),
  decision: z.enum(['PASS', 'RETURN']),
  score: z.number().int().min(0).nullable().default(null),
  content,
  observedAt: timestamp.nullable().default(null)
});
export const ZMentorshipSupervisorReview = z.object({
  expectedRevision: z.number().int().min(0),
  submissionId: z.uuid(),
  reviewId: z.uuid(),
  decision: z.enum(['PASS', 'RETURN']),
  content
});
export const ZMentorshipCertification = z.object({
  expectedRevision: z.number().int().min(0),
  submissionId: z.uuid(),
  reviewId: z.uuid(),
  content
});
export const ZMentorshipFilter = z.object({
  state: z
    .enum(['LEARNER_PENDING', 'MENTOR_PENDING', 'RETURNED', 'SUPERVISOR_PENDING', 'READY_TO_CERTIFY', 'CERTIFIED'])
    .optional(),
  dueBefore: timestamp.optional()
});
export type TMentorshipBulk = z.infer<typeof ZMentorshipBulk>;
export type TMentorshipTask = z.infer<typeof ZMentorshipTask>;
export type TMentorshipSubmission = z.infer<typeof ZMentorshipSubmission>;
export type TMentorshipReview = z.infer<typeof ZMentorshipReview>;
export type TMentorshipSupervisorReview = z.infer<typeof ZMentorshipSupervisorReview>;
export type TMentorshipCertification = z.infer<typeof ZMentorshipCertification>;
export type TMentorshipFilter = z.infer<typeof ZMentorshipFilter>;
