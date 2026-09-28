export interface AiScoringProvider {
  score(input: {
    submission: { id: string; answers: Array<{ questionId: number; answer: unknown }> };
    rubric: { maxScore: number; dimensions: Array<{ name: string; maxScore: number; description: string }> };
    context: { courseTitle: string; exerciseTitle: string; language: string };
  }): Promise<{
    overallScore: number;
    dimensions: Array<{ name: string; score: number; maxScore: number }>;
    feedback: string;
    confidence: number;
  }>;
}
