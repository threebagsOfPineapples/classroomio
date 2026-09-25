import { AppError, ErrorCodes } from '@api/utils/errors';
import { getEnterpriseEmployees, getEnterpriseOverview } from '@api/services/enterprise';
import { getCourseMemberProgressSummaries } from '@api/services/course/member-progress';
import {
  getBatchStudentCourseMembership,
  getCourseTrackableContentCounts
} from '@cio/db/queries/course/member-progress';
import { exerciseBelongsToCourse } from '@cio/db/queries/course/certification-exercise';
import {
  addAssessmentAdjustment,
  addAssessmentInput,
  createAssessmentScheme,
  createTrainingEvaluation,
  getAssessmentEnrollment,
  getAssessmentExercise,
  getAssessmentExercisePoints,
  getAssessmentScheme,
  getAssessmentScore,
  getTrainingEvaluation,
  listAssessmentEnrollments,
  listAssessmentExercises,
  listAssessmentInputs,
  listAssessmentPlanCourses,
  listPublishedAssessmentEnrollmentsForCourse,
  listArchiveCourseEvidence,
  listCompletedAssessmentSubmissions,
  publishAssessmentScheme,
  replaceAssessmentItems,
  saveAssessmentScore,
  updateAssessmentEnrollment,
  updateAssessmentScheme,
  withAssessmentTransaction
} from '@cio/db/queries/assessment';
import {
  countLearningMinutesForMembers,
  getTrainingPlan,
  listTrainingPlans,
  lockTrainingPlan
} from '@cio/db/queries/training-plan';
import { getProfileByGroupMemberId } from '@cio/db/queries/course/people';
import type { TAssessmentSchemeDraft, TTrainingEvaluation } from '@cio/utils/validation/assessment';
import { ROLE } from '@cio/utils/constants';
import { calculateAssessment } from './assessment-calculation';

function assessmentError(message: string, status = 400): never {
  throw new AppError(message, ErrorCodes.VALIDATION_ERROR, status);
}

async function requireAssessmentManager(organizationId: string, profileId: string) {
  const overview = await getEnterpriseOverview(organizationId, profileId);
  if (!overview.canManage) {
    throw new AppError('Training manager access required', ErrorCodes.ORG_TEAM_NOT_AUTHORIZED, 403);
  }

  return overview;
}

async function requireAssessmentReportReader(organizationId: string, profileId: string) {
  const overview = await getEnterpriseOverview(organizationId, profileId);
  if (!overview.canManage && !overview.roles.includes('DEPARTMENT_MANAGER')) {
    throw new AppError('Training statistics access required', ErrorCodes.ORG_TEAM_NOT_AUTHORIZED, 403);
  }

  return overview;
}

async function requireVisibleEnrollment(organizationId: string, profileId: string, enrollmentId: string) {
  const row = await getAssessmentEnrollment(organizationId, enrollmentId);
  if (!row) assessmentError('Training enrollment not found', 404);
  if (row.member.profileId === profileId) return row;

  const employees = await getEnterpriseEmployees(organizationId, profileId);
  if (!employees.some((employee) => employee.member.id === row.member.id)) {
    throw new AppError('Training enrollment not visible', ErrorCodes.ORG_TEAM_NOT_AUTHORIZED, 404);
  }

  return row;
}

export async function getPlanAssessment(organizationId: string, profileId: string, planId: string) {
  await requireAssessmentManager(organizationId, profileId);
  const plan = await getTrainingPlan(organizationId, planId);
  if (!plan) assessmentError('Training plan not found', 404);

  return getAssessmentScheme(organizationId, planId);
}

export async function getPlanAssessmentExercises(organizationId: string, profileId: string, planId: string) {
  await requireAssessmentManager(organizationId, profileId);
  const plan = await getTrainingPlan(organizationId, planId);
  if (!plan) assessmentError('Training plan not found', 404);

  const courses = await listAssessmentPlanCourses(organizationId, planId);
  return listAssessmentExercises(courses.map((course) => course.courseId));
}

