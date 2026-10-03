import { describe, expect, it } from 'vitest';
import { getOrgFaviconHref, getOrgLogoHref } from './org-branding';

describe('organization branding', () => {
  const pageOrigin = 'http://localhost:4174';

  it('uses the organization favicon before its uploaded logo', () => {
    expect(getOrgFaviconHref({ favicon: '/uploads/favicon.png', avatarUrl: '/uploads/logo.png' }, pageOrigin)).toBe(
      `${pageOrigin}/uploads/favicon.png`
    );
  });

  it('uses the uploaded organization logo when no favicon is configured', () => {
    expect(getOrgFaviconHref({ favicon: ' ', avatarUrl: 'https://assets.example.com/company.png' }, pageOrigin)).toBe(
      'https://assets.example.com/company.png'
    );
  });

  it('supplies the enterprise favicon when an organization has no uploaded images', () => {
    expect(getOrgFaviconHref(null, pageOrigin)).toBe(`${pageOrigin}/enterprise-training-favicon.png`);
    expect(getOrgFaviconHref({ favicon: '', avatarUrl: '' })).toBe('/enterprise-training-favicon.png');
  });

  it('skips invalid favicon schemes and uses a valid uploaded logo', () => {
    expect(getOrgFaviconHref({ favicon: 'javascript:alert(1)', avatarUrl: '/uploads/company.png' }, pageOrigin)).toBe(
      `${pageOrigin}/uploads/company.png`
    );
  });

  it('rejects an invalid logo scheme before using the enterprise logo', () => {
    expect(getOrgLogoHref({ avatarUrl: 'file:///private/logo.png' }, pageOrigin)).toBe(
      `${pageOrigin}/enterprise-training-icon.png`
    );
  });

  it('uses an uploaded organization logo in app branding', () => {
    expect(getOrgLogoHref({ avatarUrl: ' /uploads/company.png ' })).toBe('/uploads/company.png');
  });
});
