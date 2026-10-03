import * as schema from '@db/schema';
import { db, eq, inArray, or, sql } from '@db/drizzle';

export async function getLessonDocumentStorageReferences(keys: string[]) {
  if (keys.length === 0) return [];

  const documentKey = sql<string | null>`document_entry.value->>'key'`;
  const documentAssetId = sql<string | null>`document_entry.value->>'assetId'`;

  return db
    .select({
      lessonId: schema.lesson.id,
      courseId: schema.course.id,
      organizationId: schema.group.organizationId,
      documentKey,
      storageKey: schema.asset.storageKey,
      assetId: documentAssetId,
      assetOrganizationId: schema.asset.organizationId
    })
    .from(schema.lesson)
    .innerJoin(schema.course, eq(schema.lesson.courseId, schema.course.id))
    .innerJoin(schema.group, eq(schema.course.groupId, schema.group.id))
    .innerJoin(
      sql`jsonb_array_elements(
        case when jsonb_typeof(${schema.lesson.documents}) = 'array'
          then ${schema.lesson.documents} else '[]'::jsonb end
      ) as document_entry(value)`,
      sql`true`
    )
    .leftJoin(schema.asset, eq(sql`${schema.asset.id}::text`, documentAssetId))
    .where(or(inArray(documentKey, keys), inArray(schema.asset.storageKey, keys)));
}