export async function savePlanAssessment(
  organizationId: string,
  profileId: string,
  planId: string,
  values: TAssessmentSchemeDraft
) {
  await requireAssessmentManager(organizationId, profileId);
  const courses = await listAssessmentPlanCourses(organizationId, planId);
  if (courses.length === 0) assessmentError('Plan needs courses before an assessment scheme');

  for (const item of values.items) {
    if (item.type === 'EXAM' || item.type === 'ASSIGNMENT') {
      if (!item.exerciseId) assessmentError('Exam and assignment items need an exercise');

      const exercise = await getAssessmentExercise(item.exerciseId);
      if (!exercise || exercise.isExam !== (item.type === 'EXAM')) {
        assessmentError('Assessment exercise type does not match the item');
      }

      const belongsToPlan = await Promise.all(
        courses.map((course) => exerciseBelongsToCourse(item.exerciseId!, course.courseId))
      );
      if (!belongsToPlan.some(Boolean)) assessmentError('Assessment exercise must belong to this plan');

      const maxPoints = await getAssessmentExercisePoints(item.exerciseId);
      if (maxPoints <= 0 || Math.abs(maxPoints - item.maxScore) > 0.000001) {
        assessmentError('Exercise maximum score must match its question points');
      }
    } else if (item.exerciseId) {
      assessmentError('Only exam and assignment items can reference an exercise');
    }
  }

  await withAssessmentTransaction(async (transaction) => {
    const plan = await lockTrainingPlan(organizationId, planId, transaction);
    if (!plan) assessmentError('Training plan not found', 404);
    if (plan.status === 'CANCELLED') assessmentError('Cancelled training plans cannot be assessed');

    const current = await getAssessmentScheme(organizationId, planId, transaction);
    if (current?.status === 'PUBLISHED') assessmentError('Published assessment schemes cannot be changed');

    let schemeId = current?.id;
    if (schemeId) {
      await updateAssessmentScheme(
        schemeId,
        { name: values.name, description: values.description ?? null, passScore: values.passScore },
        transaction
      );
    } else {
      const [created] = await createAssessmentScheme(
        { planId, name: values.name, description: values.description ?? null, passScore: values.passScore },
        transaction
      );
      schemeId = created.id;
    }

    await replaceAssessmentItems(
      schemeId,
      values.items.map((item, sort) => ({
        schemeId,
        type: item.type,
        name: item.name,
        weight: item.weight,
        maxScore: item.maxScore,
        required: item.required,
        sort,
        exerciseId: item.exerciseId ?? null
      })),
      transaction
    );
  });
  return getPlanAssessment(organizationId, profileId, planId);
}

export async function publishPlanAssessment(organizationId: string, profileId: string, planId: string) {
  await requireAssessmentManager(organizationId, profileId);
  await withAssessmentTransaction(async (transaction) => {
    const plan = await lockTrainingPlan(organizationId, planId, transaction);
    if (!plan) assessmentError('Training plan not found', 404);
    if (plan.status === 'DRAFT' || plan.status === 'CANCELLED') {
      assessmentError('Publish the training plan before its assessment scheme');
    }

    const scheme = await getAssessmentScheme(organizationId, planId, transaction);
    if (!scheme) assessmentError('Assessment scheme not found', 404);
    if (scheme.status === 'PUBLISHED') return;
    if (scheme.items.reduce((total, item) => total + item.weight, 0) !== 100) {
      assessmentError('Assessment item weights must total 100');
    }

    await publishAssessmentScheme(scheme.id, transaction);
  });

  const enrollments = await listAssessmentEnrollments(organizationId, planId);
  for (const enrollment of enrollments) {
    if (enrollment.enrollment.status === 'CANCELLED' || enrollment.enrollment.status === 'EXPIRED') continue;

    await calculateEnrollmentAssessment(organizationId, enrollment.enrollment.id);
  }

  return getPlanAssessment(organizationId, profileId, planId);
}

async function readTrainingProgress(
  profileId: string | null,
  courses: Awaited<ReturnType<typeof listAssessmentPlanCourses>>
) {
  if (!profileId || courses.length === 0) return null;

  const requiredCourses = courses.filter((course) => course.required);
  const progressCourses = requiredCourses.length ? requiredCourses : courses;
  const percentages = await Promise.all(
    progressCourses.map(async (course) => {
      const [counts, membership] = await Promise.all([
        getCourseTrackableContentCounts(course.courseId),
        getBatchStudentCourseMembership(course.courseId, [profileId])
      ]);
      if (!membership.has(profileId)) return null;
      if (counts.lessonsCount + counts.exercisesCount === 0) return null;

      const summaries = await getCourseMemberProgressSummaries(course.courseId, [
        { profileId, roleId: ROLE.STUDENT, createdAt: null }
      ]);
      return summaries.get(profileId)?.progressPercent ?? null;
    })
  );
  if (percentages.some((percentage) => percentage === null)) return null;

  return Math.round(percentages.reduce<number>((sum, percentage) => sum + percentage!, 0) / percentages.length);
}

