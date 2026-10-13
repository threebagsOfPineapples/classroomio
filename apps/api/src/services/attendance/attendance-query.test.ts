import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TGroupAttendance } from '@cio/db/types';

const database = vi.hoisted(() => ({
  record: null as TGroupAttendance | null,
  insert: vi.fn(),
  update: vi.fn()
}));

vi.mock('@db/drizzle', async () => {
  const drizzle = await import('drizzle-orm');

  return {
    ...drizzle,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => (database.record ? [database.record] : []) })
        })
      }),
      insert: database.insert,
      update: database.update
    }
  };
});

import { upsertAttendance } from '@cio/db/queries/attendance';

beforeEach(() => {
  vi.clearAllMocks();
  database.record = null;
  database.insert.mockImplementation(() => ({
    values: (data: TGroupAttendance) => ({
      returning: async () => {
        database.record = { ...data, id: 42, createdAt: null, updatedAt: null };

        return [database.record];
      }
    })
  }));
  database.update.mockImplementation(() => ({
    set: (data: Partial<TGroupAttendance>) => ({
      where: () => ({
        returning: async () => {
          if (!database.record) {
            return [];
          }

          database.record = { ...database.record, ...data };

          return [database.record];
        }
      })
    })
  }));
});

describe('existing attendance upsert behavior', () => {
  it('reuses the attendance row on repeated marking and on an absent correction', async () => {
    const attendance = { courseId: 'course-a', lessonId: 'lesson-a', studentId: 'student-a', isPresent: true };
    const created = await upsertAttendance(attendance);
    const repeated = await upsertAttendance(attendance);
    const corrected = await upsertAttendance({ ...attendance, isPresent: false });

    expect(created.id).toBe(42);
    expect(repeated.id).toBe(created.id);
    expect(corrected.id).toBe(created.id);
    expect(corrected.isPresent).toBe(false);
    expect(database.insert).toHaveBeenCalledTimes(1);
    expect(database.update).toHaveBeenCalledTimes(2);
  });
});
