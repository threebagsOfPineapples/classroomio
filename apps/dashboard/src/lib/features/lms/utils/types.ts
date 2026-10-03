import { classroomio, type InferResponseType } from '$lib/utils/services/api';

export type GetPendingOrgInviteRequest = (typeof classroomio.invite.organization)['pending']['$get'];
type GetPendingOrgInviteResponse = Extract<InferResponseType<GetPendingOrgInviteRequest>, { success: true }>;
export type PendingOrgInvite = NonNullable<GetPendingOrgInviteResponse['data']>;

export type GetLMSExercisesRequest = (typeof classroomio.organization)[':orgId']['exercises']['lms']['$get'];
export type GetLMSExercisesSuccess = Extract<InferResponseType<GetLMSExercisesRequest>, { success: true }>;
export type LMSExercise = GetLMSExercisesSuccess['data'][number];
export type LMSExercises = GetLMSExercisesSuccess['data'];
export type ExamAccess = Record<string, 'allowed' | 'denied' | 'unknown'>;
export type LMSSubmission = LMSExercise['submission'][number];
export type ExamWindow = Pick<LMSExercise, 'opensAt' | 'closesAt'> &
  Partial<Pick<LMSExercise, 'canAttempt' | 'activeAttemptExpiresAt'>>;
export type AssessmentTaskState =
  | 'unknown'
  | 'upcoming'
  | 'ended'
  | 'unavailable'
  | 'open'
  | 'in_progress'
  | 'submitted'
  | 'graded';
export type AssessmentTaskAction = 'start' | 'continue' | 'retake' | 'result';
export type AssessmentTaskFilter = 'pending' | 'upcoming' | 'submitted' | 'graded' | 'all';
export type AssessmentTask = {
  exercise: LMSExercise;
  submission: LMSSubmission | undefined;
  state: AssessmentTaskState;
  submissionState: 'not_submitted' | 'grading' | 'submitted' | 'graded';
  action: AssessmentTaskAction | null;
  access: ExamAccess[string];
  href: string;
  totalPoints: number;
};
