import { t, locale } from '$lib/utils/functions/translations';
import { get } from 'svelte/store';
import { ApiError } from '$lib/utils/services/api/types';
import { mapZodErrorsToTranslations } from '$lib/utils/validation';
import type { ZodError } from 'zod';

const businessErrors: Record<string, string> = {
  'Assessment item weights must total 100': 'weights',
  'Score exceeds item maximum': 'score_maximum',
  'Publish the training plan before its assessment scheme': 'publish_plan',
  'Published assessment schemes cannot be changed': 'published_scheme',
  'Exam and assignment items need an exercise': 'select_exercise',
  'Assessment exercise type does not match the item': 'exercise_type',
  'Assessment exercise must belong to this plan': 'exercise_scope',
  'Exercise maximum score must match its question points': 'exercise_maximum',
  'Plan needs courses before an assessment scheme': 'select_courses',
  'Calculate a complete score before adjusting it': 'score_incomplete',
  'Plan courses must be published courses in this organization': 'published_courses',
  'Plan includes an unavailable course': 'published_courses',
  'Only draft plans can be edited': 'draft_only',
  'Only draft plans can be published': 'draft_only',
  'Plan needs courses and targets': 'courses_and_targets',
  'Plan has no eligible employees': 'no_recipients',
  'Plan owner must be an active employee': 'active_owner',
  'Target employee is invalid': 'active_employee',
  'Plan includes an inactive employee': 'active_employee',
  'Selected employee is inactive or outside this organization': 'active_employee',
  'Plan department is invalid': 'active_department',
  'Target department is invalid': 'active_department',
  'Plan includes an inactive department': 'active_department',
  'Active department not found': 'active_department',
  'Department hierarchy cannot contain a cycle': 'department_cycle',
  'Department has active children or employees': 'department_in_use',
  'Employee cannot manage themselves': 'manager_self',
  'Manager chain cannot contain a cycle': 'manager_cycle',
  'Statistics start date must not exceed end date': 'date_order',
  'End time must be after start time': 'date_order'
};

export function enterpriseValidationMessage(error: ZodError) {
  const messages = mapZodErrorsToTranslations(error);
  const firstIssue = error.issues[0];
  const field = firstIssue?.path.at(-1)?.toString() ?? '';
  const fieldKey = `enterprise.admin_fields.${field}`;
  const fieldLabel = t.get(fieldKey);
  const message = Object.values(messages)[0];
  if (fieldLabel && fieldLabel !== fieldKey)
    return t.get('enterprise.admin_errors.invalid_field', { field: fieldLabel });

  if (message && (get(locale) !== 'zh' || /[\u3400-\u9fff]/.test(message))) return message;

  return t.get('enterprise.admin_errors.invalid_form');
}

export function enterpriseErrorMessage(error: unknown) {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403))
    return t.get('common.restricted_description');

  if (error instanceof ApiError && error.status === 404) return t.get('common.page_not_found');

  let message = error instanceof Error ? error.message.trim() : '';
  try {
    const result = JSON.parse(message);
    message = typeof result.error === 'string' ? result.error : '';
  } catch {
    message = message.trim();
  }

  const businessKey = businessErrors[message];
  if (businessKey) return t.get(`enterprise.admin_errors.${businessKey}`);

  if (message && !message.startsWith('{') && (get(locale) !== 'zh' || /[\u3400-\u9fff]/.test(message))) return message;

  return t.get('enterprise.request_failed');
}
