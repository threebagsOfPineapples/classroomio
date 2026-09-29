<script lang="ts">
  import { untrack } from 'svelte';
  import { Button } from '@cio/ui/base/button';
  import BookOpenIcon from '@lucide/svelte/icons/book-open';
  import ClockIcon from '@lucide/svelte/icons/clock';
  import AwardIcon from '@lucide/svelte/icons/award';
  import { t, locale } from '$lib/utils/functions/translations';
  import { currentOrg } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import { coursesApi } from '$features/course/api';
  import { enterpriseApi } from '$features/enterprise/api/enterprise.svelte';
  import { myTrainingApi } from '$features/enterprise/api/my-training.svelte';
  import { AssessmentApi } from '$features/enterprise/api/assessment.svelte';
  import { lmsExercisesApi } from '$features/lms/api/exercises.svelte';
  import { filterLearningCourses, getCourseLearningAction } from '$features/course/utils/course-learning';
  import { getHomeExams, getPendingTraining } from '../utils/home-model';
  import LearningCourses from '../components/learning-courses.svelte';
  import UpcomingSessionsCard from '../components/upcoming-sessions-card.svelte';

  const assessmentApi = new AssessmentApi();
  let loadedFor = '';
  const pendingCourses = $derived(filterLearningCourses(coursesApi.enrolledCourses, 'pending'));
  const requiredCourses = $derived(coursesApi.enrolledCourses.filter((course) => course.required === true));
  const optionalCourses = $derived(coursesApi.enrolledCourses.filter((course) => course.required === false));
  const completedCourses = $derived(filterLearningCourses(coursesApi.enrolledCourses, 'completed'));
  const startedCourses = $derived(filterLearningCourses(coursesApi.enrolledCourses, 'in_progress'));
  const nextCourse = $derived(startedCourses[0] ?? pendingCourses[0] ?? completedCourses[0]);
  const nextAction = $derived(nextCourse ? getCourseLearningAction(nextCourse) : null);
  const pendingTraining = $derived(getPendingTraining(myTrainingApi.assignments));
  const activeTraining = $derived(pendingTraining.filter((assignment) => Date.parse(assignment.startAt) <= Date.now()));
  const upcomingTraining = $derived(
    pendingTraining
      .filter((assignment) => Date.parse(assignment.startAt) > Date.now())
      .sort((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt))
      .slice(0, 3)
  );
  const exams = $derived(
    getHomeExams(myTrainingApi.assignments, lmsExercisesApi.exercises, lmsExercisesApi.examAccess, Date.now())
  );
  const examTasks = $derived(
    exams.filter((exam) => ['open', 'in_progress', 'unknown', 'unavailable'].includes(exam.state))
  );
  const upcomingExams = $derived(exams.filter((exam) => exam.state === 'upcoming').slice(0, 3));
  const ownEmployee = $derived(
    enterpriseApi.employees.find((employee) => employee.member.id === enterpriseApi.overview?.memberId)
  );
  const ownDepartment = $derived(
    enterpriseApi.overview?.departments.find((department) => department.id === ownEmployee?.member.departmentId)
  );
  const recentCertificates = $derived.by(() => {
    const seen = new Set<string>();
    return (assessmentApi.archiveSummary?.records ?? [])
      .flatMap((record) => record.courses)
      .filter((course) => course.certificateAt)
      .sort((left, right) => Date.parse(right.certificateAt!) - Date.parse(left.certificateAt!))
      .filter((course) => {
        const key = course.id + ':' + course.certificateAt;
        if (seen.has(key)) return false;

        seen.add(key);
        return true;
      })
      .slice(0, 3);
  });
  const learningHours = $derived(assessmentApi.archiveSummary?.actualLearningHours);
  const upcomingSessions = $derived(
    coursesApi.enrolledCourses
      .filter((course) => course.type === 'LIVE_CLASS' && course.upcomingSession)
      .map((course) => {
        const session = course.upcomingSession!;
        return {
          lessonId: session.lessonId,
          courseTitle: course.title,
          lessonTitle: session.lessonTitle,
          callUrl: session.callUrl,
          lessonAt: session.lessonAt,
          timezone: session.sessionTimezone
        };
      })
      .sort((left, right) => Date.parse(left.lessonAt) - Date.parse(right.lessonAt))
  );

  $effect(() => {
    const organizationId = $currentOrg.id;
    const profileId = $profile.id;
    if (!organizationId || !profileId) return;

    const key = organizationId + ':' + profileId;
    if (key === loadedFor) return;

    loadedFor = key;
    untrack(() => {
      void coursesApi.getEnrolledCourses();
      void enterpriseApi.load(organizationId);
      void assessmentApi.loadArchiveSummary(organizationId);
      void reloadTasks();
    });
  });

  async function reloadTasks() {
    const organizationId = $currentOrg.id;
    const profileId = $profile.id;
    await myTrainingApi.load(organizationId, profileId);
    if ($currentOrg.id !== organizationId || $profile.id !== profileId) return;

    await lmsExercisesApi.fetchLMSExercises(organizationId);
    await lmsExercisesApi.fetchExamAccess(myTrainingApi.assignments);
  }

  function dateLabel(value: string) {
    return new Date(value).toLocaleDateString($locale === 'zh' ? 'zh-CN' : $locale);
  }
