import { describe, expect, it } from 'vitest';
import { calculateAssessment } from './assessment-calculation';

describe('calculateAssessment', () => {
  const values = [
    { itemId: 'exam', weight: 40, maxScore: 100, required: true, rawScore: 92, sourceId: 'submission-1' },
    { itemId: 'assignment', weight: 30, maxScore: 100, required: true, rawScore: 85, sourceId: 'submission-2' },
    { itemId: 'instructor', weight: 20, maxScore: 100, required: true, rawScore: 88, sourceId: 'input-1' },
    { itemId: 'progress', weight: 10, maxScore: 100, required: true, rawScore: 100, sourceId: 'enrollment-1' }
  ];

  it('calculates the weighted result and keeps missing required scores pending', () => {
    expect(calculateAssessment(values, 80)).toMatchObject({
      rawCalculatedScore: 89.9,
      finalScore: 89.9,
      result: 'PASS'
    });
    expect(calculateAssessment(values, 89.9).result).toBe('PASS');
    expect(calculateAssessment(values, 90).result).toBe('FAIL');
    expect(calculateAssessment(values, 80, 2).finalScore).toBe(91.9);
    expect(
      calculateAssessment(
        values.map((value) => ({ ...value, rawScore: 0 })),
        0
      ).result
    ).toBe('PASS');
    expect(
      calculateAssessment(
        values.map((value) => ({ ...value, rawScore: 100 })),
        100
      ).finalScore
    ).toBe(100);
    expect(calculateAssessment([{ ...values[0], rawScore: null }, ...values.slice(1)], 80)).toMatchObject({
      rawCalculatedScore: null,
      finalScore: null,
      result: 'PENDING'
    });
    expect(
      calculateAssessment(
        values.map((value) => ({ ...value, required: false, rawScore: null })),
        0
      ).result
    ).toBe('PENDING');
  });
});
