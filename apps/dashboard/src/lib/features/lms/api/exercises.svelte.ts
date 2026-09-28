import { BaseApiWithErrors, classroomio } from '$lib/utils/services/api';
import type { ExamAccess, GetLMSExercisesRequest, LMSExercise } from '../utils/types';
import type { MyTrainingAssignments } from '$features/enterprise/utils/types';

class LMSExercisesApi extends BaseApiWithErrors {
  exercises = $state<LMSExercise[]>([]);
  examAccess = $state<ExamAccess>({});
  accessLoading = $state(false);
  private accessRequestId = 0;

  async fetchLMSExercises(orgId: string) {
    return this.execute<GetLMSExercisesRequest>({
      requestFn: () => classroomio.organization[':orgId'].exercises.lms.$get({ param: { orgId } }),
      logContext: 'fetching LMS exercises',
      onSuccess: (response) => {
        if (response.data) {
          this.exercises = response.data;
        }
      }
    });
  }

  async fetchExamAccess(assignments: MyTrainingAssignments) {
    const requestId = ++this.accessRequestId;
    this.accessLoading = true;
    this.examAccess = {};
    const now = Date.now();
    const exams = [
      ...new Map(assignments.flatMap((assignment) => assignment.exams).map((exam) => [exam.id, exam])).values()
    ].filter((exam) => Date.parse(exam.opensAt) <= now && Date.parse(exam.closesAt) > now);
    const entries = await Promise.all(
      exams.map(async (exam) => {
        let access: ExamAccess[string] = 'unknown';
        try {
          const response = await classroomio.course[':courseId'].exercise[':exerciseId'].$get({
            param: { courseId: exam.courseId, exerciseId: exam.id }
          });
          const result = await response.json();
          if (response.ok && result.success) access = 'allowed';
          else if (response.status === 403 || response.status === 404) access = 'denied';
        } catch {
          access = 'unknown';
        }
        return [exam.id, access] as const;
      })
    );
    if (requestId !== this.accessRequestId) return;

    this.examAccess = Object.fromEntries(entries);
    this.accessLoading = false;
  }
}

export const lmsExercisesApi = new LMSExercisesApi();
