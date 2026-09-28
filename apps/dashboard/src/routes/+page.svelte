<script lang="ts">
  import { onMount } from 'svelte';

  import { appInitApi } from '$features/app/init.svelte';
  import { Spinner } from '@cio/ui/base/spinner';
  import { Button } from '@cio/ui/base/button';
  import FrownIcon from '@lucide/svelte/icons/frown';
  import { Empty } from '@cio/ui/custom/empty';
  import { t } from '$lib/utils/functions/translations';
  import { PUBLIC_IS_SELFHOSTED } from '$env/static/public';
  import { buildOrgLandingPageProps, normalizeLandingPageSettings } from '$features/org/utils/landing-page';
  import { user } from '$lib/utils/store/user';
  import { getOrgLandingAuthAction } from '$features/org/utils/org-landing-auth-action';

  let { data } = $props();

  const hasSetupError = $derived(!appInitApi.loading && !!appInitApi.error);
  const showOrgLanding = $derived(data.isOrgSite && data.org && (PUBLIC_IS_SELFHOSTED !== 'true' || !data.locals.user));

  const pageTitle = $derived(
    data.isOrgSite && data.org ? data.org.name : `${$t('enterprise.title')} · ${$t('enterprise.company_name')}`
  );

  const authAction = $derived.by(() =>
    data.org
      ? getOrgLandingAuthAction({
          isLoggedIn: $user.isLoggedIn,
          isInitialized: appInitApi.isInitializedAndReady,
          org: data.org,
          organizations: appInitApi.data?.success ? appInitApi.data.organizations : [],
          hasPendingInvite: !!appInitApi.pendingOrgInvite
        })
      : undefined
  );
  const ThemeComponent = $derived(data.ThemeComponent);

  const landingPageProps = $derived.by(() => {
    if (!data.isOrgSite || !data.org) return null;

    return buildOrgLandingPageProps(
      data.org,
      normalizeLandingPageSettings(data.org.landingpage),
      data.courses,
      data.hasMoreCourses,
      authAction
    );
  });

  onMount(() => {
    if (!showOrgLanding) {
      if (!appInitApi.loading) {
        appInitApi.setupApp(data.locals, {
          isOrgSite: data.isOrgSite,
          orgSiteName: data.orgSiteName
        });
      }
    }
  });
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

{#if showOrgLanding}
  {#if ThemeComponent && landingPageProps}
    <ThemeComponent {...landingPageProps} />
  {/if}
{:else if hasSetupError}
  <Empty
    title={$t('login.auth_failure.title')}
    description={$t('login.auth_failure.description')}
    icon={FrownIcon}
    variant="page"
    layout="full-page"
  >
    <div class="flex gap-2">
      <Button variant="secondary" onclick={() => window.location.reload()}>{$t('common.app_update.reload')}</Button>
      <Button variant="default" href="/login">{$t('login.signup_disabled.go_to_login')}</Button>
    </div>
  </Empty>
{:else}
  <div class="flex min-h-screen w-full flex-col items-center justify-center gap-5 p-6 text-center">
    <img src="/enterprise-training-icon.png" alt={$t('enterprise.company_name')} class="size-16 rounded-xl" />
    <div>
      <h1 class="ui:text-foreground text-lg font-semibold">{$t('enterprise.company_name')}</h1>
      <p class="ui:text-muted-foreground mt-2 text-sm">{$t('enterprise.title')}</p>
    </div>
    <div role="status" class="ui:text-muted-foreground flex items-center gap-2 text-sm">
      <Spinner class="ui:text-primary size-5" />
      {$t('enterprise.loading')}
    </div>
  </div>
{/if}
