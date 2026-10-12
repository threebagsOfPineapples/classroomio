import { describe, expect, it } from 'vitest';
import { requiresEmailVerification } from './requires-email-verification';

describe('email verification for learning', () => {
  it('does not block an employee authenticated in the current DingTalk organization', () => {
    expect(requiresEmailVerification(false, 'training-org', 'training-org')).toBe(false);
  });

  it.each([
    ['training-org', null],
    ['another-org', 'training-org'],
    ['', 'training-org'],
    ['', null]
  ])('still requires verification without a matching company identity', (organizationId, dingtalkOrganizationId) => {
    expect(requiresEmailVerification(false, organizationId, dingtalkOrganizationId)).toBe(true);
  });

  it('retains access for email-verified native accounts', () => {
    expect(requiresEmailVerification(true, 'training-org', null)).toBe(false);
  });
});