export async function recalculateAssessment(organizationId: string, profileId: string, enrollmentId: string) {
  await requireVisibleEnrollment(organizationId, profileId, enrollmentId);
  return calculateEnrollmentAssessment(organizationId, enrollmentId);
}

export async function syncAssessmentsForCourse(courseId: string, profileId: string) {
  const enrollments = await listPublishedAssessmentEnrollmentsForCourse(courseId, profileId);
  for (const enrollment of enrollments) {
    await calculateEnrollmentAssessment(enrollment.organizationId, enrollment.enrollmentId);
  }
}

export async function syncAssessmentsForSubmission(courseId: string, groupMemberId: string) {
  const profile = await getProfileByGroupMemberId(groupMemberId);
  if (profile) await syncAssessmentsForCourse(courseId, profile.id);
}

async function calculateEnrollmentAssessment(organizationId: string, enrollmentId: string) {
  return withAssessmentTransaction(async (transaction) => {
    const context = await getAssessmentEnrollment(organizationId, enrollmentId, transaction, true);
    if (!context) assessmentError('Training enrollment not found', 404);

    const scheme = await getAssessmentScheme(organizationId, context.plan.id, transaction);
    if (!scheme || scheme.status !== 'PUBLISHED') assessmentError('Published assessment scheme required');

    const [courses, inputs, previous] = await Promise.all([
      listAssessmentPlanCourses(organizationId, context.plan.id),
      listAssessmentInputs(enrollmentId, transaction),
      getAssessmentScore(enrollmentId, transaction)
    ]);
    const groupIds = courses.map((course) => course.groupId);
    const progress = await readTrainingProgress(context.member.profileId, courses);
    const latestInputs = new Map<string, (typeof inputs)[number]>();
    for (const input of inputs) {
      if (!latestInputs.has(input.itemId)) latestInputs.set(input.itemId, input);
    }

    const values = await Promise.all(
      scheme.items.map(async (item) => {
        if (item.type === 'EXAM' || item.type === 'ASSIGNMENT') {
          const submissions =
            context.member.profileId && item.exerciseId
              ? await listCompletedAssessmentSubmissions(context.member.profileId, item.exerciseId, groupIds)
              : [];
          const best = submissions[0];
          return {
            itemId: item.id,
            weight: item.weight,
            maxScore: item.maxScore,
            required: item.required,
            rawScore: best?.total === null || best === undefined ? null : Number(best.total),
            sourceId: best?.id ?? null
          };
        }

        if (item.type === 'PROGRESS') {
          return {
            itemId: item.id,
            weight: item.weight,
            maxScore: item.maxScore,
            required: item.required,
            rawScore: progress === null ? null : (progress * item.maxScore) / 100,
            sourceId: progress === null ? null : enrollmentId
          };
        }

        const input = latestInputs.get(item.id);
        return {
          itemId: item.id,
          weight: item.weight,
          maxScore: item.maxScore,
          required: item.required,
          rawScore: input?.score ?? null,
          sourceId: input?.id ?? null
        };
      })
    );
    const calculated = calculateAssessment(values, scheme.passScore, previous?.manualAdjustment ?? 0);
    const score = await saveAssessmentScore(
      enrollmentId,
      {
        rawCalculatedScore: calculated.rawCalculatedScore,
        manualAdjustment: previous?.manualAdjustment ?? 0,
        finalScore: calculated.finalScore,
        result: calculated.result,
        calculatedAt: new Date().toISOString()
      },
      calculated.details.map((detail) => ({
        itemId: detail.itemId,
        sourceId: detail.sourceId,
        rawScore: detail.rawScore,
        maxScore: detail.maxScore,
        normalizedScore: detail.normalizedScore,
        weight: detail.weight,
        weightedScore: detail.weightedScore
      })),
      transaction
    );
    const status =
      calculated.result === 'FAIL'
        ? 'FAILED'
        : calculated.result === 'PASS' && progress === 100
          ? 'COMPLETED'
          : calculated.rawCalculatedScore !== null || (progress !== null && progress > 0)
            ? 'IN_PROGRESS'
            : 'NOT_STARTED';
    const active = status !== 'NOT_STARTED';
    await updateAssessmentEnrollment(
      enrollmentId,
      {
        progressPercent: progress,
        finalScore: calculated.finalScore,
        result: calculated.result,
        status,
        startedAt: active ? (context.enrollment.startedAt ?? new Date().toISOString()) : context.enrollment.startedAt,
        completedAt: status === 'COMPLETED' ? new Date().toISOString() : null
      },
      transaction
    );
    return { score, details: calculated.details, progressPercent: progress, status };
  });
}

