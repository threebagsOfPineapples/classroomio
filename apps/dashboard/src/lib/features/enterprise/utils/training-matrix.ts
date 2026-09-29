import type { TrainingMatrix } from './types';

export function filterTrainingMatrixEmployees(
  employees: TrainingMatrix['employees'],
  search: string,
  planId: string,
  expiringOnly: boolean
) {
  const query = search.trim().toLocaleLowerCase();
  return employees.filter((employee) => {
    if (query && !employee.name.toLocaleLowerCase().includes(query)) return false;

    return (
      !expiringOnly ||
      employee.cells.some((cell) => (!planId || cell.planId === planId) && cell.certificateExpiringSoon)
    );
  });
}

export function getTrainingMatrixExportRows(employees: TrainingMatrix['employees'], plans: TrainingMatrix['plans']) {
  return employees.flatMap((employee) =>
    plans.map((plan) => {
      const cell = employee.cells.find((item) => item.planId === plan.id);
      return {
        memberId: employee.memberId,
        employeeName: employee.name,
        planName: plan.name,
        status: cell?.status ?? null,
        finalScore: cell?.finalScore ?? null
      };
    })
  );
}
