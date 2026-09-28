<script lang="ts">
  import { untrack } from 'svelte';
  import { profile } from '$lib/utils/store/user';
  import { currentOrg } from '$lib/utils/store/org';
  import { coursesApi } from '$features/course/api';
  import LearningCourses from '../components/learning-courses.svelte';

  let loadedFor = '';
  $effect(() => {
    const key = $currentOrg.id + ':' + $profile.id;
    if (!$profile.id || !$currentOrg.id || key === loadedFor) return;

    loadedFor = key;
    untrack(() => void coursesApi.getEnrolledCourses());
  });
</script>

<LearningCourses
  courses={coursesApi.enrolledCourses}
  loading={coursesApi.isLoading}
  error={coursesApi.error}
  onRetry={() => void coursesApi.getEnrolledCourses()}
/>
