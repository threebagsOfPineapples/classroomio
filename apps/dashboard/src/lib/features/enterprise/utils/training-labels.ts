const trainingStatusKeys: Record<string, string> = {
  NOT_STARTED: 'enterprise.assessment.not_started',
  IN_PROGRESS: 'enterprise.plans.status_in_progress',
  COMPLETED: 'enterprise.plans.status_completed',
  FAILED: 'enterprise.assessment.failed',
  EXPIRED: 'enterprise.assessment.expired',
  CANCELLED: 'enterprise.plans.status_cancelled'
};

const trainingResultKeys: Record<string, string> = {
  PENDING: 'enterprise.assessment.pending',
  PASS: 'enterprise.assessment.passed',
  FAIL: 'enterprise.assessment.failed',
  MAKEUP_REQUIRED: 'enterprise.assessment.makeup_required'
};

export function trainingStatusKey(status: string | null) {
  return trainingStatusKeys[status ?? ''] ?? 'enterprise.assessment.not_assigned';
}

export function trainingResultKey(result: string | null) {
  return trainingResultKeys[result ?? ''] ?? 'enterprise.assessment.pending';
}
