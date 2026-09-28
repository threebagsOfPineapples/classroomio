import { describe, expect, it } from 'vitest';

import { parseCspDomains } from './csp';
import { getCspDomains } from './csp-domains.js';

it('allows the feedback SDK stylesheet only in the SaaS defaults', () => {
  expect(getCspDomains(false, undefined).styleSrc).toContain('https://cdn.userjot.com');
  expect(getCspDomains(true, undefined).styleSrc).not.toContain('https://cdn.userjot.com');
});

describe('parseCspDomains', () => {
  it('returns an empty list for missing or blank input', () => {
    expect(parseCspDomains(undefined)).toEqual([]);
    expect(parseCspDomains('')).toEqual([]);
    expect(parseCspDomains('   ')).toEqual([]);
    expect(parseCspDomains(', ,')).toEqual([]);
  });

  it('preserves special CSP source tokens and quoted self', () => {
    expect(parseCspDomains("data:, blob:, self, 'self'")).toEqual(['data:', 'blob:', "'self'", "'self'"]);
  });

  it('keeps explicit http(s) URLs and prefixes bare domains', () => {
    expect(parseCspDomains(' https://cdn.example.com , http://localhost:9000 , fonts.gstatic.com ')).toEqual([
      'https://cdn.example.com',
      'http://localhost:9000',
      'https://fonts.gstatic.com'
    ]);
  });
});
