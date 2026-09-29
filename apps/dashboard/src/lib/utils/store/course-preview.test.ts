import { describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$app/environment', () => ({ browser: false }));
vi.mock('$env/static/public', () => ({ PUBLIC_IS_SELFHOSTED: 'true' }));
vi.mock('$app/stores', async () => {
  const { writable } = await import('svelte/store');
  return { page: writable({ url: new URL('http://localhost/courses/course-a/lessons') }) };
});
vi.mock('./org', async () => {
  const { writable } = await import('svelte/store');
  return {
    currentOrg: writable({ roleId: 1 }),
    currentOrgPath: writable('/org/company'),
    isOrgTeamMember: writable(true)
  };
});

import { page } from '$app/stores';
import { isOrgTeamMember } from './org';
import { canRecordCourseLearning, isCoursePreview, setCoursePreview, setLearnerPortal } from './app';
import type { Writable } from 'svelte/store';

describe('course preview recording boundary', () => {
  it('blocks recording during preview, keeps course scope, and requires management eligibility', () => {
    setLearnerPortal(true);
    expect(get(canRecordCourseLearning)).toBe(true);
    setCoursePreview('course-a');
    expect(get(isCoursePreview)).toBe(true);
    expect(get(canRecordCourseLearning)).toBe(false);
    (page as unknown as Writable<{ url: URL }>).set({ url: new URL('http://localhost/courses/course-b/lessons') });
    expect(get(isCoursePreview)).toBe(false);
    expect(get(canRecordCourseLearning)).toBe(true);
    (page as unknown as Writable<{ url: URL }>).set({
      url: new URL('http://localhost/courses/course-b/lessons?preview=true')
    });
    expect(get(isCoursePreview)).toBe(true);
    (isOrgTeamMember as Writable<boolean>).set(false);
    expect(get(isCoursePreview)).toBe(false);
    expect(get(canRecordCourseLearning)).toBe(true);
    setCoursePreview(null);
  });
});
