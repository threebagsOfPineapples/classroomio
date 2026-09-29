import { db, sql, type DbOrTxClient } from '@db/drizzle';
import { lessonCompletion } from '@db/schema';

export async function recordLessonReading(
  lessonId: string,
  profileId: string,
  active: boolean,
  resources: string[],
  client: DbOrTxClient = db
) {
  const resourceJson = JSON.stringify(resources);
  const [progress] = await client
    .insert(lessonCompletion)
    .values({
      lessonId,
      profileId,
      readingActive: active,
      readingLastAt: sql`now()`,
      readingResources: resources
    })
    .onConflictDoUpdate({
      target: [lessonCompletion.lessonId, lessonCompletion.profileId],
      set: {
        readingSeconds: sql`${lessonCompletion.readingSeconds} + CASE
        WHEN ${active} AND ${lessonCompletion.readingActive}
          AND extract(epoch from now() - ${lessonCompletion.readingLastAt}) BETWEEN 0 AND 15
        THEN floor(extract(epoch from now() - ${lessonCompletion.readingLastAt}))::integer ELSE 0 END`,
        readingLastAt: sql`greatest(${lessonCompletion.readingLastAt}, now())`,
        readingActive: active,
        readingResources: sql`(SELECT coalesce(jsonb_agg(DISTINCT value), '[]'::jsonb)
        FROM jsonb_array_elements(${lessonCompletion.readingResources} || ${resourceJson}::jsonb))`
      }
    })
    .returning();
  return progress;
}
