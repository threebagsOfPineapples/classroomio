<script>
  import { t } from '$lib/utils/functions/translations';
  import { onMount } from 'svelte';
  import { Spinner } from '@cio/ui/base/spinner';
  import PlayContainer from './container.svelte';
  import PlayHeader from './header/index.svelte';
  import { quizStore, playQuizStore } from '$lib/utils/store/org';
  import { STEPS } from '$lib/utils/constants/quiz';
  import { genQuizPin } from '$lib/utils/functions/org';
  import { Button } from '@cio/ui/base/button';

  let isGettingPin = $state(true);

  function getPin() {
    setTimeout(() => {
      $quizStore.pin = genQuizPin();
      isGettingPin = false;
    }, 3000);
  }

  function goToPlayersStep() {
    $playQuizStore.step = STEPS.WAIT_FOR_PLAYERS;
  }

  onMount(() => {
    getPin();
  });
</script>

<PlayContainer>
  {#snippet header()}
    <div>
      <PlayHeader startCount={true} showCountDown={true} />
    </div>
  {/snippet}

  {#snippet body()}
    <div class="w-full rounded-md bg-white px-5 py-7 dark:bg-neutral-800">
      <div class="mb-3">
        <p>{$t('interface_copy.1_visit')}</p>
        <h3>play.classroomio.com</h3>
      </div>
      <div class="">
        <p>{$t('interface_copy.2_enter_pin')}</p>
        {#if isGettingPin}
          <Spinner class="size-10! text-blue-700!" />
        {:else}
          <h3>{$quizStore.pin}</h3>
        {/if}
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex items-center justify-center">
      <p class="mr-3">{$t('interface_copy.let_s_go')}</p>
      <Button variant="outline" onclick={goToPlayersStep}>{$t('interface_copy.view_players')}</Button>
    </div>
  {/snippet}
</PlayContainer>
