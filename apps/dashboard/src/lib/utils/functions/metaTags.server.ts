import type { MetaTagsProps } from 'svelte-meta-tags';
import type { OrgSiteInfo } from '$features/app/layout-setup';
import { PUBLIC_IS_SELFHOSTED } from '$env/static/public';
import { env as publicEnv } from '$env/dynamic/public';
import { buildOrgSiteTitle, extractOrgSiteMetaCopy } from '$lib/utils/functions/org-site-meta';
import { resolveOrgSiteOgImageUrl } from '$lib/utils/functions/org-site-og-url';
import messages from '$lib/utils/translations/zh.json';

const isSelfHosted = PUBLIC_IS_SELFHOSTED === 'true';

const DEFAULT_TITLE = `${messages.enterprise.title} · ${messages.enterprise.company_name}`;
const DEFAULT_DESCRIPTION = messages.enterprise.platform_description;
const CLOUD_OG_IMAGE = 'https://brand.cdn.clsrio.com/og/classroomio-opengraph.jpg';
const ORG_OG_WIDTH = 1200;
const ORG_OG_HEIGHT = 630;

async function resolveOgImageUrl(url: URL, orgSiteInfo: OrgSiteInfo): Promise<string> {
  const envUrl = publicEnv.PUBLIC_OG_IMAGE_URL?.trim();
  if (envUrl) {
    return envUrl;
  }

  if (orgSiteInfo.isOrgSite && orgSiteInfo.org?.siteName) {
    const dynamicOgUrl = await resolveOrgSiteOgImageUrl({
      siteName: orgSiteInfo.org.siteName,
      pageOrigin: url.origin,
      isSelfHosted,
      mediaCdnUrl: publicEnv.PUBLIC_MEDIA_CDN_URL,
      publicServerUrl: publicEnv.PUBLIC_SERVER_URL
    });
    if (dynamicOgUrl) {
      return dynamicOgUrl;
    }
  }

  if (isSelfHosted) {
    const org = orgSiteInfo.org;
    if (!org) {
      return new URL('/enterprise-training-icon.png', url.origin).href;
    }

    const orgImage =
      org.avatarUrl ||
      org.landingpage?.header?.banner?.image ||
      (org as { customization?: { dashboard?: { bannerImage?: string } } }).customization?.dashboard?.bannerImage;
    if (orgImage) {
      try {
        return new URL(orgImage, url.origin).href;
      } catch {}
    }

    return new URL('/enterprise-training-icon.png', url.origin).href;
  }

  return CLOUD_OG_IMAGE;
}

function buildOrgOpenGraphImages(ogImageUrl: string, orgName: string) {
  return [
    {
      url: ogImageUrl,
      alt: `${orgName} · ${messages.enterprise.title}`,
      width: ORG_OG_WIDTH,
      height: ORG_OG_HEIGHT,
      secureUrl: ogImageUrl.startsWith('https://') ? ogImageUrl : undefined,
      type: 'image/png'
    }
  ];
}

function resolveOrgSiteMeta(orgSiteInfo: OrgSiteInfo): {
  title: string;
  description: string;
  siteName: string;
} | null {
  const org = orgSiteInfo.org;
  if (!orgSiteInfo.isOrgSite || !org?.name?.trim()) {
    return null;
  }

  const orgName = org.name.trim();
  const metaCopy = extractOrgSiteMetaCopy(org.landingpage);

  return {
    title:
      publicEnv.PUBLIC_APP_TITLE?.trim() || buildOrgSiteTitle(orgName, metaCopy.heading || messages.enterprise.title),
    description: publicEnv.PUBLIC_APP_DESCRIPTION?.trim() || metaCopy.description || DEFAULT_DESCRIPTION,
    siteName: orgName
  };
}

export async function getBaseMetaTags(url: URL, orgSiteInfo: OrgSiteInfo): Promise<MetaTagsProps> {
  const orgMeta = resolveOrgSiteMeta(orgSiteInfo);

  const title =
    orgMeta?.title ||
    publicEnv.PUBLIC_APP_TITLE?.trim() ||
    (orgSiteInfo.org?.name ? `${messages.enterprise.title} · ${orgSiteInfo.org.name}` : DEFAULT_TITLE);

  const description = orgMeta?.description || publicEnv.PUBLIC_APP_DESCRIPTION?.trim() || DEFAULT_DESCRIPTION;

  const siteName =
    orgMeta?.siteName ||
    publicEnv.PUBLIC_APP_TITLE?.trim() ||
    (isSelfHosted && orgSiteInfo.org?.name ? orgSiteInfo.org.name : null) ||
    messages.enterprise.company_name;

  const ogImageUrl = await resolveOgImageUrl(url, orgSiteInfo);
  const usesDynamicOrgOg =
    orgSiteInfo.isOrgSite && Boolean(orgSiteInfo.org?.siteName) && !publicEnv.PUBLIC_OG_IMAGE_URL?.trim();

  const openGraphImages =
    usesDynamicOrgOg || isSelfHosted
      ? buildOrgOpenGraphImages(ogImageUrl, siteName)
      : [
          {
            url: ogImageUrl,
            alt: `${siteName} platform for customer, partner, and employee education`,
            width: 1920,
            height: 1080,
            secureUrl: ogImageUrl.startsWith('https://') ? ogImageUrl : undefined,
            type: 'image/jpeg'
          },
          {
            url: 'https://brand.cdn.clsrio.com/og/classroomio-opengraph.webp',
            alt: `${siteName} platform for customer, partner, and employee education`,
            width: 1920,
            height: 1080,
            secureUrl: 'https://brand.cdn.clsrio.com/og/classroomio-opengraph.webp',
            type: 'image/webp'
          }
        ];

  const imageAlt = `${siteName} · ${messages.enterprise.title}`;

  return Object.freeze({
    title,
    description,
    canonical: new URL(url.pathname, url.origin).href,
    openGraph: {
      type: 'website',
      url: new URL(url.pathname, url.origin).href,
      locale: 'zh_CN',
      title,
      description,
      siteName,
      images: openGraphImages
    },
    twitter: {
      ...(!isSelfHosted ? { handle: '@classroomio', site: '@classroomio' } : {}),
      cardType: 'summary_large_image' as const,
      title,
      description,
      image: ogImageUrl,
      imageAlt
    }
  });
}
