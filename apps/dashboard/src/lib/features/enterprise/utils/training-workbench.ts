import type { EnterpriseGradingQueue, TrainingArchive, TrainingPlans } from './types';

export function getTrainingWorkbenchPlans(plans: TrainingPlans, now: number) {
  const published = plans.filter((plan) => plan.status === 'PUBLISHED');
  const active = published.filter((plan) => Date.parse(plan.startAt) <= now && Date.parse(plan.endAt) > now);
  const upcoming = published
    .filter((plan) => Date.parse(plan.startAt) > now)
    .sort((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt));
  const dueSoon = published
    .filter((plan) => Date.parse(plan.endAt) > now && Date.parse(plan.endAt) <= now + 7 * 86400000)
    .sort((left, right) => Date.parse(left.endAt) - Date.parse(right.endAt));
  return { active, upcoming, dueSoon };
}

export function getGradingWorkbenchQueue(queue: EnterpriseGradingQueue) {
  const all = [...new Map(queue.map((item) => [item.id, item])).values()].sort(
    (left, right) => (Date.parse(right.submittedAt ?? '') || 0) - (Date.parse(left.submittedAt ?? '') || 0)
  );
  const assignments = all.filter((item) => !item.isExam);
  const written = all.filter((item) => item.hasWrittenQuestion);
  return { all, assignments, written };
}

export function getPlanCompletion(archive: TrainingArchive, planId: string) {
  const records = archive.filter((record) => record.planId === planId);
  const completed = records.filter((record) => record.status === 'COMPLETED').length;
  const assigned = records.length;
  const percent = assigned ? Math.round((completed / assigned) * 100) : null;
  return { completed, assigned, percent };
}
