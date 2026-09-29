<script lang="ts">
  import { page } from '$app/state';
  import { t } from '$lib/utils/functions/translations';
  import TrainingArchive from '$lib/features/enterprise/components/training-archive.svelte';
  const memberId = $derived(Number(page.params.memberId));
</script>

{#if Number.isSafeInteger(memberId) && memberId > 0}
  {#key memberId}<TrainingArchive {memberId} />{/key}
{:else}
  <p role="alert">{$t('enterprise.request_failed')}</p>
{/if}
