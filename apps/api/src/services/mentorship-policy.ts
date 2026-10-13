export function isEffectiveMentorshipRelation(
  relation: { status: string; startsAt: string; endsAt: string },
  now = Date.now()
) {
  return relation.status === 'ACTIVE' && Date.parse(relation.startsAt) <= now && Date.parse(relation.endsAt) > now;
}

export function canMentorshipActorReview(actorMemberId: number, mentorMemberId: number, effectiveRelation: boolean) {
  return effectiveRelation && actorMemberId === mentorMemberId;
}

export function canMentorshipSupervisorReview(input: {
  actorMemberId: number;
  reviewerMemberId: number | null;
  requiresSupervisorReview: boolean;
  isSupervisor: boolean;
  learnerInScope: boolean;
}) {
  return (
    input.requiresSupervisorReview &&
    input.isSupervisor &&
    input.learnerInScope &&
    input.actorMemberId === input.reviewerMemberId
  );
}

export function isCurrentMentorshipSubmission(
  expectedRevision: number,
  taskRevision: number,
  submissionId: string,
  latestSubmissionId: string | undefined
) {
  return expectedRevision === taskRevision && submissionId === latestSubmissionId;
}

export function satisfiesMentorshipCertification(input: {
  state: string;
  reviewPassed: boolean;
  score: number | null;
  passScore: number;
  requiresSupervisorReview: boolean;
  supervisorPassed: boolean;
  courseComplete: boolean;
  examPassed: boolean;
}) {
  return (
    input.state === 'READY_TO_CERTIFY' &&
    input.reviewPassed &&
    input.score !== null &&
    input.score >= input.passScore &&
    (!input.requiresSupervisorReview || input.supervisorPassed) &&
    input.courseComplete &&
    input.examPassed
  );
}
