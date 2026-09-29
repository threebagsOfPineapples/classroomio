import type { MiddlewareHandler } from 'hono';

export function isRetiredTrainingApi(pathname: string) {
  return (
    /^\/org-site\/course(?:\/|$)/.test(pathname) ||
    /^\/widgets(?:\/|$)/.test(pathname) ||
    /^\/organization\/(?:widgets|courses\/public|tags\/public)(?:\/|$)/.test(pathname) ||
    /^\/course\/slug(?:\/|$)/.test(pathname) ||
    /^\/course\/[^/]+\/(?:payment-request|landing-page)(?:\/|$)/.test(pathname)
  );
}

export const internalTrainingMiddleware: MiddlewareHandler = async (context, next) => {
  if (isRetiredTrainingApi(context.req.path)) {
    return context.json({ success: false, error: '企业培训已停用公开展示及付费报名入口', code: 'NOT_FOUND' }, 410);
  }

  await next();
};
