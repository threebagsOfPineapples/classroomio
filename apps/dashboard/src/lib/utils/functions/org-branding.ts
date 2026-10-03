import type { AccountOrg } from '$features/app/types';

type OrganizationBranding = Pick<AccountOrg, 'favicon' | 'avatarUrl'> | null | undefined;

const DEFAULT_FAVICON = '/enterprise-training-favicon.png';
const DEFAULT_LOGO = '/enterprise-training-icon.png';

function resolveBrandImageHref(rawHref: string | null | undefined, pageOrigin?: string): string | null {
  const imageHref = rawHref?.trim();
  if (!imageHref) {
    return null;
  }

  try {
    const imageUrl = new URL(imageHref, pageOrigin || 'https://localhost');
    if (imageUrl.protocol !== 'http:' && imageUrl.protocol !== 'https:') {
      return null;
    }

    return pageOrigin || /^https?:\/\//i.test(imageHref) ? imageUrl.href : imageHref;
  } catch {
    return null;
  }
}

export function getOrgFaviconHref(org: OrganizationBranding, pageOrigin?: string): string {
  return (
    resolveBrandImageHref(org?.favicon, pageOrigin) ||
    resolveBrandImageHref(org?.avatarUrl, pageOrigin) ||
    resolveBrandImageHref(DEFAULT_FAVICON, pageOrigin) ||
    DEFAULT_FAVICON
  );
}

export function getOrgLogoHref(org: Pick<AccountOrg, 'avatarUrl'> | null | undefined, pageOrigin?: string): string {
  return (
    resolveBrandImageHref(org?.avatarUrl, pageOrigin) || resolveBrandImageHref(DEFAULT_LOGO, pageOrigin) || DEFAULT_LOGO
  );
}