</script>

{#snippet retry(action: () => void)}
  <p class="text-sm" role="alert">{$t('enterprise.load_failed')}</p>
  <Button size="sm" variant="outline" onclick={action}>{$t('enterprise.ui_v2.retry')}</Button>
{/snippet}

<div class="learner-home-v2 space-y-6 pb-8">
  <div class="learner-summary-grid">
    <section class="training-panel learner-summary-card">
      <h2><BookOpenIcon aria-hidden="true" />{$t('enterprise.learner_home.progress')}</h2>
      {#if coursesApi.isLoading}<p>{$t('enterprise.loading')}</p>
      {:else if coursesApi.error}{@render retry(() => void coursesApi.getEnrolledCourses())}
      {:else}
        <div class="learner-summary-values">
          <p>
            {$t('enterprise.learner_home.required')}<strong
              >{filterLearningCourses(requiredCourses, 'completed').length}</strong
            ><span>/ {requiredCourses.length}</span>
          </p>
          <p>
            {$t('enterprise.learner_home.optional')}<strong
              >{filterLearningCourses(optionalCourses, 'completed').length}</strong
            ><span>/ {optionalCourses.length}</span>
          </p>
        </div>
        <p class="learner-summary-note">
          {$t('enterprise.learner_home.progress_hint', {
            completed: completedCourses.length,
            total: coursesApi.enrolledCourses.length
          })}
        </p>
      {/if}
    </section>
    <section class="training-panel learner-summary-card">
      <h2><ClockIcon aria-hidden="true" />{$t('enterprise.assessment.learning_hours')}</h2>
      <div class="learner-summary-values">
        <p>
          {$t('enterprise.learner_home.total_time')}<strong
            >{assessmentApi.loading || assessmentApi.error || learningHours == null
              ? '—'
              : Math.round(learningHours * 60)}</strong
          ><span>{$t('enterprise.ui_v2.minute_unit')}</span>
        </p>
        <p>
          {$t('enterprise.assessment.average_score')}<strong
            >{assessmentApi.loading || assessmentApi.error
              ? '—'
              : (assessmentApi.archiveSummary?.averageScore ?? '—')}</strong
          ><span>{$t('enterprise.ui_v2.score_unit')}</span>
        </p>
      </div>
      <div class="learner-summary-note">
        <span>{$t('enterprise.learner_home.time_hint')}</span><Button
          href="/lms/training/archive"
          variant="link"
          size="sm">{$t('enterprise.assessment.archive')}</Button
        >
      </div>
      {#if assessmentApi.error}{@render retry(() => void assessmentApi.loadArchiveSummary($currentOrg.id))}{/if}
    </section>
  </div>
  {#if nextCourse && nextAction && !coursesApi.error && !coursesApi.isLoading}
    <section class="learner-next-inline" aria-label={$t('enterprise.ui_v2.next_learning')}>
      <div>
        <span>{$t('enterprise.ui_v2.next_learning')}</span>
        <h2>{nextCourse.title}</h2>
      </div>
      <Button href={nextAction.href} size="sm">{$t(nextAction.key)}</Button>
    </section>
  {/if}
  <div class="learner-learning-grid">
    <section class="learner-courses-v2 min-w-0">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 class="text-lg font-semibold">{$t('my_learning.heading')}</h2>
        <Button href="/lms/mylearning" variant="link" size="sm">{$t('dashboard.view_more')}</Button>
      </div>
      <LearningCourses
        courses={coursesApi.enrolledCourses}
        loading={coursesApi.isLoading}
        error={coursesApi.error}
        onRetry={() => void coursesApi.getEnrolledCourses()}
      />
      <p class="ui:text-muted-foreground mt-4 text-xs leading-6">{$t('enterprise.ui_v2.completion_note')}</p>
      <UpcomingSessionsCard sessions={upcomingSessions} />
    </section>
    <section class="training-panel learner-tasks-v2 space-y-4">
      <div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold">{$t('enterprise.ui_v2.learning_tasks')}</h2>
        <Button href="/lms/training" variant="link" size="sm">{$t('dashboard.view_more')}</Button>
      </div>
      {#if myTrainingApi.loading || lmsExercisesApi.isLoading || lmsExercisesApi.accessLoading}<p
          class="ui:text-muted-foreground text-sm"
        >
          {$t('enterprise.loading')}
        </p>
      {:else if myTrainingApi.error || lmsExercisesApi.error}{@render retry(() => void reloadTasks())}
      {:else}
        {#each activeTraining.slice(0, 2) as assignment (assignment.enrollmentId)}<div class="home-task-row">
            <span class="home-task-kind">{$t('enterprise.my_training.title')}</span>
            <h3>{assignment.name}</h3>
            <p>{$t('enterprise.my_training.due')} {dateLabel(assignment.endAt)}</p>
            <Button href={'/lms/training/' + assignment.enrollmentId} variant="link" size="sm"
              >{$t('enterprise.ui_v2.view_plan')}</Button
            >
          </div>{/each}
        {#each examTasks.slice(0, 3) as exam (exam.id)}
          <div class="home-task-row">
            <span class="home-task-kind">{$t(`enterprise.ui_v2.exam_${exam.state}`)}</span>
            <h3>{exam.title}</h3>
            <p>{$t('enterprise.my_training.due')} {dateLabel(exam.closesAt)}</p>
            {#if ['open', 'in_progress'].includes(exam.state)}<Button
                href={'/courses/' + exam.courseId + '/exercises/' + exam.id}
                variant="link"
                size="sm">{$t('enterprise.ui_v2.view_exam')}</Button
              >{:else if exam.state === 'unknown'}<Button variant="link" size="sm" onclick={() => void reloadTasks()}
                >{$t('enterprise.ui_v2.retry')}</Button
              >{/if}
          </div>
        {/each}
        {#if !activeTraining.length && !examTasks.length}<div class="training-empty">
            <h3>{$t('enterprise.ui_v2.no_tasks')}</h3>
            <p>{$t('enterprise.ui_v2.no_tasks_hint')}</p>
          </div>{/if}
        {#if examTasks.length}<p class="ui:text-muted-foreground text-xs leading-5">
            {$t('enterprise.ui_v2.exam_eligibility_note')}
          </p>{/if}
      {/if}
    </section>
    <section class="training-panel learner-training-v2 space-y-4">
      <h2 class="font-semibold">{$t('dashboard.enterprise_home.upcoming_training')}</h2>
      {#if myTrainingApi.loading || lmsExercisesApi.isLoading || lmsExercisesApi.accessLoading}<p
          class="ui:text-muted-foreground text-sm"
        >
          {$t('enterprise.loading')}
        </p>{:else if myTrainingApi.error || lmsExercisesApi.error}{@render retry(() => void reloadTasks())}{:else}
        {#each upcomingTraining as assignment (assignment.enrollmentId)}<a
            class="home-task-row block"
            href={'/lms/training/' + assignment.enrollmentId}
            ><h3>{assignment.name}</h3>
            <p>{dateLabel(assignment.startAt)} — {dateLabel(assignment.endAt)}</p></a
          >{/each}
        {#each upcomingExams as exam (exam.id)}<div class="home-task-row">
            <span class="home-task-kind">{$t('enterprise.ui_v2.exam_upcoming')}</span>
            <h3>{exam.title}</h3>
            <p>{dateLabel(exam.opensAt)}</p>
          </div>{/each}
        {#if !upcomingTraining.length && !upcomingExams.length}<p class="ui:text-muted-foreground text-sm">
            {$t('enterprise.ui_v2.no_upcoming')}
          </p>{/if}
      {/if}
    </section>
    <section class="training-panel learner-certificates-v2 space-y-4">
      <h2 class="font-semibold">{$t('dashboard.enterprise_home.recent_certificates')}</h2>
      {#if assessmentApi.loading}<p class="ui:text-muted-foreground text-sm">
          {$t('enterprise.loading')}
        </p>{:else if assessmentApi.error}{@render retry(
          () => void assessmentApi.loadArchiveSummary($currentOrg.id)
        )}{:else}
        {#each recentCertificates as course (course.id + ':' + course.certificateAt)}<a
            class="flex items-start gap-3"
            href={'/courses/' + course.id + '/certificates'}
            ><AwardIcon class="custom certificate-mark" /><span class="home-task-row"
              ><h3>{course.title}</h3>
              <p>{dateLabel(course.certificateAt!)}</p></span
            ></a
          >{:else}<p class="ui:text-muted-foreground text-sm">{$t('enterprise.ui_v2.no_certificates')}</p>{/each}
      {/if}
    </section>
  </div>
  <p class="ui:text-muted-foreground border-t pt-4 text-xs">
    {$profile.fullname} · {$t('enterprise.department')}: {enterpriseApi.loading || enterpriseApi.error
      ? '—'
      : (ownDepartment?.name ?? '—')} · {$t('enterprise.position')}: {enterpriseApi.loading || enterpriseApi.error
      ? '—'
      : (ownEmployee?.member.position ?? '—')}
  </p>
</div>
