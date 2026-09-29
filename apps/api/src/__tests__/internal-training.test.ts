import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { internalTrainingMiddleware } from '../middlewares/internal-training';
import { signupGuard } from '../middlewares/signup-guard';
import {
  checkEmailExistsInOrg,
  getFirstOrganization,
  getOrganizationById,
  hasActiveOrganizationInviteForEmail
} from '@cio/db/queries/organization';

vi.mock('@cio/core/config/env', () => ({ env: { PUBLIC_IS_SELFHOSTED: 'true' } }));
vi.mock('@cio/db/queries/organization', () => ({
  checkEmailExistsInOrg: vi.fn(),
  getFirstOrganization: vi.fn(),
  getOrganizationById: vi.fn(),
  hasActiveOrganizationInviteForEmail: vi.fn()
}));

describe('internal training entry boundaries', () => {
  const app = new Hono().use('*', internalTrainingMiddleware).all('*', (context) => context.text('active'));

  it('retires anonymous catalogs, content, embeds and payment endpoints for every method', async () => {
    for (const path of [
      '/course/slug/draft-course',
      '/org-site/course/public-course/item/lesson',
      '/org-site/course/public-course/item/lesson/hls-cookie',
      '/widgets/public-key/payload',
      '/organization/courses/public',
      '/organization/tags/public',
      '/course/course-one/payment-request',
      '/course/course-one/landing-page'
    ]) {
      for (const method of ['GET', 'POST', 'PUT']) {
        expect((await app.request(path, { method })).status).toBe(410);
      }
    }
  });

  it('retains protected course operations, invitations, learning and certificates', async () => {
    for (const path of [
      '/course/course-one',
      '/course/course-one/enroll',
      '/invite/student/token',
      '/course/course-one/certificate/pdf',
      '/enterprise/learning/heartbeat',
      '/api/auth/sign-in/email'
    ]) {
      expect((await app.request(path)).status).toBe(200);
    }
  });
});

describe('internal signup eligibility', () => {
  const app = new Hono().use('*', signupGuard).post('*', (context) => context.text('registered'));
  const request = (orgId?: string) =>
    app.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(orgId ? { 'cio-org-id': orgId } : {}) },
      body: JSON.stringify({ email: 'employee@example.test' })
    });

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getFirstOrganization).mockResolvedValue({ id: 'org-one' } as never);
    vi.mocked(getOrganizationById).mockResolvedValue({ id: 'org-one', settings: {} } as never);
    vi.mocked(checkEmailExistsInOrg).mockResolvedValue(false);
    vi.mocked(hasActiveOrganizationInviteForEmail).mockResolvedValue(false);
  });

  it('rejects public signup with or without a supplied organization header', async () => {
    expect((await request()).status).toBe(400);
    expect((await request('org-one')).status).toBe(403);
    vi.mocked(getOrganizationById).mockResolvedValue(null as never);
    expect((await request('unknown')).status).toBe(400);
  });

  it('allows existing employees, valid invitations and first setup', async () => {
    vi.mocked(checkEmailExistsInOrg).mockResolvedValue(true);
    expect((await request('org-one')).status).toBe(200);
    vi.mocked(checkEmailExistsInOrg).mockResolvedValue(false);
    vi.mocked(hasActiveOrganizationInviteForEmail).mockResolvedValue(true);
    expect((await request()).status).toBe(200);
    expect((await request('org-one')).status).toBe(200);
    vi.mocked(getFirstOrganization).mockResolvedValue(null as never);
    expect((await request()).status).toBe(200);
  });
});
