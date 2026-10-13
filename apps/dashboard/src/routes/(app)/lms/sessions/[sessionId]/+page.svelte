<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';
  import { currentOrg } from '$lib/utils/store/org';
  import { t } from '$lib/utils/functions/translations';
  import { TrainingSessionApi } from '$lib/features/training-session/api/training-session.svelte';
  import { Button } from '@cio/ui/base/button';
  import * as Page from '@cio/ui/base/page';

  const api = new TrainingSessionApi();
  const organizationId = $derived(page.url.searchParams.get('organizationId') ?? $currentOrg.id);
  const sessionId = $derived(page.params.sessionId ?? '');
  const token = $derived(page.url.searchParams.get('token') ?? '');
  let loaded = $state('');
  const attendance = $derived(api.selected?.attendees[0]);
  const windowState = $derived.by(() => {
    const session = api.selected?.session;
    if (!session) return '';
    if (session.status !== 'PUBLISHED') return 'closed';
    if (Date.now() < Date.parse(session.checkinOpensAt)) return 'not_open';
    if (Date.now() >= Date.parse(session.checkinClosesAt)) return 'expired';
    return 'open';
  });
  $effect(() => {
    const key = `${organizationId}:${sessionId}`;
    if (!organizationId || !sessionId || loaded === key) return;

    loaded = key;
    untrack(() => void api.select(organizationId, sessionId, true));
  });
</script>

<Page.Root class="mx-auto max-w-lg px-4">
  <Page.Header
    ><Page.HeaderContent
      ><Page.Title>{$t('training_sessions.checkin_title')}</Page.Title><Page.Subtitle
        >{$t('training_sessions.self_only')}</Page.Subtitle
      ></Page.HeaderContent
    ></Page.Header
  >
  <Page.Body
    >{#snippet child()}
      {#if api.loading}<p role="status">{$t('training_sessions.loading')}</p>{/if}
      {#if api.error}<p role="alert" class="rounded-lg border border-red-300 p-4 text-red-700">{api.error}</p>
        <Button
          variant="outline"
          disabled={api.loading || api.busy}
          onclick={() => api.select(organizationId, sessionId, true)}>{$t('training_sessions.refresh')}</Button
        >{/if}
      {#if api.notice}<p role="status" class="ui:bg-muted rounded-lg p-4">{api.notice}</p>{/if}
      {#if api.selected}
        {@const session = api.selected.session}
        <article class="space-y-3 rounded-xl border p-5">
          <h2 class="text-xl font-semibold">{session.title}</h2>
          <p>{session.location}</p>
          <p class="whitespace-pre-wrap">{session.instructor}</p>
          <p>{new Date(session.startAt).toLocaleString()} — {new Date(session.endAt).toLocaleString()}</p>
          <p>
            {$t('training_sessions.window')}: {new Date(session.checkinOpensAt).toLocaleString()} — {new Date(
              session.checkinClosesAt
            ).toLocaleString()}
          </p>
        </article>
        {#if attendance}
          <section class="space-y-4 rounded-xl border p-5">
            <p class="font-semibold">
              {attendance.fullname ?? attendance.email} · {$t(
                `training_sessions.attendance.${attendance.displayStatus}`
              )}
            </p>
            {#if attendance.attendance.status === 'PRESENT'}<p>{$t('training_sessions.already_checked_in')}</p>
              <p>
                {attendance.attendance.checkedInAt ? new Date(attendance.attendance.checkedInAt).toLocaleString() : '—'}
              </p>
            {:else if attendance.attendance.status === 'LEAVE'}<p>{$t('training_sessions.errors.leave')}</p>
            {:else if windowState !== 'open'}<p role="status">{$t(`training_sessions.errors.${windowState}`)}</p>
            {:else if !token}<p>{$t('training_sessions.scan_help')}</p>
            {:else}<Button
                class="min-h-12 w-full"
                disabled={api.busy || api.loading}
                onclick={() => api.checkin(organizationId, sessionId, token)}>{$t('training_sessions.checkin')}</Button
              >{/if}
            <p class="ui:text-muted-foreground text-sm">{$t('training_sessions.independent')}</p>
          </section>
        {/if}
      {/if}
      <Button variant="outline" class="min-h-11" href="/lms/sessions">{$t('training_sessions.back')}</Button>
    {/snippet}</Page.Body
  >
</Page.Root>
