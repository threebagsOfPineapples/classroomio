<script lang="ts">
  import { untrack } from 'svelte';
  import { currentOrg } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import { t } from '$lib/utils/functions/translations';
  import { SurveyApi } from '$lib/features/survey/api/survey.svelte';
  import { Button } from '@cio/ui/base/button';
  import { ScrollToTop } from '@cio/ui/custom/scroll-to-top';
  import * as Page from '@cio/ui/base/page';
  const api = new SurveyApi();
  let loadedContext = '';
  $effect(() => {
    const context = `${$currentOrg.id}:${$profile.id}`;
    if (context === loadedContext) return;

    loadedContext = context;
    untrack(() => {
      if ($currentOrg.id && $profile.id) void api.load($currentOrg.id, $profile.id, false);
      else api.clear();
    });
  });
</script>

<svelte:head><title>{$t('survey.my_title')}</title></svelte:head>
<Page.Root class="mx-auto max-w-3xl px-4">
  <Page.Header
    ><Page.HeaderContent
      ><Page.Title>{$t('survey.my_title')}</Page.Title><Page.Subtitle>{$t('survey.my_subtitle')}</Page.Subtitle
      ></Page.HeaderContent
    ></Page.Header
  >
  <Page.Body
    >{#snippet child()}
      {#if api.error}<p role="alert" class="rounded-md bg-red-50 p-3 text-red-700">{api.error}</p>{/if}
      <Button variant="outline" disabled={api.loading} onclick={() => api.load($currentOrg.id, $profile.id, false)}
        >{$t('survey.refresh')}</Button
      >
      {#if api.loading}<p role="status">{$t('survey.loading')}</p>{/if}
      <div class="space-y-4 py-4">
        {#each api.mine as task}<article class="ui:border-border space-y-3 rounded-xl border p-4">
            <h2 class="text-lg font-semibold">{task.title}</h2>
            <p>
              {$t(`survey.purpose_${task.purpose.toLowerCase()}`)} · {$t(
                task.anonymous ? 'survey.anonymous' : 'survey.named'
              )}
            </p>
            <p class="ui:text-muted-foreground text-sm">{new Date(task.endsAt).toLocaleString()}</p>
            <Button
              class="min-h-11"
              variant="secondary"
              href={`/lms/surveys/${task.id}?organizationId=${encodeURIComponent($currentOrg.id)}`}
              >{$t(
                task.submitted
                  ? 'survey.receipt'
                  : task.window === 'OPEN'
                    ? 'survey.fill'
                    : task.window === 'CLOSED'
                      ? 'survey.closed'
                      : 'survey.not_open'
              )}</Button
            >
          </article>{:else}{#if !api.loading && !api.error}<p>{$t('survey.empty')}</p>{/if}{/each}
      </div>
    {/snippet}</Page.Body
  >
</Page.Root>
<ScrollToTop label={$t('common.scroll_to_top')} />
