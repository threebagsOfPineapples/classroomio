import type { SurveyAnswerDraft, SurveyQuestionDraft } from './types';

export function surveyAnswerLabel(question: SurveyQuestionDraft, answers: SurveyAnswerDraft) {
  const value = answers[question.id];
  if (value === undefined || value === '') return '—';
  if (Array.isArray(value))
    return value.map((optionId) => question.options.find((option) => option.id === optionId)?.label ?? '').join('; ');
  if (question.type === 'SINGLE') return question.options.find((option) => option.id === value)?.label ?? '—';

  return String(value);
}
