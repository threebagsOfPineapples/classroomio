import { getPdfReadingResource } from './lesson-document';

type ReadingLesson = {
  completionPolicy: string;
  videos?: unknown[] | null;
  videoUrl?: string | null;
  slides?: unknown[] | null;
  slideUrl?: string | null;
  documents?: { key: string; assetId?: string; name: string; type: string }[] | null;
  lessonLanguages: { locale: string | null; content: string | null }[];
};

export function getReadingRequirements(lesson: ReadingLesson) {
  const language = lesson.lessonLanguages.find((item) => item.locale === 'zh') ?? lesson.lessonLanguages[0];
  const text = (language?.content ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&[^;]+;/g, ' ')
    .trim();
  const documents = lesson.documents ?? [];
  const pdfResources = documents.map(getPdfReadingResource).filter((resource): resource is string => Boolean(resource));
  const resources = [...(text ? ['note'] : []), ...pdfResources];
  const requiredSeconds = Math.max(60, Math.ceil(text.length / 5) + pdfResources.length * 60);
  const supported =
    lesson.completionPolicy === 'manual' &&
    !lesson.videos?.length &&
    !lesson.videoUrl &&
    !lesson.slides?.length &&
    !lesson.slideUrl &&
    documents.length === pdfResources.length &&
    resources.length > 0;
  return { resources, requiredSeconds, supported };
}

export function isReadingComplete(
  requirements: ReturnType<typeof getReadingRequirements>,
  seconds: number,
  resources: string[]
) {
  return (
    requirements.supported &&
    seconds >= requirements.requiredSeconds &&
    requirements.resources.every((resource) => resources.includes(resource))
  );
}
