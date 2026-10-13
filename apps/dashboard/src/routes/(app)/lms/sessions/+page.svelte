<script lang="ts">
  import { untrack } from 'svelte';
  import { currentOrg } from '$lib/utils/store/org';
  import { t } from '$lib/utils/functions/translations';
  import { TrainingSessionApi } from '$lib/features/training-session/api/training-session.svelte';
  import { Button } from '@cio/ui/base/button';
  import * as Page from '@cio/ui/base/page';

  const api = new TrainingSessionApi();
  let organizationId = $state('');
  $effect(() => {
    const nextOrganizationId = $currentOrg.id;
    if (!nextOrganizationId || nextOrganizationId === organizationId) return;

    organizationId = nextOrganizationId;
    untrack(() => void api.load(nextOrganizationId, true));
  });
</script>

<Page.Root class="mx-auto max-w-2xl px-4">
  <Page.Header
    ><Page.HeaderContent
      ><Page.Title>{$t('training_sessions.my_sessions')}</Page.Title><Page.Subtitle
        >{$t('training_sessions.learner_help')}</Page.Subtitle
      ></Page.HeaderContent
    ></Page.Header
  >
  <Page.Body
    >{#snippet child()}
      <Button variant="outline" disabled={api.loading} onclick={() => api.load(organizationId, true)}
        >{$t('training_sessions.refresh')}</Button
      >
      {#if api.loading}<p role="status">{$t('training_sessions.loading')}</p>{/if}
      {#if api.error}<p role="alert" class="text-red-700">{api.error}</p>{/if}
      {#if !api.loading && !api.error && !api.sessions.length}<p>{$t('training_sessions.my_empty')}</p>{/if}
      {#each api.sessions.filter((session) => session.status !== 'DRAFT') as session (session.id)}
        <article class="space-y-3 rounded-lg border p-4">
          <h2 class="text-lg font-semibold">{session.title}</h2>
          <p>{session.location}</p>
          <p>{new Date(session.startAt).toLocaleString()}</p>
          <p>{$t(`training_sessions.status.${session.status}`)}</p>
          <Button
            class="min-h-11"
            href={`/lms/sessions/${session.id}?organizationId=${encodeURIComponent(organizationId)}`}
            >{$t('training_sessions.open_session')}</Button
          >
        </article>
      {/each}
    {/snippet}</Page.Body
  >
</Page.Root>
