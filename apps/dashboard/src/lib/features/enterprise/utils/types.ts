import { classroomio, type InferRequestType, type InferResponseType } from '$lib/utils/services/api';

export type EnterpriseOverviewRequest = typeof classroomio.enterprise.overview.$get;
export type EnterpriseEmployeesRequest = typeof classroomio.enterprise.employees.$get;
export type EnterpriseGradingQueueRequest = (typeof classroomio.enterprise)['grading-queue']['$get'];

export type EnterpriseOverview = Extract<InferResponseType<EnterpriseOverviewRequest>, { success: true }>['data'];
export type EnterpriseEmployees = Extract<InferResponseType<EnterpriseEmployeesRequest>, { success: true }>['data'];
export type EnterpriseGradingQueue = Extract<
  InferResponseType<EnterpriseGradingQueueRequest>,
  { success: true }
>['data'];
export type EnterpriseEmployee = EnterpriseEmployees[number];
export type EnterpriseDepartment = EnterpriseOverview['departments'][number];
export type EnterpriseRole = EnterpriseOverview['roles'][number];

export type GetTrainingPlansRequest = typeof classroomio.enterprise.plans.$get;
export type GetAvailableTrainingCoursesRequest = (typeof classroomio.enterprise)['training-courses']['$get'];
export type CreateTrainingPlanRequest = typeof classroomio.enterprise.plans.$post;
export type GetTrainingPlanRequest = (typeof classroomio.enterprise.plans)[':planId']['$get'];
export type PreviewTrainingPlanRequest = (typeof classroomio.enterprise.plans)[':planId']['preview']['$get'];
export type SupplementTrainingPlanRequest = (typeof classroomio.enterprise.plans)[':planId']['supplement']['$post'];

export type TrainingPlans = Extract<InferResponseType<GetTrainingPlansRequest>, { success: true }>['data'];
export type AvailableTrainingCourses = Extract<
  InferResponseType<GetAvailableTrainingCoursesRequest>,
  { success: true }
>['data'];
export type TrainingPlanDetail = Extract<InferResponseType<GetTrainingPlanRequest>, { success: true }>['data'];
export type TrainingPlanPreview = Extract<InferResponseType<PreviewTrainingPlanRequest>, { success: true }>['data'];
export type TrainingPlanDraft = InferRequestType<CreateTrainingPlanRequest>['json'];
export type TrainingPlanSupplement = InferRequestType<SupplementTrainingPlanRequest>['json'];

export type GetMyTrainingRequest = (typeof classroomio.enterprise)['my-training']['$get'];
export type MyTrainingAssignments = Extract<InferResponseType<GetMyTrainingRequest>, { success: true }>['data'];
export type MyTrainingAssignment = MyTrainingAssignments[number];

export type GetAssessmentRequest = (typeof classroomio.enterprise.plans)[':planId']['assessment']['$get'];
export type GetAssessmentExercisesRequest = (typeof classroomio.enterprise.plans)[':planId']['exercises']['$get'];
export type GetEnrollmentAssessmentRequest =
  (typeof classroomio.enterprise.enrollments)[':enrollmentId']['assessment']['$get'];
export type GetTrainingArchiveRequest = (typeof classroomio.enterprise.archive)['$get'];
export type GetTrainingArchiveSummaryRequest = (typeof classroomio.enterprise.archive)['summary']['$get'];
export type GetTrainingStatisticsRequest = (typeof classroomio.enterprise.statistics)['$get'];
export type GetTrainingMatrixRequest = (typeof classroomio.enterprise.matrix)['$get'];
export type UpdateAssessmentRequest = (typeof classroomio.enterprise.plans)[':planId']['assessment']['$put'];
export type SubmitTrainingEvaluationRequest =
  (typeof classroomio.enterprise.enrollments)[':enrollmentId']['evaluation']['$post'];

export type AssessmentScheme = Extract<InferResponseType<GetAssessmentRequest>, { success: true }>['data'];
export type AssessmentExercises = Extract<InferResponseType<GetAssessmentExercisesRequest>, { success: true }>['data'];
export type EnrollmentAssessment = Extract<
  InferResponseType<GetEnrollmentAssessmentRequest>,
  { success: true }
>['data'];
export type TrainingArchive = Extract<InferResponseType<GetTrainingArchiveRequest>, { success: true }>['data'];
export type TrainingArchiveSummary = Extract<
  InferResponseType<GetTrainingArchiveSummaryRequest>,
  { success: true }
>['data'];
export type TrainingStatistics = Extract<InferResponseType<GetTrainingStatisticsRequest>, { success: true }>['data'];
export type TrainingMatrix = Extract<InferResponseType<GetTrainingMatrixRequest>, { success: true }>['data'];
export type AssessmentDraft = InferRequestType<UpdateAssessmentRequest>['json'];
export type TrainingEvaluationDraft = InferRequestType<SubmitTrainingEvaluationRequest>['json'];
