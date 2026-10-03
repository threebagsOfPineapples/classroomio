import { BaseApiWithErrors, classroomio } from '$lib/utils/services/api';
import { ApiError } from '$lib/utils/services/api/types';
import type { ExamAccess, GetLMSExercisesRequest, LMSExercise } from '../utils/types';
import type { MyTrainingAssignments } from '$features/enterprise/utils/types';
import { getExerciseAccessTargets } from '../utils/assessment-tasks';

export class LMSExercisesApi extends BaseApiWithErrors {
  exercises = $state<LMSExercise[]>([]);
  examAccess = $state<ExamAccess>({});
  accessLoading = $state(false);
  private accessRequestId = 0;
  private requestId = 0;

  async load(orgId: string) {
    const response = await this.fetchLMSExercises(orgId);
    if (!response) return;

    await this.fetchExamAccess();
  }

  async fetchLMSExercises(orgId: string) {
    const requestId = ++this.requestId;
    this.accessRequestId++;
    this.examAccess = {};
    this.accessLoading = false;
    return this.execute<GetLMSExercisesRequest>({
      requestFn: () => classroomio.organization[':orgId'].exercises.lms.$get({ param: { orgId } }),
      logContext: 'fetching LMS exercises',
      onSuccess: (response) => {
        if (requestId !== this.requestId) return;

        if (response.data) {
          this.exercises = response.data;
        }
      }
    });
  }

  async fetchExamAccess(assignments: MyTrainingAssignments = []) {
    const requestId = ++this.accessRequestId;
    this.accessLoading = true;
    this.examAccess = {};
    const now = Date.now();
    const exams = getExerciseAccessTargets(this.exercises, assignments, now);
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
        } catch (error) {
          access = error instanceof ApiError && (error.status === 403 || error.status === 404) ? 'denied' : 'unknown';
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
