import { getCourseById } from '@cio/db/queries/course';
import { getLessonById } from '@cio/db/queries/lesson';
import { getCourseOrganizationId } from '@cio/db/queries/tag';
import { getAssetById, getAssetsByIds } from '@cio/db/queries/assets';
import { isCourseTeamMemberOrOrgAdmin, isUserCourseMemberOrOrgAdmin } from '@cio/db/queries/group';
import { AppError, ErrorCodes } from '@cio/utils/errors';
import { getLessonDocumentIdentity } from '@cio/utils/functions/lesson-document';
import { generateDocumentDownloadPresignedUrls } from '../../utils/s3';
import { ensureProgramCourseAccess } from '../course/course';

export async function assertCourseDocumentDownloadAllowed(courseId: string, profileId: string): Promise<void> {
  const [course] = await getCourseById(courseId);
  if (!course) {
    throw new AppError('当前课程不存在', ErrorCodes.COURSE_NOT_FOUND, 404);
  }

  let hasCourseAccess = await isUserCourseMemberOrOrgAdmin(courseId, profileId);
  if (!hasCourseAccess) {
    hasCourseAccess = await ensureProgramCourseAccess(courseId, profileId);
  }

  if (!hasCourseAccess) {
    throw new AppError('你没有此课程的访问权限', ErrorCodes.UNAUTHORIZED, 403);
  }

  const isCourseManager = await isCourseTeamMemberOrOrgAdmin(courseId, profileId);
  if (!isCourseManager && course.metadata?.lessonDownload !== true) {
    throw new AppError('管理员已关闭课程文件下载，可继续在线预览', 'COURSE_DOCUMENT_DOWNLOAD_DISABLED', 403);
  }
}

function validateDocumentUrl(url: string | null | undefined): string {
  if (!url) {
    throw new AppError('当前课程文件不可用', 'COURSE_DOCUMENT_NOT_FOUND', 404);
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') return url;
  } catch {}

  throw new AppError('当前课程文件地址无效', 'COURSE_DOCUMENT_NOT_FOUND', 404);
}

export async function getLessonDocumentDownload(
  courseId: string,
  lessonId: string,
  profileId: string,
  documentId: string
) {
  const lesson = await getLessonById(lessonId);
  if (!lesson || lesson.courseId !== courseId) {
    throw new AppError('当前课程中不存在该课时', ErrorCodes.LESSON_NOT_FOUND, 404);
  }

  await assertCourseDocumentDownloadAllowed(courseId, profileId);

  const documents = lesson.documents ?? [];
  const organizationId = await getCourseOrganizationId(courseId);
  let document = documents.find((candidate) => getLessonDocumentIdentity(candidate) === documentId);
  if (!document) {
    document = documents.find((candidate) => candidate.assetId && `asset:${candidate.assetId}` === documentId);
  }

  if (!document && organizationId) {
    const assetIds = documents
      .map((candidate) => candidate.assetId)
      .filter((assetId): assetId is string => Boolean(assetId));
    const assets = await getAssetsByIds(assetIds, organizationId);
    const matchingAsset = assets.find(
      (asset) => asset.organizationId === organizationId && asset.storageKey === documentId
    );
    document = matchingAsset ? documents.find((candidate) => candidate.assetId === matchingAsset.id) : undefined;
  }

  if (!document) {
    throw new AppError('当前课时中不存在该文件', 'COURSE_DOCUMENT_NOT_FOUND', 404);
  }

  let storageKey = document.key;
  let sourceUrl = document.link;
  let name = document.name;

  if (document.assetId) {
    const asset = organizationId ? await getAssetById(document.assetId, organizationId) : null;
    if (!asset || asset.organizationId !== organizationId) {
      throw new AppError('当前课程文件不可用', 'COURSE_DOCUMENT_NOT_FOUND', 404);
    }

    storageKey = asset.provider === 'external_url' ? '' : (asset.storageKey ?? storageKey);
    sourceUrl = asset.provider === 'upload' ? sourceUrl : (asset.sourceUrl ?? sourceUrl);
    name = name || asset.title || '';
  }

  if (!storageKey) {
    return { url: validateDocumentUrl(sourceUrl), name };
  }

  const signedUrls = await generateDocumentDownloadPresignedUrls([storageKey]);
  const url = validateDocumentUrl(signedUrls[storageKey]);
  return { url, name };
}