export async function enterAssessmentInput(
  organizationId: string,
  profileId: string,
  enrollmentId: string,
  itemId: string,
  value: number
) {
  await requireAssessmentManager(organizationId, profileId);
  await withAssessmentTransaction(async (transaction) => {
    const context = await getAssessmentEnrollment(organizationId, enrollmentId, transaction, true);
    if (!context) assessmentError('Training enrollment not found', 404);

    const scheme = await getAssessmentScheme(organizationId, context.plan.id, transaction);
    const item = scheme?.items.find((candidate) => candidate.id === itemId);
    if (!item || scheme?.status !== 'PUBLISHED') assessmentError('Published assessment item not found', 404);
    if (!['INSTRUCTOR', 'ATTENDANCE', 'CUSTOM'].includes(item.type)) assessmentError('This item uses a system score');
    if (value > item.maxScore) assessmentError('Score exceeds item maximum');

    await addAssessmentInput({ enrollmentId, itemId, score: value, enteredByProfileId: profileId }, transaction);
  });
  return recalculateAssessment(organizationId, profileId, enrollmentId);
}

export async function adjustAssessmentScore(
  organizationId: string,
  profileId: string,
  enrollmentId: string,
  amount: number,
  reason: string
) {
  await requireAssessmentManager(organizationId, profileId);
  await withAssessmentTransaction(async (transaction) => {
    const context = await getAssessmentEnrollment(organizationId, enrollmentId, transaction, true);
    if (!context) assessmentError('Training enrollment not found', 404);

    const score = await getAssessmentScore(enrollmentId, transaction);
    if (!score || score.rawCalculatedScore === null) assessmentError('Calculate a complete score before adjusting it');

    const scheme = await getAssessmentScheme(organizationId, context.plan.id, transaction);
    if (!scheme) assessmentError('Assessment scheme not found', 404);

    await addAssessmentAdjustment({ scoreId: score.id, amount, reason, adjustedByProfileId: profileId }, transaction);
    const manualAdjustment = score.manualAdjustment + amount;
    const finalScore = Math.max(0, Math.min(100, score.rawCalculatedScore + manualAdjustment));
    const result = finalScore >= scheme.passScore ? 'PASS' : 'FAIL';
    await saveAssessmentScore(
      enrollmentId,
      {
        rawCalculatedScore: score.rawCalculatedScore,
        manualAdjustment,
        finalScore,
        result,
        calculatedAt: new Date().toISOString()
      },
      score.details.map((detail) => ({
        itemId: detail.itemId,
        sourceId: detail.sourceId,
        rawScore: detail.rawScore,
        maxScore: detail.maxScore,
        normalizedScore: detail.normalizedScore,
        weight: detail.weight,
        weightedScore: detail.weightedScore
      })),
      transaction
    );
    const status =
      result === 'FAIL' ? 'FAILED' : context.enrollment.progressPercent === 100 ? 'COMPLETED' : 'IN_PROGRESS';
    await updateAssessmentEnrollment(
      enrollmentId,
      { finalScore, result, status, completedAt: status === 'COMPLETED' ? new Date().toISOString() : null },
      transaction
    );
  });
  return getEnrollmentAssessment(organizationId, profileId, enrollmentId);
}

export async function getEnrollmentAssessment(organizationId: string, profileId: string, enrollmentId: string) {
  const context = await requireVisibleEnrollment(organizationId, profileId, enrollmentId);
  const [scheme, score, evaluation] = await Promise.all([
    getAssessmentScheme(organizationId, context.plan.id),
    getAssessmentScore(enrollmentId),
    getTrainingEvaluation(enrollmentId)
  ]);
  return { enrollment: context.enrollment, plan: context.plan, scheme, score, evaluation: evaluation[0] ?? null };
}

