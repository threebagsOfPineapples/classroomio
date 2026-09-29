import { expect, it } from 'vitest';
import { getInternalTrainingRedirect } from './internal-training';

it('redirects old pages while retaining actual internal pages and invitation links', () => {
  const target = (path: string) => getInternalTrainingRedirect(new URL(path, 'http://localhost'));
  expect(target('/')).toBe('/lms');
  for (const path of [
    '/course/demo',
    '/course/demo/enroll',
    '/course/demo/lesson/read',
    '/courses/',
    '/pages/about',
    '/widgets/old'
  ]) {
    expect(target(path)).toBe('/lms/explore');
  }
  expect(target('/org/company/landingpage/edit')).toBe('/org/company/courses');
  expect(target('/org/company/settings/billing')).toBe('/org/company/courses');
  expect(target('/org/company/audience/import')).toBe('/admin?view=employees');
  for (const path of [
    '/course/demo/enroll?invite_token=valid',
    '/courses/id/lessons?preview=true',
    '/courses/id/certificates',
    '/admin/plans'
  ]) {
    expect(target(path)).toBeNull();
  }
});
