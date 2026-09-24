import { z } from 'zod';

export const ZEnterpriseDepartment = z.object({
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().min(1).max(64),
  parentId: z.uuid().nullable().optional(),
  leaderMemberId: z.number().int().positive().nullable().optional(),
  sort: z.number().int().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
});

export const ZEnterpriseDepartmentUpdate = ZEnterpriseDepartment.partial();

export const ZEnterpriseEmployeeUpdate = z.object({
  employeeNo: z.string().trim().min(1).max(64).nullable().optional(),
  departmentId: z.uuid().nullable().optional(),
  position: z.string().trim().min(1).max(128).nullable().optional(),
  managerMemberId: z.number().int().positive().nullable().optional(),
  employmentStatus: z.enum(['ACTIVE', 'ON_LEAVE', 'TERMINATED']).nullable().optional(),
  joinDate: z.iso.date().nullable().optional(),
  externalSource: z.string().trim().min(1).max(64).nullable().optional(),
  externalId: z.string().trim().min(1).max(128).nullable().optional()
});

export const ZEnterpriseRoles = z.object({
  roles: z.array(z.enum(['SUPER_ADMIN', 'TRAINING_ADMIN', 'HR', 'DEPARTMENT_MANAGER', 'INSTRUCTOR', 'EMPLOYEE']))
});

export type TEnterpriseDepartment = z.infer<typeof ZEnterpriseDepartment>;
export type TEnterpriseDepartmentUpdate = z.infer<typeof ZEnterpriseDepartmentUpdate>;
export type TEnterpriseEmployeeUpdate = z.infer<typeof ZEnterpriseEmployeeUpdate>;
export type TEnterpriseRoles = z.infer<typeof ZEnterpriseRoles>;
