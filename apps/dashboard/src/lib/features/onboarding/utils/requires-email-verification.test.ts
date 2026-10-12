import { describe, expect, it } from 'vitest';
import { requiresEmailVerification } from './requires-email-verification';

describe('email verification for learning', () => {
  it('does not block an employee authenticated in the current DingTalk organization', () => {
    expect(requiresEmailVerification(false, 'training-org', 'training-org', false)).toBe(false);
  });

  it.each([
    ['training-org', null],
    ['another-org', 'training-org'],
    ['', 'training-org'],
    ['', null]
  ])('still requires verification without a matching company identity', (organizationId, dingtalkOrganizationId) => {
    expect(requiresEmailVerification(false, organizationId, dingtalkOrganizationId, false)).toBe(true);
  });

  it('retains access for email-verified native accounts', () => {
    expect(requiresEmailVerification(true, 'training-org', null, false)).toBe(false);
  });

  it('does not require email ownership verification for self-hosted native accounts', () => {
    expect(requiresEmailVerification(false, 'training-org', null, true)).toBe(false);
  });

  it('does not verify a placeholder email in self-hosted mode', () => {
    expect(requiresEmailVerification(false, 'training-org', 'training-org', true)).toBe(false);
  });
});
