import { classroomio, type InferResponseType } from '$lib/utils/services/api';

export type EnterpriseOverviewRequest = typeof classroomio.enterprise.overview.$get;
export type EnterpriseEmployeesRequest = typeof classroomio.enterprise.employees.$get;

export type EnterpriseOverview = Extract<InferResponseType<EnterpriseOverviewRequest>, { success: true }>['data'];
export type EnterpriseEmployees = Extract<InferResponseType<EnterpriseEmployeesRequest>, { success: true }>['data'];
export type EnterpriseEmployee = EnterpriseEmployees[number];
export type EnterpriseDepartment = EnterpriseOverview['departments'][number];
export type EnterpriseRole = EnterpriseOverview['roles'][number];