export async function submitTrainingEvaluation(
  organizationId: string,
  profileId: string,
  enrollmentId: string,
  values: TTrainingEvaluation
) {
  const context = await getAssessmentEnrollment(organizationId, enrollmentId);
  if (!context || context.member.profileId !== profileId) {
    throw new AppError('Training enrollment not visible', ErrorCodes.ORG_TEAM_NOT_AUTHORIZED, 404);
  }
  if (context.enrollment.status !== 'COMPLETED') assessmentError('Complete training before evaluation');

  const [created] = await createTrainingEvaluation({ enrollmentId, ...values });
  if (!created) assessmentError('Training evaluation already submitted', 409);

  return created;
}

export async function getTrainingArchive(
  organizationId: string,
  profileId: string,
  memberId?: number,
  planId?: string
) {
  const overview = await getEnterpriseOverview(organizationId, profileId);
  const employees = await getEnterpriseEmployees(organizationId, profileId);
  const visibleIds = new Set(employees.map((employee) => employee.member.id));
  visibleIds.add(overview.memberId);
  if (memberId && !visibleIds.has(memberId)) {
    throw new AppError('Employee not visible', ErrorCodes.ORG_TEAM_NOT_AUTHORIZED, 404);
  }

  const memberIds = memberId ? [memberId] : overview.canManage ? undefined : [...visibleIds];
  const [rows, courseEvidence] = await Promise.all([
    listAssessmentEnrollments(organizationId, planId, memberIds),
    listArchiveCourseEvidence(organizationId, planId, memberIds)
  ]);
  const coursesByEnrollment = new Map<
    string,
    Map<
      string,
      {
        id: string;
        title: string;
        certificateAt: string | null;
        expiresAt: string | null;
        certificateStatus: string | null;
      }
    >
  >();
  for (const evidence of courseEvidence) {
    let courses = coursesByEnrollment.get(evidence.enrollmentId);
    if (!courses) {
      courses = new Map();
      coursesByEnrollment.set(evidence.enrollmentId, courses);
    }

    const certificateAt = evidence.certificateIssuedAt ?? evidence.certificateEarnedAt;
    const previous = courses.get(evidence.courseId);
    if (!previous || (certificateAt && (!previous.certificateAt || certificateAt > previous.certificateAt))) {
      courses.set(evidence.courseId, {
        id: evidence.courseId,
        title: evidence.courseTitle,
        certificateAt,
        expiresAt: evidence.certificateExpiresAt,
        certificateStatus: evidence.certificateStatus
      });
    }
  }

  const now = Date.now();
  return rows.map((row) => {
    const courses = [...(coursesByEnrollment.get(row.enrollment.id)?.values() ?? [])];
    return {
      enrollmentId: row.enrollment.id,
      planId: row.plan.id,
      planName: row.plan.name,
      planType: row.plan.planType,
      memberId: row.member.id,
      memberEmail: row.member.email,
      departmentId: row.member.departmentId,
      assignedAt: row.enrollment.assignedAt,
      completedAt: row.enrollment.completedAt,
      endAt: row.plan.endAt,
      status:
        (row.enrollment.status === 'NOT_STARTED' || row.enrollment.status === 'IN_PROGRESS') &&
        row.plan.status !== 'CANCELLED' &&
        Date.parse(row.plan.endAt) < now
          ? 'EXPIRED'
          : row.enrollment.status,
      progressPercent: row.enrollment.progressPercent,
      finalScore: row.score?.finalScore ?? null,
      result: row.score?.result ?? 'PENDING',
      satisfactionRating: row.evaluation?.satisfactionRating ?? null,
      courses
    };
  });
}

