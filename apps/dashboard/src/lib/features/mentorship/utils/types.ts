import { classroomio, type InferResponseType } from '$lib/utils/services/api';

export type MentorshipListRequest = typeof classroomio.enterprise.mentorships.$get;
export type MentorshipOptionsRequest = typeof classroomio.enterprise.mentorships.options.$get;
export type MentorshipRelationsRequest = typeof classroomio.enterprise.mentorships.relations.$get;
export type MentorshipDetailRequest = (typeof classroomio.enterprise.mentorships.tasks)[':id']['$get'];
export type MentorshipBindRequest = typeof classroomio.enterprise.mentorships.relations.bulk.$post;
export type MentorshipAssignRequest = typeof classroomio.enterprise.mentorships.tasks.$post;
export type MentorshipChangeRequest =
  (typeof classroomio.enterprise.mentorships.relations)[':id']['change-mentor']['$post'];
export type MentorshipSubmitRequest = (typeof classroomio.enterprise.mentorships.tasks)[':id']['submissions']['$post'];
export type MentorshipReviewRequest = (typeof classroomio.enterprise.mentorships.tasks)[':id']['reviews']['$post'];
export type MentorshipSupervisorRequest =
  (typeof classroomio.enterprise.mentorships.tasks)[':id']['supervisor-reviews']['$post'];
export type MentorshipCertifyRequest =
  (typeof classroomio.enterprise.mentorships.tasks)[':id']['certifications']['$post'];
export type MentorshipList = Extract<InferResponseType<MentorshipListRequest>, { success: true }>['data'];
export type MentorshipOptions = Extract<InferResponseType<MentorshipOptionsRequest>, { success: true }>['data'];
export type MentorshipRelations = Extract<InferResponseType<MentorshipRelationsRequest>, { success: true }>['data'];
export type MentorshipDetail = Extract<InferResponseType<MentorshipDetailRequest>, { success: true }>['data'];
export type MentorshipChoice = { value: string; label: string };
export type MentorshipState = MentorshipList[number]['task']['state'];
export type MentorshipBindingDraft = {
  mentorMemberId: string;
  planId: string;
  startsAt: string;
  endsAt: string;
  search: string;
  learnerMemberIds: number[];
};
export type MentorshipTaskDraft = {
  title: string;
  objective: string;
  scoringCriteria: string;
  dueAt: string;
  courseId: string;
  exerciseId: string;
  submissionType: 'TEXT' | 'CONFIRMATION';
  maxScore: number;
  passScore: number;
  requiresSupervisorReview: boolean;
  reviewerMemberId: string;
  certifier: 'MENTOR' | 'REVIEWER';
  relationIds: string[];
};
