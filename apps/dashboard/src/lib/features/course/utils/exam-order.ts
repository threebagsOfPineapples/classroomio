import type { Question } from '../types';

function rank(seed: string, id: string | number) {
  const input = `${seed}:${id}`;
  let value = 2166136261;
  for (const character of input) value = Math.imul(value ^ character.charCodeAt(0), 16777619);

  return value >>> 0;
}

function orderedBySeed<Item extends { id: string | number }>(items: Item[], seed: string) {
  return [...items].sort(
    (left, right) => rank(seed, left.id) - rank(seed, right.id) || String(left.id).localeCompare(String(right.id))
  );
}

export function arrangeExamQuestions(
  questions: Question[],
  attemptId: string,
  shuffleQuestions: boolean,
  shuffleOptions: boolean
) {
  const orderedQuestions = shuffleQuestions ? orderedBySeed(questions, attemptId) : questions;
  return orderedQuestions.map((question, index) => ({
    ...question,
    order: shuffleQuestions ? index : question.order,
    options: shuffleOptions ? orderedBySeed(question.options, `${attemptId}:${question.id}`) : question.options
  }));
}
