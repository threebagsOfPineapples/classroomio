import { currentOrg, currentOrgPath } from './org';
import { derived, writable } from 'svelte/store';

import { PUBLIC_IS_SELFHOSTED } from '$env/static/public';
import { ROLE } from '@cio/utils/constants';

export const globalStore = writable<{
  isDark: boolean;
  isOrgSite: boolean;
  orgSiteName: string;
}>({
  isDark: false,
  isOrgSite: false,
  orgSiteName: ''
});

export const isOrgStudent = derived(currentOrg, ($currentOrg) => {
  if ($currentOrg.roleId === 0) return null;

  return $currentOrg.roleId === ROLE.STUDENT;
});

export const isStudentExperience = derived([globalStore, isOrgStudent], ([$gs, $isStudent]) => {
  const isCloud = PUBLIC_IS_SELFHOSTED !== 'true';
  if (isCloud) return $gs.isOrgSite || $isStudent === true;

  return $isStudent ?? false;
});

/**
 * True when course lesson/exercise pages should render the learner UI
 * (locked notices, student empty states, no teacher authoring CTAs).
 * Cloud org-site visitors always get the learner view; on the app host
 * only org-role students do.
 */
export const isCourseLearnerView = derived(
  [isStudentExperience, isOrgStudent],
  ([$isStudentExperience, $isOrgStudent]) => {
    return $isStudentExperience || $isOrgStudent === true;
  }
);

/**
 * The root path for navigation: '/lms' for students, '/org/{siteName}' for admin/teacher
 */
export const basePath = derived([isStudentExperience, currentOrgPath], ([$isStudent, $orgPath]) =>
  $isStudent ? '/lms' : $orgPath
);