export async function getTrainingArchiveSummary(organizationId: string, profileId: string, memberId?: number) {
  const overview = await getEnterpriseOverview(organizationId, profileId);
  const records = await getTrainingArchive(organizationId, profileId, memberId ?? overview.memberId);
  const scored = records.filter((record) => record.finalScore !== null);
  const courseIds = new Set(records.flatMap((record) => record.courses.map((course) => course.id)));
  const learningMinutes = await countLearningMinutesForMembers(
    organizationId,
    [memberId ?? overview.memberId],
    [...courseIds]
  );
  const certifiedCourseIds = new Set(
    records.flatMap((record) => record.courses.filter((course) => course.certificateAt).map((course) => course.id))
  );
  const nearestCertificateExpiry = getNearestCertificateExpiry(
    records.flatMap((record) => record.courses),
    Date.now()
  );
  return {
    trainingCount: records.length,
    courseCount: courseIds.size,
    certificateCount: certifiedCourseIds.size,
    nearestCertificateExpiry,
    actualLearningHours: Math.round((learningMinutes / 60) * 100) / 100,
    trainingPoints: null,
    averageScore: scored.length
      ? Math.round((scored.reduce((sum, record) => sum + record.finalScore!, 0) / scored.length) * 10) / 10
      : null,
    passRate: scored.length
      ? Math.round((records.filter((record) => record.result === 'PASS').length / scored.length) * 1000) / 10
      : null,
    records
  };
}

function getNearestCertificateExpiry(
  courses: Array<{ certificateStatus: string | null; expiresAt: string | null }>,
  now: number
) {
  return (
    courses
      .filter((course) => course.certificateStatus === 'valid' && course.expiresAt)
      .map((course) => course.expiresAt!)
      .filter((expiry) => Date.parse(expiry) > now)
      .sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? null
  );
}

export async function getTrainingMatrix(organizationId: string, profileId: string) {
  const overview = await requireAssessmentReportReader(organizationId, profileId);
  const [plans, employees, records] = await Promise.all([
    listTrainingPlans(organizationId),
    getEnterpriseEmployees(organizationId, profileId),
    getTrainingArchive(organizationId, profileId)
  ]);
  const visiblePlanIds = new Set(records.map((record) => record.planId));
  const publishedPlans = plans.filter(
    (plan) =>
      plan.status !== 'DRAFT' && plan.status !== 'CANCELLED' && (overview.canManage || visiblePlanIds.has(plan.id))
  );
  const byMemberAndPlan = new Map(records.map((record) => [`${record.memberId}:${record.planId}`, record]));
  const now = Date.now();
  return {
    plans: publishedPlans.map((plan) => ({ id: plan.id, name: plan.name })),
    employees: employees
      .filter((employee) => employee.member.status === 'ACTIVE' && employee.member.employmentStatus !== 'TERMINATED')
      .map((employee) => ({
        memberId: employee.member.id,
        name: employee.fullname ?? employee.email ?? employee.member.email ?? String(employee.member.id),
        departmentId: employee.member.departmentId,
        cells: publishedPlans.map((plan) => {
          const record = byMemberAndPlan.get(`${employee.member.id}:${plan.id}`);
          const nearestCertificateExpiry = getNearestCertificateExpiry(record?.courses ?? [], now);
          return {
            planId: plan.id,
            enrollmentId: record?.enrollmentId ?? null,
            status: record?.status ?? null,
            finalScore: record?.finalScore ?? null,
            nearestCertificateExpiry,
            certificateExpiringSoon:
              nearestCertificateExpiry !== null && Date.parse(nearestCertificateExpiry) <= now + 30 * 86400000
          };
        })
      }))
  };
}

