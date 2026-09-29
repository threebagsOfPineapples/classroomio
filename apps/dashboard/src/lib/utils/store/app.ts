import { currentOrg, currentOrgPath, isOrgTeamMember } from './org';
import { derived, writable } from 'svelte/store';

import { PUBLIC_IS_SELFHOSTED } from '$env/static/public';
import { ROLE } from '@cio/utils/constants';
import { browser } from '$app/environment';
import { page } from '$app/stores';

export const learnerPortal = writable(browser && sessionStorage.getItem('training-portal') === 'learner');
const previewCourseId = writable(browser ? sessionStorage.getItem('training-preview-course') : null);

export function setCoursePreview(courseId: string | null) {
  previewCourseId.set(courseId);
  if (!browser) return;

  if (courseId) sessionStorage.setItem('training-preview-course', courseId);
  else sessionStorage.removeItem('training-preview-course');
}

export const isCoursePreview = derived(
  [page, previewCourseId, isOrgTeamMember],
  ([$page, $previewCourseId, $isOrgTeamMember]) => {
    const courseId = $page.url.pathname.match(/^\/courses\/([^/]+)(?:\/|$)/)?.[1];
    return Boolean(
      $isOrgTeamMember &&
        courseId &&
        ($page.url.searchParams.get('preview') === 'true' || $previewCourseId === courseId)
    );
  }
);

export function setLearnerPortal(learner: boolean) {
  learnerPortal.set(learner);
  if (browser) sessionStorage.setItem('training-portal', learner ? 'learner' : 'management');
}

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

export const isStudentExperience = derived(
  [globalStore, isOrgStudent, learnerPortal, isCoursePreview],
  ([$gs, $isStudent, $learnerPortal, $isCoursePreview]) => {
    if ($learnerPortal || $isCoursePreview) return true;

    const isCloud = PUBLIC_IS_SELFHOSTED !== 'true';
    if (isCloud) return $gs.isOrgSite || $isStudent === true;

    return $isStudent ?? false;
  }
);

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

export const canRecordCourseLearning = derived(
  [isCourseLearnerView, isCoursePreview],
  ([$isCourseLearnerView, $isCoursePreview]) => $isCourseLearnerView && !$isCoursePreview
);

/**
 * The root path for navigation: '/lms' for students, '/org/{siteName}' for admin/teacher
 */
export const basePath = derived([isStudentExperience, currentOrgPath], ([$isStudent, $orgPath]) =>
  $isStudent ? '/lms' : $orgPath
);
