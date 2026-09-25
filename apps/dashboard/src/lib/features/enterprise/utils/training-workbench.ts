import type { TrainingPlans } from './types';

export function getTrainingWorkbenchPlans(plans: TrainingPlans, now: number) {
  const published = plans.filter((plan) => plan.status === 'PUBLISHED');
  return {
    active: published.filter((plan) => Date.parse(plan.startAt) <= now && Date.parse(plan.endAt) > now).slice(0, 3),
    upcoming: published
      .filter((plan) => Date.parse(plan.startAt) > now)
      .sort((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt))
      .slice(0, 3),
    dueSoon: published
      .filter((plan) => Date.parse(plan.endAt) > now && Date.parse(plan.endAt) <= now + 7 * 86400000)
      .sort((left, right) => Date.parse(left.endAt) - Date.parse(right.endAt))
      .slice(0, 3)
  };
}
