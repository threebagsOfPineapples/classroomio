import { expect, it } from 'vitest';
import { assessmentDraftFingerprint, clearAssessmentInputs } from './admin-workflow';
import type { AssessmentDraft } from './types';

it('clears all previous employee scores, including zero values, before another employee is edited', () => {
  const inputs = { instructor: 95, attendance: 0 };
  clearAssessmentInputs(inputs);
  expect(inputs).toEqual({});
});

it('detects changes to published assessment inputs while normalizing absent descriptions', () => {
  const draft: AssessmentDraft = {
    name: 'Safety training',
    passScore: 80,
    items: [{ type: 'INSTRUCTOR', name: 'Practice', weight: 100, maxScore: 100, required: true }]
  };
  const saved = assessmentDraftFingerprint(draft);
  expect(assessmentDraftFingerprint({ ...draft, description: '' })).toBe(saved);
  expect(assessmentDraftFingerprint({ ...draft, passScore: 90 })).not.toBe(saved);
  expect(assessmentDraftFingerprint({ ...draft, items: [{ ...draft.items[0], weight: 50 }] })).not.toBe(saved);
});
