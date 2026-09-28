import { classroomio, type InferResponseType } from '$lib/utils/services/api';

export type GetPendingOrgInviteRequest = (typeof classroomio.invite.organization)['pending']['$get'];
type GetPendingOrgInviteResponse = Extract<InferResponseType<GetPendingOrgInviteRequest>, { success: true }>;
export type PendingOrgInvite = NonNullable<GetPendingOrgInviteResponse['data']>;

export type GetLMSExercisesRequest = (typeof classroomio.organization)[':orgId']['exercises']['lms']['$get'];
export type GetLMSExercisesSuccess = Extract<InferResponseType<GetLMSExercisesRequest>, { success: true }>;
export type LMSExercise = GetLMSExercisesSuccess['data'][number];
export type LMSExercises = GetLMSExercisesSuccess['data'];
export type ExamAccess = Record<string, 'allowed' | 'denied' | 'unknown'>;
