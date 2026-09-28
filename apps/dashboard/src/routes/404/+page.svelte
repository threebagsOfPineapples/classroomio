<script>
  import { page } from '$app/state';
  import { Button } from '@cio/ui/base/button';
  import SearchXIcon from '@lucide/svelte/icons/search-x';
  import { Empty } from '@cio/ui/custom/empty';
  import { t } from '$lib/utils/functions/translations';

  let query = $derived(new URLSearchParams(page.url.search));
  let isOrg = $derived(query.get('type') === 'org');

  function handleClick() {
    window.location.href = '/';
  }
</script>

<svelte:head>
  <title>{$t('common.page_not_found')} · {$t('enterprise.company_name')}</title>
</svelte:head>

<Empty
  title={isOrg ? $t('common.organization_not_found') : $t('common.page_not_found')}
  description={$t('common.page_not_found_description')}
  icon={SearchXIcon}
  variant="page"
  layout="full-page"
>
  <Button onclick={handleClick}>{$t('login.auth_failure.back_home')}</Button>
</Empty>
