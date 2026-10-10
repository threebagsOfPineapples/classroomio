import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyCspExtensions, parseCspDomains } from './csp';
import { getCspDomains } from './csp-domains.js';

afterEach(() => vi.unstubAllEnvs());

describe('self-hosted transport policy', () => {
  it('supports an explicitly configured HTTP origin without upgrading its resources', () => {
    vi.stubEnv('PUBLIC_IS_SELFHOSTED', 'true');
    vi.stubEnv('ORIGIN', 'http://10.60.6.101:3082');
    const response = new Response('', {
      headers: { 'content-security-policy': "default-src 'self'; upgrade-insecure-requests; object-src 'none'" }
    });

    applyCspExtensions(response);

    expect(response.headers.get('content-security-policy')).toBe("default-src 'self'; object-src 'none'");
  });

  it.each([
    ['true', 'https://train.example.com'],
    ['false', 'http://10.60.6.101:3082'],
    ['true', '']
  ])('preserves HTTPS upgrades for self-hosted=%s and origin=%s', (selfHosted, origin) => {
    vi.stubEnv('PUBLIC_IS_SELFHOSTED', selfHosted);
    vi.stubEnv('ORIGIN', origin);
    const response = new Response('', {
      headers: { 'content-security-policy': "default-src 'self'; upgrade-insecure-requests" }
    });

    applyCspExtensions(response);

    expect(response.headers.get('content-security-policy')).toContain('upgrade-insecure-requests');
  });
});

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
