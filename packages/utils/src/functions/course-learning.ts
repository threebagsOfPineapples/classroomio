import { ContentType } from '../constants/content';

export function getResumeLessonId(
  learningRecords: { id: string; effectiveSeconds: number; lastRecordedAt: string | null; completed: boolean }[],
  contentItems: {
    id: string;
    type: string;
    isComplete?: boolean | null;
    isUnlocked?: boolean | null;
    accessible?: boolean;
  }[]
): string | null {
  const availableLessonIds = new Set(
    contentItems
      .filter(
        (item) =>
          item.type === ContentType.Lesson && !item.isComplete && item.isUnlocked !== false && item.accessible !== false
      )
      .map((item) => item.id)
  );
  const resumableRecords = learningRecords.filter(
    (record) =>
      availableLessonIds.has(record.id) &&
      !record.completed &&
      record.effectiveSeconds > 0 &&
      record.lastRecordedAt &&
      Number.isFinite(new Date(record.lastRecordedAt).getTime())
  );
  resumableRecords.sort(
    (first, second) =>
      new Date(second.lastRecordedAt as string).getTime() - new Date(first.lastRecordedAt as string).getTime()
  );

  return resumableRecords[0]?.id ?? null;
}
