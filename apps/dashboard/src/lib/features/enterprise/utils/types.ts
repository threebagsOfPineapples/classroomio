import { classroomio, type InferRequestType, type InferResponseType } from '$lib/utils/services/api';

export type DingtalkDirectoryStatusRequest = typeof classroomio.enterprise.dingtalk.$get;
export type DingtalkDirectoryPreviewRequest = typeof classroomio.enterprise.dingtalk.preview.$post;
export type DingtalkDirectorySyncRequest = typeof classroomio.enterprise.dingtalk.sync.$post;
export type DingtalkDirectoryStatus = Extract<
  InferResponseType<DingtalkDirectoryStatusRequest>,
  { success: true }
>['data'];
export type DingtalkDirectoryPreview = Extract<
  InferResponseType<DingtalkDirectoryPreviewRequest>,
  { success: true }
>['data'];
export type DingtalkDirectoryResult = Extract<
  InferResponseType<DingtalkDirectorySyncRequest>,
  { success: true }
>['data'];

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

export type ExtendTrainingPlanRequest = (typeof classroomio.enterprise.plans)[':planId']['extend']['$post'];
export type TrainingPlanExtension = InferRequestType<ExtendTrainingPlanRequest>['json'];

export type RemindTrainingPlanRequest = (typeof classroomio.enterprise.plans)[':planId']['remind']['$post'];
export type TrainingReminderResult = Extract<InferResponseType<RemindTrainingPlanRequest>, { success: true }>['data'];

export type GrantTrainingMakeupRequest = (typeof classroomio.enterprise.plans)[':planId']['makeup']['$post'];
export type TrainingMakeupDraft = InferRequestType<GrantTrainingMakeupRequest>['json'];
export type TrainingMakeupResult = Extract<InferResponseType<GrantTrainingMakeupRequest>, { success: true }>['data'];
