type AssessmentValue = {
  itemId: string;
  weight: number;
  maxScore: number;
  required: boolean;
  rawScore: number | null;
  sourceId: string | null;
};

export function calculateAssessment(values: AssessmentValue[], passScore: number, manualAdjustment = 0) {
  const details = values.map((value) => {
    const normalizedScore =
      value.rawScore === null ? null : Math.max(0, Math.min(100, (value.rawScore / value.maxScore) * 100));
    const weightedScore = normalizedScore === null ? null : (normalizedScore * value.weight) / 100;
    return { ...value, normalizedScore, weightedScore };
  });
  const pending =
    details.every((detail) => detail.rawScore === null) ||
    details.some((detail) => detail.required && detail.rawScore === null);
  const rawCalculatedScore = pending
    ? null
    : Math.round(details.reduce((total, detail) => total + (detail.weightedScore ?? 0), 0) * 10) / 10;
  const finalScore =
    rawCalculatedScore === null ? null : Math.max(0, Math.min(100, rawCalculatedScore + manualAdjustment));
  const result = finalScore === null ? 'PENDING' : finalScore >= passScore ? 'PASS' : 'FAIL';
  return { details, rawCalculatedScore, finalScore, result } as const;
}
