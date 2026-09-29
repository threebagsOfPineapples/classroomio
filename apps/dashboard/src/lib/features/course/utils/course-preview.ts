import { resolve } from '$app/paths';
import { snackbar } from '$features/ui/snackbar/store';

interface OpenCoursePreviewOptions {
  courseId: string;
  courseSlug?: string | null;
  currentOrgDomain?: string;
}

export function getInternalCourseUrl(courseId: string): string {
  if (typeof window === 'undefined' || !courseId) {
    return '';
  }

  return new URL(resolve(`/courses/${courseId}`, {}), window.location.origin).toString();
}

export function openCoursePreview({ courseId }: OpenCoursePreviewOptions) {
  const courseUrl = getInternalCourseUrl(courseId);
  if (!courseUrl) {
    return false;
  }

  const previewUrl = new URL(resolve(`/courses/${courseId}/lessons`, {}), window.location.origin);
  previewUrl.searchParams.set('preview', 'true');
  window.open(previewUrl.toString(), '_blank', 'noopener,noreferrer');
  return true;
}

export async function copyInternalCourseUrl(courseId: string) {
  const courseUrl = getInternalCourseUrl(courseId);
  if (!courseUrl) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(courseUrl);
    snackbar.success('snackbar.public_course.url_copied');
    return true;
  } catch (error) {
    console.error('copyInternalCourseUrl error:', error);
    snackbar.error('snackbar.public_course.url_copy_failed');
    return false;
  }
}
