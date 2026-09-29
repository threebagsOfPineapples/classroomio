import assert from 'node:assert/strict';
import { db, sql } from '../drizzle';
import { recordLessonReading } from '../queries/lesson/reading-progress';

const address = new URL(process.env.DATABASE_URL ?? '');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(address.hostname));
const rollback = new Error('ROLLBACK_READING_CHECK');
try {
  await db.transaction(async (transaction) => {
    const profiles = await transaction.execute(sql`select id from profile where email = 'enterprise@test.com' limit 1`);
    const lessons = await transaction.execute(sql`select id from lesson order by created_at desc limit 1`);
    assert(profiles[0] && lessons[0], 'Local test profile and lesson required');
    const profileId = String(profiles[0].id);
    const lessonId = String(lessons[0].id);
    await transaction.execute(
      sql`delete from lesson_completion where lesson_id=${lessonId} and profile_id=${profileId}`
    );
    const initial = await recordLessonReading(lessonId, profileId, true, [], transaction);
    assert.equal(initial.readingSeconds, 0);
    await transaction.execute(
      sql`update lesson_completion set reading_last_at=now()-interval '5 seconds' where id=${initial.id}`
    );
    const active = await recordLessonReading(lessonId, profileId, true, ['note'], transaction);
    assert.equal(active.readingSeconds, 5);
    const duplicate = await recordLessonReading(lessonId, profileId, true, ['note'], transaction);
    assert.equal(duplicate.readingSeconds, 5);
    assert.deepEqual(duplicate.readingResources, ['note']);
    await transaction.execute(
      sql`update lesson_completion set reading_last_at=now()-interval '5 seconds' where id=${initial.id}`
    );
    const paused = await recordLessonReading(lessonId, profileId, false, [], transaction);
    assert.equal(paused.readingSeconds, 5);
    await transaction.execute(
      sql`update lesson_completion set reading_last_at=now()-interval '5 seconds' where id=${initial.id}`
    );
    const resumed = await recordLessonReading(lessonId, profileId, true, [], transaction);
    assert.equal(resumed.readingSeconds, 5);
    await transaction.execute(
      sql`update lesson_completion set reading_last_at=now()-interval '2 minutes' where id=${initial.id}`
    );
    const reconnected = await recordLessonReading(lessonId, profileId, true, ['pdf:guide'], transaction);
    assert.equal(reconnected.readingSeconds, 5);
    assert.deepEqual(new Set(reconnected.readingResources), new Set(['note', 'pdf:guide']));
    assert.equal(reconnected.isComplete, false);
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
}
console.log('Reading progress checks passed; transaction rolled back.');
process.exit(0);