export async function getTrainingStatistics(
  organizationId: string,
  profileId: string,
  planId?: string,
  from?: string,
  to?: string
) {
  await requireAssessmentReportReader(organizationId, profileId);

  const records = await getTrainingArchive(organizationId, profileId, undefined, planId);
  const fromTime = from ? Date.parse(`${from}T00:00:00+08:00`) : -Infinity;
  const toTime = to ? Date.parse(`${to}T00:00:00+08:00`) + 86400000 : Infinity;
  if (fromTime >= toTime) assessmentError('Statistics start date must not exceed end date');
  const rows = records.filter((record) => {
    const assignedAt = Date.parse(record.assignedAt);
    return assignedAt >= fromTime && assignedAt < toTime;
  });
  const memberIds = [...new Set(rows.map((row) => row.memberId))];
  const courseIds = [...new Set(rows.flatMap((row) => row.courses.map((course) => course.id)))];
  const learningMinutes = await countLearningMinutesForMembers(
    organizationId,
    memberIds,
    courseIds,
    from ? new Date(fromTime).toISOString() : undefined,
    to ? new Date(toTime).toISOString() : undefined
  );
  const scored = rows.filter((row) => row.finalScore !== null);
  const evaluated = rows.filter((row) => row.satisfactionRating !== null);
  const departmentGroups = new Map<string, typeof rows>();
  const monthlyGroups = new Map<string, { assigned: number; completed: number }>();
  const planTypeGroups = new Map<string, number>();
  const courseGroups = new Map<string, { title: string; assigned: number }>();
  const unfinishedGroups = new Map<string, { name: string; count: number }>();
  const monthFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit'
  });
  function countMonthlyEvent(timestamp: string, event: 'assigned' | 'completed') {
    const eventTime = Date.parse(timestamp);
    if (eventTime < fromTime || eventTime >= toTime) return;

    const monthParts = monthFormatter.formatToParts(new Date(timestamp));
    const year = monthParts.find((part) => part.type === 'year')?.value;
    const month = monthParts.find((part) => part.type === 'month')?.value;
    const monthKey = `${year}-${month}`;
    const group = monthlyGroups.get(monthKey) ?? { assigned: 0, completed: 0 };
    group[event] += 1;
    monthlyGroups.set(monthKey, group);
  }

  for (const row of records) {
    countMonthlyEvent(row.assignedAt, 'assigned');
    if (row.status === 'COMPLETED' && row.completedAt) countMonthlyEvent(row.completedAt, 'completed');
  }

  for (const row of rows) {
    const departmentKey = row.departmentId ?? 'unassigned';
    departmentGroups.set(departmentKey, [...(departmentGroups.get(departmentKey) ?? []), row]);
    planTypeGroups.set(row.planType, (planTypeGroups.get(row.planType) ?? 0) + 1);
    for (const course of row.courses) {
      const group = courseGroups.get(course.id);
      courseGroups.set(course.id, { title: course.title, assigned: (group?.assigned ?? 0) + 1 });
    }

    if (row.status !== 'COMPLETED') {
      const group = unfinishedGroups.get(row.planId);
      unfinishedGroups.set(row.planId, { name: row.planName, count: (group?.count ?? 0) + 1 });
    }
  }

  const completed = rows.filter((row) => row.status === 'COMPLETED').length;
  const passed = rows.filter((row) => row.result === 'PASS').length;
  return {
    assigned: rows.length,
    learners: new Set(rows.map((row) => row.memberId)).size,
    plans: new Set(rows.map((row) => row.planId)).size,
    completed,
    completionRate: rows.length ? Math.round((completed / rows.length) * 1000) / 10 : null,
    passed,
    failed: rows.filter((row) => row.result === 'FAIL').length,
    pending: rows.filter((row) => row.result === 'PENDING').length,
    averageScore: scored.length
      ? Math.round((scored.reduce((sum, row) => sum + row.finalScore!, 0) / scored.length) * 10) / 10
      : null,
    passRate: scored.length ? Math.round((passed / scored.length) * 1000) / 10 : null,
    averageSatisfaction: evaluated.length
      ? Math.round((evaluated.reduce((sum, row) => sum + row.satisfactionRating!, 0) / evaluated.length) * 10) / 10
      : null,
    actualLearningHours: Math.round((learningMinutes / 60) * 100) / 100,
    byDepartment: [...departmentGroups].map(([departmentId, group]) => {
      const departmentScored = group.filter((row) => row.finalScore !== null);
      return {
        departmentId,
        assigned: group.length,
        completed: group.filter((row) => row.status === 'COMPLETED').length,
        completionRate:
          Math.round((group.filter((row) => row.status === 'COMPLETED').length / group.length) * 1000) / 10,
        averageScore: departmentScored.length
          ? Math.round(
              (departmentScored.reduce((sum, row) => sum + row.finalScore!, 0) / departmentScored.length) * 10
            ) / 10
          : null
      };
    }),
    monthlyTrend: [...monthlyGroups]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, group]) => ({ month, ...group })),
    byPlanType: [...planTypeGroups].map(([type, count]) => ({ type, count })),
    popularCourses: [...courseGroups]
      .map(([courseId, group]) => ({ courseId, ...group }))
      .sort((a, b) => b.assigned - a.assigned)
      .slice(0, 10),
    unfinishedPlans: [...unfinishedGroups]
      .map(([planId, group]) => ({ planId, ...group }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  };
}
