import { expect, it, vi } from 'vitest';
import { get, writable } from 'svelte/store';

vi.mock('$env/static/public', () => ({ PUBLIC_IS_SELFHOSTED: 'false' }));
vi.mock('./org', () => ({
  currentOrg: writable({ roleId: 0 }),
  currentOrgPath: writable('/org/test')
}));

import { ROLE } from '@cio/utils/constants';
import { currentOrg } from './org';
import { basePath, globalStore, isStudentExperience } from './app';

it('uses learner navigation for students on the app host and visitors on an org site', () => {
  currentOrg.update((org) => ({ ...org, roleId: ROLE.STUDENT }));
  expect(get(isStudentExperience)).toBe(true);
  expect(get(basePath)).toBe('/lms');

  currentOrg.update((org) => ({ ...org, roleId: ROLE.ADMIN }));
  expect(get(isStudentExperience)).toBe(false);
  globalStore.update((state) => ({ ...state, isOrgSite: true }));
  expect(get(isStudentExperience)).toBe(true);
});
