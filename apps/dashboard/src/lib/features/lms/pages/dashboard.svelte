<script lang="ts">
  import { Button } from '@cio/ui/base/button';
  import { CoursesPage } from '$features/course/pages';
  import { CourseCardList } from '$features/course/components';
  import { t, locale } from '$lib/utils/functions/translations';
  import { currentOrg } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import { coursesApi } from '$features/course/api';
  import { enterpriseApi } from '$features/enterprise/api/enterprise.svelte';
  import { myTrainingApi } from '$features/enterprise/api/my-training.svelte';
  import { AssessmentApi } from '$features/enterprise/api/assessment.svelte';
  import { isStudentCourseComplete } from '$features/course/utils/compliance-utils';
  import { getStudentCourseContinuePath } from '$features/course/utils/student-course-navigation';
  import UpcomingSessionsCard from '$features/lms/components/upcoming-sessions-card.svelte';
  import CoursePreviewModal from '$features/lms/components/course-preview-modal.svelte';
  import type { RecommendedCourses } from '$features/course/types';

  const assessmentApi = new AssessmentApi();
  let loadedFor = '';
  let searchValue = $state('');
  let selectedCourse = $state<RecommendedCourses[number] | null>(null);
  let previewOpen = $state(false);
  const visibleCourses = $derived(
    coursesApi.enrolledCourses.filter((course) => course.title.toLowerCase().includes(searchValue.trim().toLowerCase()))
  );
  const ownEmployee = $derived(
    enterpriseApi.employees.find((employee) => employee.member.id === enterpriseApi.overview?.memberId)
  );
  const ownDepartment = $derived(
    enterpriseApi.overview?.departments.find((department) => department.id === ownEmployee?.member.departmentId)
  );
  const inProgressCourses = $derived(coursesApi.enrolledCourses.filter((course) => !isStudentCourseComplete(course)));
  const pendingTraining = $derived(
    myTrainingApi.assignments.filter(
      (assignment) =>
        assignment.planStatus === 'PUBLISHED' &&
        !['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(assignment.enrollmentStatus)
    )
  );
  const upcomingTraining = $derived(
    [...pendingTraining]
      .filter((assignment) => Date.parse(assignment.startAt) > Date.now())
      .sort((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt))
      .slice(0, 3)
  );
  const upcomingExams = $derived(
    [
      ...new Map(
        myTrainingApi.assignments.flatMap((assignment) => assignment.exams).map((exam) => [exam.id, exam])
      ).values()
    ]
      .filter((exam) => Date.parse(exam.opensAt) > Date.now())
      .sort((left, right) => Date.parse(left.opensAt) - Date.parse(right.opensAt))
      .slice(0, 3)
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
  const upcomingSessions = $derived(
    coursesApi.enrolledCourses
      .filter((course) => course.type === 'LIVE_CLASS' && course.upcomingSession)
      .map((course) => ({
        lessonId: course.upcomingSession!.lessonId,
        courseTitle: course.title,
        lessonTitle: course.upcomingSession!.lessonTitle,
        callUrl: course.upcomingSession!.callUrl,
        lessonAt: course.upcomingSession!.lessonAt,
        timezone: course.upcomingSession!.sessionTimezone
      }))
      .sort((left, right) => Date.parse(left.lessonAt) - Date.parse(right.lessonAt))
  );

  $effect(() => {
    const organizationId = $currentOrg.id;
    const profileId = $profile.id;
    if (!organizationId || !profileId) return;

    const nextKey = organizationId + ':' + profileId;
    if (loadedFor === nextKey) return;

    loadedFor = nextKey;
    void coursesApi.getEnrolledCourses();
    void coursesApi.getRecommendedCourses({ limit: 3 });
    void enterpriseApi.load(organizationId);
    void myTrainingApi.load(organizationId, profileId);
    void assessmentApi.loadArchiveSummary(organizationId);
  });

  function dateLabel(value: string) {
    return new Date(value).toLocaleDateString($locale === 'zh' ? 'zh-CN' : $locale);
  }
</script>

<div class="space-y-6 pb-8">
  <section class="training-panel space-y-5" aria-label={$t('enterprise.my_training.title')}>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold">{$profile.fullname}</h2>
        <p class="ui:text-muted-foreground mt-1 text-sm">
          {$t('enterprise.department')}: {ownDepartment?.name ?? '—'} · {$t('enterprise.position')}: {ownEmployee
            ?.member.position ?? '—'}
        </p>
      </div>
      {#if inProgressCourses[0]}
        <Button href={getStudentCourseContinuePath(inProgressCourses[0].id)} size="sm"
          >{$t('dashboard.continue_learning')}</Button
        >
      {:else}
        <Button href="/lms/training/archive" variant="outline" size="sm">{$t('enterprise.assessment.archive')}</Button>
      {/if}
    </div>
    <div class="training-metrics grid gap-5 border-t pt-5 sm:grid-cols-2 lg:grid-cols-5">
      <p class="text-sm">
        {$t('enterprise.assessment.unfinished_plans')}<strong
          >{myTrainingApi.loading || myTrainingApi.error ? '—' : pendingTraining.length}</strong
        >
      </p>
      <p class="text-sm">
        {$t('dashboard.currently_learning')}<strong
          >{coursesApi.isLoading || coursesApi.error ? '—' : inProgressCourses.length}</strong
        >
      </p>
      <p class="text-sm">
        {$t('enterprise.assessment.average_score')}<strong>{assessmentApi.archiveSummary?.averageScore ?? '—'}</strong>
      </p>
      <p class="text-sm">
        {$t('enterprise.assessment.training_count')}<strong>{assessmentApi.archiveSummary?.trainingCount ?? '—'}</strong
        >
      </p>
      <p class="text-sm">
        {$t('enterprise.assessment.learning_hours')}<strong
          >{assessmentApi.archiveSummary?.actualLearningHours ?? '—'}</strong
        >
      </p>
    </div>
  </section>

  <section class="learner-course-section space-y-4">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-xl font-semibold">{$t('my_learning.heading')}</h2>
      <Button href="/lms/mylearning" variant="outline" size="sm">{$t('dashboard.view_more')}</Button>
    </div>
    <CoursesPage
      bind:searchValue
      courses={visibleCourses}
      isLMS
      isLoading={coursesApi.isLoading}
      showSortSelect={false}
    >
      {#snippet emptyAction()}
        <Button href="/lms/explore">{$t('my_learning.find_courses')}</Button>
      {/snippet}
    </CoursesPage>
  </section>

  <section class="training-panel grid gap-6 md:grid-cols-3" aria-label={$t('enterprise.my_training.title')}>
    <div class="space-y-3">
      <h3 class="font-semibold">{$t('dashboard.enterprise_home.upcoming_training')}</h3>
      {#each upcomingTraining as assignment (assignment.enrollmentId)}
        <a class="ui:hover:text-primary block text-sm" href={'/lms/training/' + assignment.enrollmentId}
          >{assignment.name} · {dateLabel(assignment.startAt)}</a
        >
      {:else}
        <p class="ui:text-muted-foreground text-sm">{$t('enterprise.my_training.pending')}</p>
      {/each}
    </div>
    <div class="space-y-3">
      <h3 class="font-semibold">{$t('dashboard.enterprise_home.upcoming_exams')}</h3>
      {#each upcomingExams as exam (exam.id)}
        <a class="ui:hover:text-primary block text-sm" href={'/courses/' + exam.courseId + '/exercises/' + exam.id}
          >{exam.title} · {dateLabel(exam.opensAt)}</a
        >
      {:else}
        <p class="ui:text-muted-foreground text-sm">{$t('enterprise.my_training.pending')}</p>
      {/each}
    </div>
    <div class="space-y-3">
      <h3 class="font-semibold">{$t('dashboard.enterprise_home.recent_certificates')}</h3>
      {#each recentCertificates as course (course.id + ':' + course.certificateAt)}
        <a class="ui:hover:text-primary block text-sm" href={'/courses/' + course.id + '/certificates'}
          >{course.title} · {dateLabel(course.certificateAt!)}</a
        >
      {:else}
        <p class="ui:text-muted-foreground text-sm">{$t('enterprise.my_training.pending')}</p>
      {/each}
    </div>
  </section>
  <UpcomingSessionsCard sessions={upcomingSessions} />
  {#if coursesApi.recommendedCourses.length}
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold">{$t('dashboard.explore_more_courses')}</h2>
        <Button href="/lms/explore" variant="outline" size="sm">{$t('dashboard.view_more')}</Button>
      </div>
      <CourseCardList
        courses={coursesApi.recommendedCourses}
        isLMS
        isExplore
        onCardClick={(course) => {
          selectedCourse = coursesApi.recommendedCourses.find((recommended) => recommended.id === course.id) ?? null;
          previewOpen = true;
        }}
      />
    </section>
  {/if}
  {#if selectedCourse}<CoursePreviewModal course={selectedCourse} bind:open={previewOpen} />{/if}
</div>
