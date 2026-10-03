<script lang="ts">
  import { ContentType } from '@cio/utils/constants/content';
  import CourseContentIcon from '$features/course/components/course-content-icon.svelte';
  import { t } from '$lib/utils/functions/translations';

  interface Props {
    lessons: number;
    exercises: number;
  }

  let { lessons, exercises }: Props = $props();
</script>

<span
  role="img"
  aria-label={$t('course.sidebar.content_count.lessons', { count: lessons })}
  title={$t('course.sidebar.content_count.lessons', { count: lessons })}
  class="ui:border-border inline-flex shrink-0 items-center gap-1 rounded border px-1 py-0.5 text-[10px] leading-none tabular-nums"
>
  <span aria-hidden="true"><CourseContentIcon type={ContentType.Lesson} size={10} /></span>
  <span>{lessons}</span>
</span>
<span
  role="img"
  aria-label={$t('course.sidebar.content_count.exercises', { count: exercises })}
  title={$t('course.sidebar.content_count.exercises', { count: exercises })}
  class="ui:border-border inline-flex shrink-0 items-center gap-1 rounded border px-1 py-0.5 text-[10px] leading-none tabular-nums"
>
  <span aria-hidden="true"><CourseContentIcon type={ContentType.Exercise} size={10} /></span>
  <span>{exercises}</span>
</span>
