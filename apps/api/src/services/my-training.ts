import { listMyTrainingAssignments, listMyTrainingExams, recordLearningMinute } from '@cio/db/queries/training-plan';
import { getOrgIdByCourseId } from '@cio/db/queries/course';
import { getBatchStudentCourseMembership } from '@cio/db/queries/course/member-progress';
import { AppError, ErrorCodes } from '@api/utils/errors';

type TrainingAssignmentRow = Awaited<ReturnType<typeof listMyTrainingAssignments>>[number];

export function groupMyTrainingAssignments(
  rows: TrainingAssignmentRow[],
  examRows: Awaited<ReturnType<typeof listMyTrainingExams>> = []
) {
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
      scoreCalculatedAt: string | null;
      progressPercent: number | null;
      evaluatedAt: string | null;
      assignedAt: string;
      exams: Array<{ id: string; courseId: string; title: string; opensAt: string; closesAt: string }>;
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
        scoreCalculatedAt: row.scoreCalculatedAt,
        progressPercent: row.progressPercent,
        evaluatedAt: row.evaluatedAt,
        assignedAt: row.assignedAt,
        exams: [],
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

  const assignments = [...plans.values()];
  const byEnrollmentId = new Map(assignments.map((assignment) => [assignment.enrollmentId, assignment]));
  const seenExams = new Set<string>();
  for (const exam of examRows) {
    const assignment = byEnrollmentId.get(exam.enrollmentId);
    const key = `${exam.enrollmentId}:${exam.exerciseId}`;
    if (!assignment || !exam.opensAt || !exam.closesAt || seenExams.has(key)) continue;

    seenExams.add(key);
    assignment.exams.push({
      id: exam.exerciseId,
      courseId: exam.courseId,
      title: exam.title,
      opensAt: exam.opensAt,
      closesAt: exam.closesAt
    });
  }

  return assignments;
}

export async function getMyTraining(organizationId: string, profileId: string) {
  const [rows, examRows] = await Promise.all([
    listMyTrainingAssignments(organizationId, profileId),
    listMyTrainingExams(organizationId, profileId)
  ]);
  return groupMyTrainingAssignments(rows, examRows);
}

export async function recordCourseLearning(organizationId: string, profileId: string, courseId: string) {
  const courseOrganizationId = await getOrgIdByCourseId(courseId);
  if (courseOrganizationId !== organizationId) {
    throw new AppError('Course not found', ErrorCodes.VALIDATION_ERROR, 404);
  }

  const membership = await getBatchStudentCourseMembership(courseId, [profileId]);
  if (!membership.has(profileId)) {
    throw new AppError('Course enrollment required', ErrorCodes.ORG_TEAM_NOT_AUTHORIZED, 403);
  }

  await recordLearningMinute(organizationId, profileId, courseId);
}
