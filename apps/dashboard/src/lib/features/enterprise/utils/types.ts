import { classroomio, type InferRequestType, type InferResponseType } from '$lib/utils/services/api';

export type EnterpriseOverviewRequest = typeof classroomio.enterprise.overview.$get;
export type EnterpriseEmployeesRequest = typeof classroomio.enterprise.employees.$get;

export type EnterpriseOverview = Extract<InferResponseType<EnterpriseOverviewRequest>, { success: true }>['data'];
export type EnterpriseEmployees = Extract<InferResponseType<EnterpriseEmployeesRequest>, { success: true }>['data'];
export type EnterpriseEmployee = EnterpriseEmployees[number];
export type EnterpriseDepartment = EnterpriseOverview['departments'][number];
export type EnterpriseRole = EnterpriseOverview['roles'][number];

export type GetTrainingPlansRequest = typeof classroomio.enterprise.plans.$get;
export type GetAvailableTrainingCoursesRequest = (typeof classroomio.enterprise)['training-courses']['$get'];
export type CreateTrainingPlanRequest = typeof classroomio.enterprise.plans.$post;
export type GetTrainingPlanRequest = (typeof classroomio.enterprise.plans)[':planId']['$get'];
export type PreviewTrainingPlanRequest = (typeof classroomio.enterprise.plans)[':planId']['preview']['$get'];

export type TrainingPlans = Extract<InferResponseType<GetTrainingPlansRequest>, { success: true }>['data'];
export type AvailableTrainingCourses = Extract<
  InferResponseType<GetAvailableTrainingCoursesRequest>,
  { success: true }
>['data'];
export type TrainingPlanDetail = Extract<InferResponseType<GetTrainingPlanRequest>, { success: true }>['data'];
export type TrainingPlanPreview = Extract<InferResponseType<PreviewTrainingPlanRequest>, { success: true }>['data'];
export type TrainingPlanDraft = InferRequestType<CreateTrainingPlanRequest>['json'];
