import type { AssessmentDraft, AssessmentScheme, EnterpriseDepartment, EnterpriseEmployee } from './types';

export function employeeLabel(employee: EnterpriseEmployee, departments: EnterpriseDepartment[] = []) {
  const department = departments.find((item) => item.id === employee.member.departmentId);
  return [employee.fullname, employee.member.employeeNo, department?.name, employee.email ?? employee.member.email]
    .filter(Boolean)
    .join(' · ');
}

export function matchesEmployee(employee: EnterpriseEmployee, departments: EnterpriseDepartment[], search: string) {
  return employeeLabel(employee, departments).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
}

export function assessmentDraftFingerprint(draft: AssessmentDraft | NonNullable<AssessmentScheme>) {
  const items = draft.items.map((item) => ({
    type: item.type,
    name: item.name,
    weight: item.weight,
    maxScore: item.maxScore,
    required: item.required,
    exerciseId: item.exerciseId ?? null
  }));
  return JSON.stringify({
    name: draft.name,
    description: draft.description ?? '',
    passScore: draft.passScore,
    items
  });
}

export function isAssessmentDraftSaved(scheme: AssessmentScheme, draft: AssessmentDraft) {
  return scheme !== null && assessmentDraftFingerprint(scheme) === assessmentDraftFingerprint(draft);
}

export function clearAssessmentInputs(inputs: Record<string, number | undefined>) {
  for (const itemId of Object.keys(inputs)) delete inputs[itemId];
}
