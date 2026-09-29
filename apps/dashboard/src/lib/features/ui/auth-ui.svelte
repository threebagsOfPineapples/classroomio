<script lang="ts">
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import * as Avatar from '@cio/ui/base/avatar';
  import { t } from '$lib/utils/functions/translations';
  import { currentOrg } from '$lib/utils/store/org';
  import Dingtalk from '$features/auth/components/dingtalk.svelte';
  import * as Card from '@cio/ui/base/card';
  import { Separator } from '@cio/ui/base/separator';
  import { preventDefault } from '$lib/utils/functions/svelte';
  import { ROUTE } from '$lib/utils/constants/routes';
  import { DotPattern } from '@cio/ui/custom/animation/dot-pattern';
  import { PUBLIC_IS_SELFHOSTED } from '$env/static/public';

  interface Props {
    isLogin?: boolean;
    showOnlyContent?: boolean;
    isLoading?: boolean;
    showLogo?: boolean;
    handleSubmit?: () => void;
    children?: Snippet;
    getPasswordAuthAlternative?: Snippet;
  }

  let {
    isLogin = true,
    showOnlyContent = false,
    isLoading = false,
    showLogo = false,
    handleSubmit = () => {},
    children,
    getPasswordAuthAlternative
  }: Props = $props();

  const authBackgroundUrl = $derived($currentOrg.customization.auth?.backgroundImage?.trim() ?? '');
</script>

<div class="auth-ui-background relative flex min-h-screen w-full items-center justify-center overflow-hidden p-4">
  {#if authBackgroundUrl}
    <div class="absolute inset-0 z-0">
      <img src={authBackgroundUrl} alt="" class="h-full w-full object-cover" decoding="async" />
      <div class="absolute inset-0 bg-black/45" aria-hidden="true"></div>
    </div>
  {:else}
    <DotPattern fillColor="rgb(232 90 12 / 0.12)" class="absolute inset-0 z-0 h-full w-full" />
  {/if}
  <Card.Root class="relative z-10 w-full max-w-[400px] shadow-sm">
    {#if !showOnlyContent || showLogo}
      <Card.Header class="flex flex-col items-center gap-4">
        <a
          href={resolve(ROUTE.HOME, {})}
          class="inline-flex"
          aria-label={$currentOrg.name || $t('enterprise.company_name')}
        >
          <Avatar.Root>
            <Avatar.Image src="/enterprise-training-icon.png" alt={$currentOrg.name || $t('enterprise.company_name')} />
            <Avatar.Fallback>{$currentOrg.name || $t('enterprise.company_name')}</Avatar.Fallback>
          </Avatar.Root>
        </a>

        {#if !showOnlyContent}
          <a href={resolve('/', {})}>
            <Card.Title class="text-2xl font-normal!">
              {isLogin ? $t('login.welcome') : $t('login.create_account')}
            </Card.Title>
          </a>
        {/if}
      </Card.Header>
    {/if}

    <Card.Content>
      <form onsubmit={preventDefault(handleSubmit)}>
        {@render children?.()}
      </form>

      {#if !showOnlyContent}
        <div class="mt-6 flex flex-col gap-6">
          <div class="relative flex items-center justify-center">
            <Separator />
            <span class="ui:bg-card ui:text-muted-foreground absolute px-2 text-sm">{$t('login.continue_with')}</span>
          </div>

          {#if getPasswordAuthAlternative}
            {@render getPasswordAuthAlternative()}
          {:else}
            <Dingtalk disabled={isLoading} />
          {/if}
        </div>
      {/if}
    </Card.Content>
    {#if !showOnlyContent}
      <Card.Footer class="flex-col gap-2 border-t pt-6">
        <p class="ui:text-muted-foreground text-center text-sm">
          {#if isLogin}
            {#if PUBLIC_IS_SELFHOSTED === 'true'}
              {$t('enterprise.platform_description')}
            {:else}
              {$t('login.not_registered_yet')}
              <a class="ui:text-primary hover:underline" href="/signup{page.url.search}">{$t('login.signup')}</a>
            {/if}
          {:else}
            {$t('login.already_have_account')}
            <a class="ui:text-primary hover:underline" href="/login{page.url.search}">{$t('login.login')}</a>
          {/if}
        </p>
      </Card.Footer>
    {/if}
  </Card.Root>
</div>
