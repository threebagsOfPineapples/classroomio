import { listMyTrainingAssignments } from '@cio/db/queries/training-plan';

type TrainingAssignmentRow = Awaited<ReturnType<typeof listMyTrainingAssignments>>[number];

export function groupMyTrainingAssignments(rows: TrainingAssignmentRow[]) {
  const plans = new Map<
    string,
    {
      enrollmentId: string;
      id: string;
      name: string;
      code: string;
      description: string | null;
      planType: TrainingAssignmentRow['planType'];
      planStatus: TrainingAssignmentRow['planStatus'];
      startAt: string;
      endAt: string;
      enrollmentStatus: TrainingAssignmentRow['enrollmentStatus'];
      result: TrainingAssignmentRow['result'];
      finalScore: number | null;
      progressPercent: number | null;
      evaluatedAt: string | null;
      assignedAt: string;
      courses: Array<{
        id: string;
        title: string;
        required: boolean;
        dueAt: string | null;
      }>;
    }
  >();

  for (const row of rows) {
    let plan = plans.get(row.planId);
    if (!plan) {
      plan = {
        enrollmentId: row.enrollmentId,
        id: row.planId,
        name: row.planName,
        code: row.planCode,
        description: row.planDescription,
        planType: row.planType,
        planStatus: row.planStatus,
        startAt: row.startAt,
        endAt: row.endAt,
        enrollmentStatus: row.enrollmentStatus,
        result: row.result,
        finalScore: row.finalScore,
        progressPercent: row.progressPercent,
        evaluatedAt: row.evaluatedAt,
        assignedAt: row.assignedAt,
        courses: []
      };
      plans.set(row.planId, plan);
    }

    plan.courses.push({
      id: row.courseId,
      title: row.courseTitle,
      required: row.courseRequired,
      dueAt: row.courseDueAt
    });
  }

  return [...plans.values()];
}

export async function getMyTraining(organizationId: string, profileId: string) {
  const rows = await listMyTrainingAssignments(organizationId, profileId);
  return groupMyTrainingAssignments(rows);
}
