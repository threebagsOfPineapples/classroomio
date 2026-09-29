export function getInternalTrainingRedirect(url: URL): string | null {
  const pathname = url.pathname.replace(/\/$/, '') || '/';
  const isCourseInvitation = /^\/course\/[^/]+\/enroll$/.test(pathname) && url.searchParams.has('invite_token');
  if (isCourseInvitation) return null;

  if (pathname === '/') return '/lms';

  if (/^\/(?:course|courses$|pages|widgets|widget-preview)(?:\/|$)/.test(pathname)) return '/lms/explore';

  if (/^\/org\/[^/]+\/audience\/import(?:\/|$)/.test(pathname)) return '/admin?view=employees';

  const retiredOrgPage = pathname.match(
    /^\/org\/([^/]+)\/(?:landingpage|widgets|automation|settings\/billing)(?:\/|$)/
  );
  if (retiredOrgPage) return `/org/${retiredOrgPage[1]}/courses`;

  return null;
}
