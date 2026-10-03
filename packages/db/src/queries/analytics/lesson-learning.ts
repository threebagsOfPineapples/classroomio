import { and, asc, db, eq, inArray, type DbOrTxClient } from '@db/drizzle';
import * as schema from '@db/schema';

function orderedTimestamp(values: (string | null | undefined)[], direction: 'first' | 'last') {
  const timestamps = values.filter((value): value is string => Boolean(value));
  timestamps.sort((first, second) => new Date(first).getTime() - new Date(second).getTime());

  return (direction === 'first' ? timestamps[0] : timestamps[timestamps.length - 1]) ?? null;
}

export async function getCourseLessonLearningRecords(courseId: string, profileId: string, client: DbOrTxClient = db) {
  const [lessons, videoProgress] = await Promise.all([
    client
      .select({
        id: schema.lesson.id,
        title: schema.lesson.title,
        order: schema.lesson.order,
        videos: schema.lesson.videos,
        completed: schema.lessonCompletion.isComplete,
        readingSeconds: schema.lessonCompletion.readingSeconds,
        readingFirstEnteredAt: schema.lessonCompletion.createdAt,
        completionUpdatedAt: schema.lessonCompletion.updatedAt
      })
      .from(schema.lesson)
      .leftJoin(
        schema.lessonCompletion,
        and(eq(schema.lessonCompletion.lessonId, schema.lesson.id), eq(schema.lessonCompletion.profileId, profileId))
      )
      .where(eq(schema.lesson.courseId, courseId))
      .orderBy(asc(schema.lesson.order), asc(schema.lesson.createdAt)),
    client
      .select({ progress: schema.lessonVideoProgress })
      .from(schema.lessonVideoProgress)
      .innerJoin(schema.lesson, eq(schema.lessonVideoProgress.lessonId, schema.lesson.id))
      .where(and(eq(schema.lesson.courseId, courseId), eq(schema.lessonVideoProgress.profileId, profileId)))
  ]);
  const assetIds = [
    ...new Set(lessons.flatMap((lesson) => (lesson.videos ?? []).flatMap((video) => video.assetId ?? [])))
  ];
  const assets =
    assetIds.length > 0
      ? await client
          .select({ id: schema.asset.id, durationSeconds: schema.asset.durationSeconds })
          .from(schema.asset)
          .where(inArray(schema.asset.id, assetIds))
      : [];
  const assetDurations = new Map(assets.map((asset) => [asset.id, asset.durationSeconds]));

  return lessons.map((lesson) => {
    const configuredVideos = lesson.videos ?? [];
    const configuredAssetIds = new Set(configuredVideos.flatMap((video) => video.assetId ?? []));
    const progressRows = videoProgress
      .map((row) => row.progress)
      .filter((progress) => progress.lessonId === lesson.id && configuredAssetIds.has(progress.assetId));
    const activityRows = progressRows.filter((progress) => progress.watchedSeconds > 0);
    const readingSeconds = Math.max(0, lesson.readingSeconds ?? 0);
    const watchedSeconds = progressRows.reduce(
      (seconds, progress) => seconds + Math.max(0, progress.watchedSeconds),
      0
    );
    const effectiveSeconds = readingSeconds + watchedSeconds;
    const durations = configuredVideos.map((video) => {
      const recordedDuration = progressRows.find((progress) => progress.assetId === video.assetId)?.durationSeconds;
      const duration =
        (video.assetId ? assetDurations.get(video.assetId) : null) ?? video.metadata?.duration ?? recordedDuration;

      return duration && duration > 0 ? Math.round(duration) : null;
    });
    const durationSeconds =
      durations.length > 0 && durations.every((duration) => duration !== null)
        ? durations.reduce((seconds, duration) => seconds + (duration ?? 0), 0)
        : null;
    const firstEnteredAt = orderedTimestamp(
      [readingSeconds > 0 ? lesson.readingFirstEnteredAt : null, ...activityRows.map((progress) => progress.createdAt)],
      'first'
    );
    const lastRecordedAt = orderedTimestamp(
      [readingSeconds > 0 ? lesson.completionUpdatedAt : null, ...activityRows.map((progress) => progress.updatedAt)],
      'last'
    );
    const completedAt =
      lesson.completed && effectiveSeconds > 0
        ? orderedTimestamp(
            [lesson.completionUpdatedAt, ...activityRows.map((progress) => progress.completedAt)],
            'last'
          )
        : null;
    const lastPositionSeconds = progressRows.length === 1 ? progressRows[0].lastPositionSeconds : null;

    return {
      id: lesson.id,
      title: lesson.title,
      order: lesson.order,
      readingSeconds,
      watchedSeconds,
      effectiveSeconds,
      durationSeconds,
      lastPositionSeconds,
      firstEnteredAt,
      lastRecordedAt,
      completedAt,
      completed: Boolean(lesson.completed)
    };
  });
}
