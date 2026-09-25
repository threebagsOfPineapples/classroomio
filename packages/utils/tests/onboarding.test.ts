import { describe, expect, it } from 'vitest';
import { ZOnboardingCreateOrg, ZOnboardingUpdateMetadata } from '../src/validation/onboarding';

describe('Chinese organization onboarding', () => {
  it('accepts short Chinese names while rejecting blank names', () => {
    expect(
      ZOnboardingCreateOrg.safeParse({ fullname: '张三', orgName: '智云科技', siteName: 'org-1234567' }).success
    ).toBe(true);
    expect(
      ZOnboardingUpdateMetadata.safeParse({ fullname: '李四', goal: 'employees', source: 'articles' }).success
    ).toBe(true);
    expect(
      ZOnboardingCreateOrg.safeParse({ fullname: '  ', orgName: '智云科技', siteName: 'org-1234567' }).success
    ).toBe(false);
  });
});
