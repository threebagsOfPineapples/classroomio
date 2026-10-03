import { getLessonDocumentStorageReferences } from '@cio/db/queries/lesson';
import { assertCourseDocumentDownloadAllowed } from '@cio/core/services/lesson/document-download';
import { AppError, ErrorCodes } from '@api/utils/errors';
import { assertEnrolledStudentContentAccess } from './access';
import { ContentType } from '@cio/utils/constants';

export async function assertCourseDocumentPresignAllowed(keys: string[], profileId: string): Promise<void> {
  const references = await getLessonDocumentStorageReferences(keys);

  async function checkReference(reference: (typeof references)[number]) {
    if (reference.assetId && reference.assetOrganizationId !== reference.organizationId) {
      throw new AppError('当前课程文件不可用', 'COURSE_DOCUMENT_NOT_FOUND', 404);
    }

    await assertCourseDocumentDownloadAllowed(reference.courseId, profileId);
    await assertEnrolledStudentContentAccess({
      courseId: reference.courseId,
      profileId,
      contentId: reference.lessonId,
      type: ContentType.Lesson
    });
  }

  for (const key of new Set(keys)) {
    const matchingReferences = references.filter(
      (reference) => reference.documentKey === key || reference.storageKey === key
    );
    if (matchingReferences.length === 0) continue;

    let allowed = false;
    let deniedError: AppError | undefined;

    for (const reference of matchingReferences) {
      try {
        await checkReference(reference);
        allowed = true;
        break;
      } catch (error) {
        if (!(error instanceof AppError) || (error.statusCode !== 403 && error.statusCode !== 404)) throw error;

        if (!deniedError || error.code === 'COURSE_DOCUMENT_DOWNLOAD_DISABLED') deniedError = error;
      }
    }

    if (!allowed) {
      throw deniedError ?? new AppError('你没有此课程文件的下载权限', ErrorCodes.UNAUTHORIZED, 403);
    }
  }
}
