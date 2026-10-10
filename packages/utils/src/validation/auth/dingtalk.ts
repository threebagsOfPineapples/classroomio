import { z } from 'zod';

export const ZDingtalkError = z.enum([
  'disabled',
  'invalid_state',
  'wrong_company',
  'provider_error',
  'link_required',
  'account_conflict',
  'member_inactive',
  'reauth_required'
]);

export const ZDingtalkConfig = z.object({
  corpId: z.string().trim().min(1).max(50),
  clientId: z.string().trim().min(1).max(256),
  clientSecret: z.string().trim().min(1).max(512),
  organizationId: z.uuid(),
  redirectUri: z.url().refine((value) => {
    const url = new URL(value);
    const addressParts = url.hostname.split('.').map(Number);
    const isIpv4 =
      addressParts.length === 4 && addressParts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255);
    const isPrivateAddress =
      isIpv4 &&
      (addressParts[0] === 10 ||
        (addressParts[0] === 172 && addressParts[1] >= 16 && addressParts[1] <= 31) ||
        (addressParts[0] === 192 && addressParts[1] === 168));
    const validProtocol =
      url.protocol === 'https:' || (url.protocol === 'http:' && (url.hostname === 'localhost' || isPrivateAddress));
    const validPath = ['/api/auth/dingtalk/callback', '/proxy/api/auth/dingtalk/callback'].includes(url.pathname);
    return validProtocol && validPath && !url.username && !url.password && !url.search && !url.hash;
  })
});

export const ZDingtalkStart = z.object({
  organizationId: z.uuid().optional(),
  intent: z.enum(['login', 'link'])
});

export const ZDingtalkState = ZDingtalkStart.extend({
  organizationId: z.uuid(),
  profileId: z.uuid().nullable(),
  clientId: z.string(),
  corpId: z.string()
});

export const ZDingtalkToken = z.object({
  accessToken: z.string().min(1),
  corpId: z.string().min(1)
});

export const ZDingtalkAppToken = z.object({
  accessToken: z.string().min(1),
  expireIn: z.number().positive()
});

export const ZDingtalkPersonalInfo = z.object({ unionId: z.string().min(1).max(128) });

export const ZDingtalkUserId = z.object({
  errcode: z.literal(0),
  result: z.object({ userid: z.string().min(1).max(128) })
});

export const ZDingtalkMember = z.object({
  errcode: z.literal(0),
  result: z.object({
    userid: z.string().min(1).max(128),
    unionid: z.string().min(1).max(128),
    name: z.string().min(1).max(256),
    mobile: z.string().max(64).nullish(),
    org_email: z.string().max(320).nullish(),
    job_number: z.string().max(128).nullish(),
    title: z.string().max(256).nullish(),
    dept_id_list: z.array(z.number().int().safe()).optional()
  })
});

export type TDingtalkConfig = z.infer<typeof ZDingtalkConfig>;
export type TDingtalkState = z.infer<typeof ZDingtalkState>;
export type TDingtalkError = z.infer<typeof ZDingtalkError>;

export const ZDingtalkRawDepartment = z.object({
  dept_id: z.number().int().positive().safe(),
  parent_id: z.number().int().nonnegative().safe(),
  name: z.string().trim().min(1).max(160),
  order: z.number().int().min(-2147483648).max(2147483647).optional()
});
export const ZDingtalkRawDepartments = z.array(ZDingtalkRawDepartment).max(1000);
export const ZDingtalkRawRootDepartment = ZDingtalkRawDepartment.omit({ parent_id: true });
export const ZDingtalkRawEmployee = z.object({
  userid: z.string().min(1).max(128),
  name: z.string().trim().min(1).max(256),
  job_number: z.string().max(128).nullish(),
  title: z.string().max(256).nullish(),
  org_email: z.string().max(320).nullish(),
  dept_id_list: z
    .array(z.number().int().positive().safe())
    .min(1)
    .max(200)
    .transform((ids) => [...new Set(ids)].sort((left, right) => left - right))
});
export const ZDingtalkRawEmployeePage = z.object({
  list: z.array(ZDingtalkRawEmployee).max(100),
  has_more: z.boolean(),
  next_cursor: z.number().int().nonnegative().safe().optional()
});
export type TDingtalkRawEmployee = z.infer<typeof ZDingtalkRawEmployee>;

export const ZDingtalkDirectoryError = z.enum([
  'disabled',
  'permissions',
  'provider_error',
  'invalid_directory',
  'expired',
  'changed'
]);

export const ZDingtalkDirectoryDepartment = z.object({
  id: z.number().int().positive().safe(),
  parentId: z.number().int().nonnegative().safe(),
  name: z.string().trim().min(1).max(160),
  sort: z.number().int().min(-2147483648).max(2147483647)
});

export const ZDingtalkDirectoryEmployee = z.object({
  userId: z.string().min(1).max(128),
  name: z.string().trim().min(1).max(256),
  employeeNo: z.string().max(128).nullable(),
  position: z.string().max(256).nullable(),
  companyEmail: z.string().max(320).nullable(),
  departmentIds: z.array(z.number().int().positive().safe()).min(1).max(200)
});

export const ZDingtalkDirectory = z
  .object({
    departments: z.array(ZDingtalkDirectoryDepartment).min(1).max(1000),
    employees: z.array(ZDingtalkDirectoryEmployee).max(10000)
  })
  .refine((directory) => {
    const departmentIds = new Set<number>();
    for (const department of directory.departments) {
      if (
        departmentIds.has(department.id) ||
        (departmentIds.size === 0
          ? department.id !== 1 || department.parentId !== 0
          : !departmentIds.has(department.parentId))
      )
        return false;

      departmentIds.add(department.id);
    }

    const employeeIds = new Set(directory.employees.map((employee) => employee.userId));
    return (
      employeeIds.size === directory.employees.length &&
      directory.employees.every((employee) => employee.departmentIds.every((id) => departmentIds.has(id)))
    );
  });

export const ZDingtalkDirectorySelection = z.object({
  userId: z.string().min(1).max(128),
  departmentId: z.number().int().positive().safe()
});

export const ZDingtalkDirectorySync = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/),
    selections: z.array(ZDingtalkDirectorySelection).max(10000)
  })
  .refine((value) => new Set(value.selections.map((selection) => selection.userId)).size === value.selections.length);

export const ZDingtalkDirectoryResult = z.object({
  departmentsCreated: z.number().int().nonnegative(),
  departmentsUpdated: z.number().int().nonnegative(),
  employeesCreated: z.number().int().nonnegative(),
  employeesUpdated: z.number().int().nonnegative()
});

export const ZDingtalkDirectorySnapshot = z.object({
  organizationId: z.uuid(),
  profileId: z.uuid(),
  corpId: z.string().min(1).max(50),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  directory: ZDingtalkDirectory,
  result: ZDingtalkDirectoryResult.nullable(),
  selectionHash: z.string().nullable()
});

export type TDingtalkDirectory = z.infer<typeof ZDingtalkDirectory>;
export type TDingtalkDirectorySelection = z.infer<typeof ZDingtalkDirectorySelection>;
export type TDingtalkDirectorySync = z.infer<typeof ZDingtalkDirectorySync>;
export type TDingtalkDirectoryResult = z.infer<typeof ZDingtalkDirectoryResult>;
export type TDingtalkDirectorySnapshot = z.infer<typeof ZDingtalkDirectorySnapshot>;
