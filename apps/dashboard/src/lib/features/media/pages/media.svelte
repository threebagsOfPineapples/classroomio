<script lang="ts">
  import * as Item from '@cio/ui/base/item';
  import * as Page from '@cio/ui/base/page';
  import { Button } from '@cio/ui/base/button';
  import { Empty } from '@cio/ui/custom/empty';
  import VideoIcon from '@lucide/svelte/icons/video';

  import type { TAssetUpdate } from '@cio/utils/validation/assets';

  import {
    AssetCard,
    AssetUsageDialog,
    DeleteAssetDialog,
    EditAssetDialog,
    ManageThumbnailsDialog,
    MediaFilters,
    StorageCards
  } from '$features/media/components';
  import { mediaApi } from '$features/media/api';
  import type { AssetKindFilter, AssetStatusFilter, AssetUsageGraph, OrganizationAsset } from '$features/media/utils';
  import { snackbar } from '$features/ui/snackbar/store';
  import { t } from '$lib/utils/functions/translations';
  import { currentOrgPath } from '$lib/utils/store/org';

  interface Props {
    search?: string;
    kind?: AssetKindFilter;
    status?: AssetStatusFilter;
  }

  let {
    search = $bindable(''),
    kind = $bindable('all' as AssetKindFilter),
    status = $bindable('all' as AssetStatusFilter)
  }: Props = $props();

  let isRefreshing = $state(false);
  let editOpen = $state(false);
  let usageOpen = $state(false);
  let manageThumbsOpen = $state(false);
  let deleteOpen = $state(false);
  let isSavingAsset = $state(false);
  let isUsageLoading = $state(false);
  let isDeleting = $state(false);
  let downloadingAssetId = $state<string | null>(null);
  let selectedAsset = $state<OrganizationAsset | null>(null);
  let usageData = $state<AssetUsageGraph | null>(null);
  let appliedFilters = $state({ search: '', kind: 'all' as AssetKindFilter, status: 'all' as AssetStatusFilter });

  const assets = $derived(mediaApi.assets);
  const storageSummary = $derived(mediaApi.storageSummary);
  const pagination = $derived(mediaApi.pagination);
  const hasActiveFilters = $derived(
    Boolean(appliedFilters.search) || appliedFilters.kind !== 'all' || appliedFilters.status !== 'all'
  );

  async function refreshAssets(page = 1) {
    isRefreshing = true;
    const nextFilters = { search: search.trim(), kind, status };
    try {
      await mediaApi.listAssets({
        page,
        limit: pagination?.limit ?? 20,
        search: nextFilters.search || undefined,
        kind: nextFilters.kind === 'all' ? undefined : nextFilters.kind,
        status: nextFilters.status === 'all' ? undefined : nextFilters.status
      });
      appliedFilters = nextFilters;
    } finally {
      isRefreshing = false;
    }
  }

  async function refreshStorageSummary() {
    await mediaApi.getStorageSummary();
  }

  async function refreshMediaData() {
    await Promise.all([refreshAssets(1), refreshStorageSummary()]);
  }

  function openEditAsset(asset: OrganizationAsset) {
    selectedAsset = asset;
    editOpen = true;
  }

  function openManageThumbnails(asset: OrganizationAsset) {
    selectedAsset = asset;
    manageThumbsOpen = true;
  }

  async function saveAsset(fields: TAssetUpdate) {
    if (!selectedAsset) return;

    isSavingAsset = true;
    try {
      const updated = await mediaApi.updateAsset(selectedAsset.id, fields);
      if (!updated) return;

      selectedAsset = updated;
      editOpen = false;
      snackbar.success('snackbar.media_manager.update_success');
      await refreshStorageSummary();
    } finally {
      isSavingAsset = false;
    }
  }

  async function loadUsage(asset: OrganizationAsset) {
    isUsageLoading = true;
    try {
      usageData = await mediaApi.getAssetUsage(asset.id);
    } finally {
      isUsageLoading = false;
    }
  }

  async function openUsage(asset: OrganizationAsset) {
    selectedAsset = asset;
    usageOpen = true;
    usageData = null;
    await loadUsage(asset);
  }

  async function refreshUsage() {
    if (!selectedAsset) return;

    await loadUsage(selectedAsset);
  }

  function resetUsageModalState() {
    selectedAsset = null;
    usageData = null;
    isUsageLoading = false;
  }

  async function openDelete(asset: OrganizationAsset) {
    selectedAsset = asset;
    deleteOpen = true;
    usageData = null;
    await loadUsage(asset);
  }

  async function confirmDelete() {
    if (!selectedAsset) return;

    isDeleting = true;
    try {
      const deleted = await mediaApi.deleteAsset(selectedAsset.id);
      if (!deleted) return;

      deleteOpen = false;
      await refreshStorageSummary();
    } finally {
      isDeleting = false;
    }
  }

  function handleDeleteOpenChange(isOpen: boolean) {
    if (!isOpen) {
      resetUsageModalState();
    }
  }

  async function downloadAsset(asset: OrganizationAsset) {
    downloadingAssetId = asset.id;
    try {
      const url = await mediaApi.getAssetDownloadUrl(asset);
      if (!url) {
        snackbar.error('snackbar.media_manager.download_failed');
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      downloadingAssetId = null;
    }
  }

  function handleUsageOpenChange(isOpen: boolean) {
    if (!isOpen) {
      resetUsageModalState();
    }
  }

  const prevPage = $derived(Math.max(1, (pagination?.page ?? 1) - 1));
  const nextPage = $derived((pagination?.page ?? 1) + 1);
</script>

<Page.BodyHeader class="flex-col flex-wrap! items-start! gap-3 lg:flex-row">
  <MediaFilters
    bind:search
    bind:kind
    bind:status
    {isRefreshing}
    onApply={() => refreshAssets(1)}
    onRefresh={refreshMediaData}
  />
  <Button href="{$currentOrgPath}/courses" variant="outline" size="sm">
    {$t('enterprise.media.add_from_course')}
  </Button>
</Page.BodyHeader>

{#if assets.length === 0}
  <Empty
    title={$t(hasActiveFilters ? 'enterprise.media.no_results_title' : 'media_manager.empty')}
    description={$t(hasActiveFilters ? 'enterprise.media.no_results_description' : 'media_manager.empty_description')}
    icon={VideoIcon}
    variant="page"
  >
    {#if !hasActiveFilters}
      <Button href="{$currentOrgPath}/courses" variant="default">
        {$t('enterprise.media.add_from_course')}
      </Button>
    {/if}
  </Empty>
{:else}
  <Item.Group class="grid! w-full grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
    {#each assets as asset (asset.id)}
      <AssetCard
        {asset}
        {downloadingAssetId}
        onEdit={openEditAsset}
        onUsage={openUsage}
        onDownload={downloadAsset}
        onManageThumbnails={openManageThumbnails}
        onDelete={openDelete}
      />
    {/each}
  </Item.Group>
{/if}

{#if pagination && pagination.totalPages > 1}
  <div class="flex items-center justify-end gap-2">
    <Button
      variant="outline"
      size="sm"
      disabled={isRefreshing || (pagination?.page ?? 1) <= 1}
      onclick={() => refreshAssets(prevPage)}
    >
      {$t('media_manager.pagination.previous')}
    </Button>
    <p class="ui:text-muted-foreground text-sm">
      {$t('media_manager.pagination.page')}
      {pagination.page}
      / {pagination.totalPages}
    </p>
    <Button
      variant="outline"
      size="sm"
      disabled={isRefreshing || (pagination?.page ?? 1) >= pagination.totalPages}
      onclick={() => refreshAssets(nextPage)}
    >
      {$t('media_manager.pagination.next')}
    </Button>
  </div>
{/if}

<StorageCards {storageSummary} />

<EditAssetDialog bind:open={editOpen} asset={selectedAsset} isSaving={isSavingAsset} onSave={saveAsset} />

<ManageThumbnailsDialog bind:open={manageThumbsOpen} asset={selectedAsset} />

<AssetUsageDialog
  bind:open={usageOpen}
  {selectedAsset}
  {usageData}
  isLoading={isUsageLoading}
  onRefresh={refreshUsage}
  onOpenChange={handleUsageOpenChange}
/>

<DeleteAssetDialog
  bind:open={deleteOpen}
  asset={selectedAsset}
  {usageData}
  isLoadingUsage={isUsageLoading}
  {isDeleting}
  onConfirm={confirmDelete}
  onRefresh={refreshUsage}
  onOpenChange={handleDeleteOpenChange}
/>
