import { describe, expect, it, vi } from 'vitest';
import { authValidation } from './validator';

vi.mock('$lib/utils/functions/translations', () => ({ t: { get: (key: string) => key } }));

describe('login identifiers', () => {
  it('accepts a username only when the login form enables it', () => {
    expect(authValidation({ email: '  administrator  ' }, { skipPassword: true, allowUsername: true })).toEqual({});
    expect(authValidation({ email: 'administrator' }, { skipPassword: true })).toHaveProperty('email');
  });

  it.each(['', '   ', 'invalid@', 'x'.repeat(257)])('rejects an invalid account identifier', (email) => {
    expect(authValidation({ email }, { skipPassword: true, allowUsername: true })).toEqual({
      email: 'login.invalid_identifier'
    });
  });

  it('keeps email login and signup password validation', () => {
    expect(authValidation({ email: 'account@example.test' }, { skipPassword: true, allowUsername: true })).toEqual({});
    expect(authValidation({ email: 'account@example.test', password: 'short' })).toHaveProperty('password');
  });
});
