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
    const validProtocol = url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost');
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
