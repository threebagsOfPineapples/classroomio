import type { Course } from './types';
import { ContentType } from '@cio/utils/constants/content';
import { getCourseContent, getOrderedNavigableContent, type ContentItem } from './content';

export function isNavigableContentUnlocked(item: ContentItem): boolean {
  return item.isUnlocked !== false && item.accessible !== false;
}

export function getFirstIncompleteNavigableContent(course: Course | null): ContentItem | undefined {
  return getOrderedNavigableContent(course).find((item) => !item.isComplete && isNavigableContentUnlocked(item));
}

export function getContinueLearningContent(course: Course | null): ContentItem | undefined {
  const resumedLesson = getOrderedNavigableContent(course).find(
    (item) =>
      item.type === ContentType.Lesson &&
      item.id === course?.resumeLessonId &&
      !item.isComplete &&
      isNavigableContentUnlocked(item)
  );

  return resumedLesson ?? getFirstIncompleteNavigableContent(course);
}

export function getSavedLessonLearningSeconds(course: Course | null, lessonId: string): number {
  return course?.lessonLearningProgress?.find((record) => record.lessonId === lessonId)?.effectiveSeconds ?? 0;
}

export function updateCourseSavedLessonLearning(
  course: Course,
  lessonId: string,
  effectiveSeconds: number,
  didLearn: boolean
): Course {
  const existingRecord = course.lessonLearningProgress?.find((record) => record.lessonId === lessonId);
  const updatedRecord = { lessonId, effectiveSeconds, lastRecordedAt: existingRecord?.lastRecordedAt ?? null };
  const lessonLearningProgress = (course.lessonLearningProgress ?? [])
    .filter((record) => record.lessonId !== lessonId || (effectiveSeconds > 0 && !didLearn))
    .map((record) => (record.lessonId === lessonId ? updatedRecord : record));
  if (effectiveSeconds > 0) {
    if (didLearn) lessonLearningProgress.unshift(updatedRecord);
    else if (!existingRecord) lessonLearningProgress.push(updatedRecord);
  }

  const contentItems = getOrderedNavigableContent(course);
  const currentItem = contentItems.find((item) => item.id === lessonId);
  const currentResume = contentItems.find((item) => item.id === course.resumeLessonId);
  const currentResumeAvailable =
    currentResume && !currentResume.isComplete && isNavigableContentUnlocked(currentResume);
  const fallbackResume = lessonLearningProgress.find((record) => {
    const contentItem = contentItems.find((item) => item.id === record.lessonId);

    return contentItem && !contentItem.isComplete && isNavigableContentUnlocked(contentItem);
  });
  const canResumeCurrent = currentItem && !currentItem.isComplete && isNavigableContentUnlocked(currentItem);
  const resumeLessonId =
    didLearn && effectiveSeconds > 0 && canResumeCurrent
      ? lessonId
      : currentResumeAvailable
        ? course.resumeLessonId
        : (fallbackResume?.lessonId ?? null);

  return { ...course, lessonLearningProgress, resumeLessonId };
}

export function isContentItemInPath(itemId: string, currentPath: string | null | undefined): boolean {
  if (!itemId || !currentPath) {
    return false;
  }

  const pathSegments = currentPath.split('/').filter(Boolean);
  return pathSegments.includes(itemId);
}

export function findActiveNavigableContentIndex(items: ContentItem[], currentPath: string | null | undefined): number {
  return items.findIndex((item) => isContentItemInPath(item.id, currentPath));
}

export function resolveActiveNavigableContentIndex(
  course: Course | null,
  currentPath: string | null | undefined
): number {
  const items = getOrderedNavigableContent(course);
  if (items.length === 0) {
    return -1;
  }

  const pathIndex = findActiveNavigableContentIndex(items, currentPath);
  if (pathIndex >= 0) {
    return pathIndex;
  }

  const firstIncomplete = getFirstIncompleteNavigableContent(course);
  if (firstIncomplete) {
    return items.findIndex((item) => item.id === firstIncomplete.id);
  }

  return 0;
}

export function getPreviousNavigableContent(
  course: Course | null,
  currentPath: string | null | undefined
): ContentItem | null {
  const items = getOrderedNavigableContent(course);
  const activeIndex = resolveActiveNavigableContentIndex(course, currentPath);
  if (activeIndex <= 0) {
    return null;
  }

  return items[activeIndex - 1] ?? null;
}

export function getNextIncompleteNavigableContent(
  course: Course | null,
  currentPath: string | null | undefined
): ContentItem | null {
  const items = getOrderedNavigableContent(course);
  const activeIndex = resolveActiveNavigableContentIndex(course, currentPath);
  if (activeIndex < 0) {
    return null;
  }

  for (let index = activeIndex + 1; index < items.length; index += 1) {
    const item = items[index];
    if (!item.isComplete && isNavigableContentUnlocked(item)) {
      return item;
    }
  }

  return null;
}

export function getActiveNavigableContent(
  course: Course | null,
  currentPath: string | null | undefined
): ContentItem | null {
  const items = getOrderedNavigableContent(course);
  const activeIndex = resolveActiveNavigableContentIndex(course, currentPath);
  if (activeIndex < 0) {
    return null;
  }

  return items[activeIndex] ?? null;
}

export function getSectionIdForContentItem(course: Course | null, itemId: string | undefined): string | null {
  if (!itemId) {
    return null;
  }

  const content = getCourseContent(course);
  if (!content.grouped) {
    return null;
  }

  for (const section of content.sections) {
    if (section.items.some((item) => item.id === itemId)) {
      return section.id;
    }
  }

  return null;
}

export function getActiveSectionId(course: Course | null, currentPath: string | null | undefined): string | null {
  const activeItem = getActiveNavigableContent(course, currentPath);
  if (!activeItem) {
    return null;
  }

  return getSectionIdForContentItem(course, activeItem.id);
}

export function formatSectionCompletionLabel(completed: number, total: number): string {
  return `${completed}/${total}`;
}

export function collapseExpandedSectionsToActive(activeSectionId: string | null): Set<string> {
  if (!activeSectionId) {
    return new Set();
  }

  return new Set([activeSectionId]);
}

export function scrollOutlineToActiveItem(container: HTMLElement | null, itemId: string): void {
  if (!container || !itemId) {
    return;
  }

  requestAnimationFrame(() => {
    const activeRow = container.querySelector(`[data-sidebar-content-id="${itemId}"]`);
    if (activeRow instanceof HTMLElement) {
      activeRow.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  });
}
