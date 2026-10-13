import { z } from 'zod';

export const ZSurveyQuestion = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(1).max(500),
    type: z.enum(['SINGLE', 'MULTIPLE', 'RATING', 'TEXT']),
    required: z.boolean(),
    options: z.array(z.object({ id: z.uuid(), label: z.string().trim().min(1).max(200) })).max(30),
    ratingMax: z.number().int().min(2).max(10)
  })
  .superRefine((question, context) => {
    if (['SINGLE', 'MULTIPLE'].includes(question.type) && question.options.length < 2)
      context.addIssue({ code: 'custom', message: 'Choice questions need two options', path: ['options'] });
    if (new Set(question.options.map((option) => option.id)).size !== question.options.length)
      context.addIssue({ code: 'custom', message: 'Option IDs must be unique', path: ['options'] });
  });

export const ZSurveyTemplate = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(3000),
    questions: z.array(ZSurveyQuestion).min(1).max(100)
  })
  .superRefine((template, context) => {
    if (new Set(template.questions.map((question) => question.id)).size !== template.questions.length)
      context.addIssue({ code: 'custom', message: 'Question IDs must be unique', path: ['questions'] });
  });

export const ZSurveyTask = z
  .object({
    title: z.string().trim().min(1).max(200),
    templateId: z.uuid(),
    purpose: z.enum(['NEEDS', 'COURSE_EVALUATION']),
    courseId: z.uuid().nullable(),
    anonymous: z.boolean(),
    audience: z.enum(['TARGETED', 'ORGANIZATION']),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    memberIds: z.array(z.number().int().positive().safe()).max(10000),
    departmentIds: z.array(z.uuid()).max(500)
  })
  .superRefine((task, context) => {
    if (Date.parse(task.endsAt) <= Date.parse(task.startsAt))
      context.addIssue({ code: 'custom', message: 'End must follow start', path: ['endsAt'] });
    if (task.purpose === 'COURSE_EVALUATION' && !task.courseId)
      context.addIssue({ code: 'custom', message: 'Course evaluation needs a course', path: ['courseId'] });
    if (task.purpose === 'NEEDS' && task.courseId)
      context.addIssue({ code: 'custom', message: 'Needs survey is independent of courses', path: ['courseId'] });
    if (task.audience === 'TARGETED' && !task.memberIds.length && !task.departmentIds.length)
      context.addIssue({ code: 'custom', message: 'Targeted task needs recipients', path: ['memberIds'] });
  });

export const ZSurveyAnswers = z.object({
  answers: z.record(z.uuid(), z.union([z.string().max(5000), z.number(), z.array(z.uuid()).max(30)]))
});
export type SurveyQuestion = z.infer<typeof ZSurveyQuestion>;
export type SurveyAnswers = z.infer<typeof ZSurveyAnswers>['answers'];
export type SurveyTemplateInput = z.infer<typeof ZSurveyTemplate>;
export type SurveyTaskInput = z.infer<typeof ZSurveyTask>;

export function validateSurveyAnswers(questions: SurveyQuestion[], answers: SurveyAnswers, final: boolean) {
  const questionIds = new Set(questions.map((question) => question.id));
  if (Object.keys(answers).some((id) => !questionIds.has(id))) return false;

  return questions.every((question) => {
    const value = answers[question.id];
    const empty = value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
    if (empty) return !final || !question.required;

    if (question.type === 'TEXT') return typeof value === 'string';
    if (question.type === 'RATING')
      return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= question.ratingMax;

    const allowedIds = new Set(question.options.map((option) => option.id));
    if (question.type === 'SINGLE') return typeof value === 'string' && allowedIds.has(value);

    return Array.isArray(value) && new Set(value).size === value.length && value.every((id) => allowedIds.has(id));
  });
}
