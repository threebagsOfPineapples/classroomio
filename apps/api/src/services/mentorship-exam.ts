import { createHash } from 'node:crypto';
import type { getMentorshipExamConfiguration } from '@cio/db/queries/mentorship';

type Configuration = NonNullable<Awaited<ReturnType<typeof getMentorshipExamConfiguration>>>;
type BaselineConfiguration = {
  exercise: Pick<Configuration['exercise'], 'id' | 'passThreshold' | 'updatedAt'>;
  questions: Array<
    Pick<Configuration['questions'][number], 'id' | 'questionTypeId' | 'points' | 'settings' | 'updatedAt'>
  >;
  options: Array<
    Pick<Configuration['options'][number], 'id' | 'questionId' | 'label' | 'value' | 'isCorrect' | 'updatedAt'>
  >;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== 'object') return value;

  const entries = Object.entries(value).sort(([firstKey], [secondKey]) =>
    firstKey < secondKey ? -1 : firstKey > secondKey ? 1 : 0
  );
  return Object.fromEntries(entries.map(([key, entry]) => [key, canonicalize(entry)]));
}

export function mentorshipExamBaseline(configuration: BaselineConfiguration) {
  const questions = [...configuration.questions].sort((first, second) => first.id - second.id);
  const options = [...configuration.options].sort((first, second) => first.id - second.id);
  const snapshot = canonicalize({ exercise: configuration.exercise, questions, options });
  const examScoringFingerprint = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  const examMaxScore = questions.reduce((total, item) => total + Number(item.points ?? 0), 0);
  const examPassThreshold = configuration.exercise.passThreshold;
  return { examMaxScore, examPassThreshold, examScoringFingerprint };
}
