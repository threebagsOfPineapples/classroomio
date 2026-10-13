import type { SurveyAnswers, SurveyQuestion } from '@cio/utils/validation/survey';

export function surveyWindowState(task: { status: string; startsAt: string; endsAt: string }, now = Date.now()) {
  if (task.status === 'CLOSED' || now >= Date.parse(task.endsAt)) return 'CLOSED';
  if (task.status !== 'PUBLISHED' || now < Date.parse(task.startsAt)) return 'NOT_OPEN';

  return 'OPEN';
}

export function surveyRecovery(submitted: number, invited: number | null) {
  return { submitted, invited, rate: invited && invited > 0 ? submitted / invited : null };
}

export function summarizeSurveyAnswers(questions: SurveyQuestion[], answers: SurveyAnswers[], includeText: boolean) {
  return questions.map((question) => {
    const values = answers
      .map((answer) => answer[question.id])
      .filter((value) => value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0));
    const ratings = values.filter((value): value is number => typeof value === 'number');
    const options = question.options.map((option) => {
      const count = values.filter(
        (value) => value === option.id || (Array.isArray(value) && value.includes(option.id))
      ).length;
      return { ...option, count, rate: values.length ? count / values.length : null };
    });
    const average = ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null;
    const texts =
      includeText && question.type === 'TEXT'
        ? values.filter((value): value is string => typeof value === 'string')
        : [];
    const distribution = Array.from({ length: question.ratingMax }, (_, index) => ({
      rating: index + 1,
      count: ratings.filter((rating) => rating === index + 1).length
    }));
    return { question, validAnswers: values.length, options, average, distribution, texts };
  });
}

export function canReadSurveyAnswers(anonymous: boolean, closed: boolean, allScope: boolean) {
  return !anonymous || (closed && allScope);
}

export function surveyCsvCell(value: unknown) {
  const text = String(value ?? '');
  const protectedText = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${protectedText.replaceAll('"', '""')}"`;
}
