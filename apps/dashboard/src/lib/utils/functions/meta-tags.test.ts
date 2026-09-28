import { afterEach, expect, it, vi } from 'vitest';
import { getBaseMetaTags } from './metaTags.server';

const { publicEnvironment } = vi.hoisted(() => {
  const publicEnvironment: Record<string, string | undefined> = {};
  return { publicEnvironment };
});

vi.mock('$env/static/public', () => ({ PUBLIC_IS_SELFHOSTED: 'true' }));
vi.mock('$env/dynamic/public', () => ({ env: publicEnvironment }));

afterEach(() => {
  for (const key of Object.keys(publicEnvironment)) delete publicEnvironment[key];
});

it('uses Chinese company metadata before organization data is available', async () => {
  const metadata = await getBaseMetaTags(new URL('http://localhost:4173/login'), {
    isOrgSite: false,
    org: null,
    subdomain: '',
    orgSiteName: ''
  });

  expect(metadata.title).toBe('企业培训管理 · 河南至臻数字生活科技有限公司');
  expect(metadata.description).toBe('统一管理员工培训、课程学习、考核、学习档案与证书。');
  expect(metadata.openGraph?.locale).toBe('zh_CN');
  expect(metadata.openGraph?.siteName).toBe('河南至臻数字生活科技有限公司');
  expect(metadata.openGraph?.images).toHaveLength(1);
  expect(metadata.openGraph?.images?.[0].url).toBe('http://localhost:4173/enterprise-training-icon.png');
  expect(metadata.twitter?.handle).toBeUndefined();
  expect(metadata.twitter?.site).toBeUndefined();
});

it('preserves operator metadata overrides', async () => {
  publicEnvironment.PUBLIC_APP_TITLE = '内部学习中心';
  publicEnvironment.PUBLIC_APP_DESCRIPTION = '本企业课程与培训';
  publicEnvironment.PUBLIC_OG_IMAGE_URL = 'https://training.example.com/company.png';
  const metadata = await getBaseMetaTags(new URL('https://training.example.com/'), {
    isOrgSite: false,
    org: null,
    subdomain: '',
    orgSiteName: ''
  });

  expect(metadata.title).toBe('内部学习中心');
  expect(metadata.description).toBe('本企业课程与培训');
  expect(metadata.openGraph?.images?.[0].url).toBe('https://training.example.com/company.png');
});
