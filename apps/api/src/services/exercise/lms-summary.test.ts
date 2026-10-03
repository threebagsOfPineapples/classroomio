import { describe, expect, it } from 'vitest';
import type { LMSExerciseQueryResult } from '@cio/db/queries/exercise/lms';
import { getLMSExerciseSummary } from '@cio/core/services/exercise/exercise';

const now = Date.parse('2026-10-02T02:00:00Z');

function exercise(overrides: Partial<LMSExerciseQueryResult> = {}): LMSExerciseQueryResult {
  return {
    id: 'exam',
    title: 'Safety exam',
    updated_at: '',
    isExam: true,
    opensAt: '2026-10-02 01:00:00+00',
    closesAt: '2026-10-02 03:00:00+00',
    dueBy: null,
    durationMinutes: 30,
    maxAttempts: 1,
    allowMakeup: false,
    attempts: [],
    makeup: null,
    questions: [{ points: 10 }],
    submission: [],
    lesson: { id: '', title: '', order: 0, course: { id: 'course', title: 'Onboarding', group: [], groupmember: [] } },
    ...overrides
  };
}

describe('LMS exam summary', () => {
  it('normalizes database timestamps and excludes raw per-learner attempt records', () => {
    const summary = getLMSExerciseSummary(exercise(), now);
    expect(summary).toMatchObject({
      opensAt: '2026-10-02T01:00:00.000Z',
      closesAt: '2026-10-02T03:00:00.000Z',
      attemptCount: 0,
      canAttempt: true
    });
    expect(summary).not.toHaveProperty('attempts');
    expect(summary).not.toHaveProperty('makeup');
  });

  it('distinguishes resumable attempts from exhausted or expired attempts', () => {
    const activeAttempt = { expiresAt: '2026-10-02T02:30:00Z', submittedAt: null };
    expect(getLMSExerciseSummary(exercise({ attempts: [activeAttempt] }), now)).toMatchObject({
      canAttempt: true,
      activeAttemptExpiresAt: '2026-10-02T02:30:00.000Z',
      attemptCount: 1
    });
    expect(
      getLMSExerciseSummary(exercise({ attempts: [{ ...activeAttempt, submittedAt: '2026-10-02T01:45:00Z' }] }), now)
        .canAttempt
    ).toBe(false);
    expect(
      getLMSExerciseSummary(exercise({ attempts: [{ ...activeAttempt, expiresAt: '2026-10-02T02:00:00Z' }] }), now)
        .canAttempt
    ).toBe(false);
    expect(
      getLMSExerciseSummary(
        exercise({
          maxAttempts: 2,
          allowMakeup: true,
          attempts: [{ ...activeAttempt, submittedAt: '2026-10-02T01:45:00Z' }]
        }),
        now
      ).canAttempt
    ).toBe(true);
  });

  it('applies active and scheduled makeup windows without allowing attempts before opening', () => {
    const makeup = { opensAt: '2026-10-03T01:00:00Z', closesAt: '2026-10-03T03:00:00Z', maxAttempts: 2 };
    const makeupExam = exercise({
      opensAt: '2026-10-01T01:00:00Z',
      closesAt: '2026-10-01T03:00:00Z',
      makeup,
      attempts: [{ expiresAt: '2026-10-01T02:00:00Z', submittedAt: '2026-10-01T01:30:00Z' }]
    });
    expect(getLMSExerciseSummary(makeupExam, now)).toMatchObject({
      opensAt: '2026-10-03T01:00:00.000Z',
      maxAttempts: 2,
      allowMakeup: true,
      canAttempt: false
    });
    expect(getLMSExerciseSummary(makeupExam, Date.parse(makeup.opensAt)).canAttempt).toBe(true);
    expect(getLMSExerciseSummary(makeupExam, Date.parse(makeup.closesAt)).canAttempt).toBe(false);
  });

  it('never offers an exam attempt for ordinary assignments or a closed exam', () => {
    expect(
      getLMSExerciseSummary(
        exercise({ isExam: false, opensAt: null, closesAt: null, dueBy: '2026-10-04 02:00:00+00' }),
        now
      )
    ).toMatchObject({ canAttempt: false, dueBy: '2026-10-04T02:00:00.000Z' });
    expect(getLMSExerciseSummary(exercise(), Date.parse('2026-10-02T03:00:00Z')).canAttempt).toBe(false);
  });
});
