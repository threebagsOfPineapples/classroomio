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
  const readingDelta = sql`CASE
    WHEN ${active} AND ${lessonCompletion.readingActive}
      AND NOT coalesce(${lessonCompletion.isComplete}, false)
      AND extract(epoch from now() - ${lessonCompletion.readingLastAt}) BETWEEN 0 AND 15
    THEN floor(extract(epoch from now() - ${lessonCompletion.readingLastAt}))::integer ELSE 0 END`;
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
        readingSeconds: sql`${lessonCompletion.readingSeconds} + ${readingDelta}`,
        readingLastAt: sql`greatest(${lessonCompletion.readingLastAt}, now())`,
        readingActive: active,
        updatedAt: sql`CASE WHEN ${readingDelta} > 0 THEN now() ELSE ${lessonCompletion.updatedAt} END`,
        readingResources: sql`(SELECT coalesce(jsonb_agg(DISTINCT value), '[]'::jsonb)
        FROM jsonb_array_elements(${lessonCompletion.readingResources} || ${resourceJson}::jsonb))`
      }
    })
    .returning();
  return progress;
}
