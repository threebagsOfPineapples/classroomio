<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { Button } from '@cio/ui/base/button';
  import { Search } from '@cio/ui/custom/search';
  import { Empty } from '@cio/ui/custom/empty';
  import { profile } from '$lib/utils/store/user';
  import { currentOrg } from '$lib/utils/store/org';
  import { t } from '$lib/utils/functions/translations';
  import { LMSExercisesApi } from '$features/lms/api/exercises.svelte';
  import { filterAssessmentTasks, getAssessmentTasks } from '../utils/assessment-tasks';
  import type { AssessmentTaskFilter } from '../utils/types';
  import AssessmentTaskList from '../components/assessment-task-list.svelte';

  const exercisesApi = new LMSExercisesApi();
  const filters: AssessmentTaskFilter[] = ['pending', 'upcoming', 'submitted', 'graded', 'all'];
  let filter = $state<AssessmentTaskFilter>('pending');
  let search = $state('');
  let now = $state(Date.now());
  let loadedFor = '';
  const tasks = $derived(getAssessmentTasks(exercisesApi.exercises, exercisesApi.examAccess, now));
  const visibleTasks = $derived(filterAssessmentTasks(tasks, filter, search));

  function reload() {
    now = Date.now();
    return exercisesApi.load($currentOrg.id);
  }

  $effect(() => {
    const orgId = $currentOrg.id;
    const profileId = $profile.id;
    if (!orgId || !profileId) return;

    const loadKey = `${orgId}:${profileId}`;
    if (loadedFor === loadKey) return;

    loadedFor = loadKey;
    untrack(() => void reload());
  });

  onMount(() => {
    const timer = window.setInterval(() => {
      now = Date.now();
    }, 30_000);
    return () => window.clearInterval(timer);
  });
</script>

<div class="space-y-5">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="training-filters" role="group" aria-label={$t('learner_tasks.filter')}>
      {#each filters as value}
        <Button size="sm" variant="ghost" aria-pressed={filter === value} onclick={() => (filter = value)}>
          {$t(`learner_tasks.filter_${value}`)}
          <span class="text-xs"
            >{exercisesApi.isLoading || exercisesApi.error ? '—' : filterAssessmentTasks(tasks, value).length}</span
          >
        </Button>
      {/each}
    </div>
    <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <Search
        bind:value={search}
        placeholder={$t('learner_tasks.search')}
        clearLabel={$t('public_courses.filters.clear_search')}
      />
      <Button
        size="sm"
        variant="outline"
        onclick={reload}
        disabled={exercisesApi.isLoading || exercisesApi.accessLoading}
      >
        {$t('learner_tasks.refresh')}
      </Button>
    </div>
  </div>
  {#if exercisesApi.isLoading}
    <p class="ui:text-muted-foreground py-8 text-center" role="status">{$t('enterprise.loading')}</p>
  {:else if exercisesApi.error}
    <div class="training-panel space-y-3" role="alert">
      <p>{$t('learner_tasks.load_failed')}</p>
      <Button size="sm" variant="outline" onclick={reload}>{$t('enterprise.ui_v2.retry')}</Button>
    </div>
  {:else if visibleTasks.length}
    <AssessmentTaskList tasks={visibleTasks} onRetry={reload} checking={exercisesApi.accessLoading} />
  {:else}
    <Empty
      title={$t(search.trim() ? 'enterprise.ui_v2.search_empty' : 'learner_tasks.empty')}
      description={$t(search.trim() ? 'enterprise.ui_v2.search_hint' : 'learner_tasks.empty_hint')}
    >
      {#if search.trim() || filter !== 'all'}
        <Button
          size="sm"
          variant="outline"
          onclick={() => {
            search = '';
            filter = 'all';
          }}
        >
          {$t('learner_tasks.view_all')}
        </Button>
      {/if}
    </Empty>
  {/if}
</div>
