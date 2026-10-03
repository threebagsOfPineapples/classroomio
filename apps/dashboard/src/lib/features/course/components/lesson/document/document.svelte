<script lang="ts">
  import { courseApi, lessonApi } from '$features/course/api';
  import { CloseButton, DeleteModal } from '$features/ui';
  import { lessonDocUpload } from '$features/course/components/lesson/store';
  import MODES from '$lib/utils/constants/mode';
  import { IconButton } from '@cio/ui/custom/icon-button';
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import ZoomInIcon from '@lucide/svelte/icons/zoom-in';
  import ZoomOutIcon from '@lucide/svelte/icons/zoom-out';
  import MaximizeIcon from '@lucide/svelte/icons/maximize';
  import MinimizeIcon from '@lucide/svelte/icons/minimize';
  import { Button } from '@cio/ui/base/button';
  import { onMount, tick, untrack } from 'svelte';
  import {
    getLessonDocumentIdentity,
    getPdfReadingResource,
    isPdfDocument
  } from '@cio/utils/functions/lesson-document';
  import DocumentList from './document-list.svelte';
  import { getInlinePdfDocument, isPdfPageEndVisible } from './document-utils';
  import { t } from '$lib/utils/functions/translations';
  import type { LessonDocument } from '$features/course/utils/types';
  import { snackbar } from '$features/ui/snackbar/store';
  import { isOrgAdmin, isOrgManagerRole } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';

  interface Props {
    mode?: (typeof MODES)[keyof typeof MODES];
  }

  let { mode = MODES.view }: Props = $props();

  const courseMember = $derived(courseApi.group.people.find((member) => member.profileId === $profile.id));
  const canDownload = $derived(
    !!$isOrgAdmin ||
      isOrgManagerRole(Number(courseMember?.roleId)) ||
      courseApi.course?.metadata?.lessonDownload === true
  );

  let openDeleteDocumentModal = $state(false);
  let documentIndexToDelete = $state<number | null>(null);
  let viewingPDF: LessonDocument | null = $state(null);
  let pdfViewerOpen = $state(false);
  let isFullscreen = $state(false);
  let mounted = $state(false);
  let pdfViewer: HTMLDivElement | undefined = $state();
  let pdfCanvas: HTMLCanvasElement | undefined = $state();
  let pdfViewport: HTMLDivElement | undefined = $state();
  let renderedPage = 0;
  let pdfDoc: any = null;
  let pageNum = $state(1);
  let pageCount = $state(0);
  let scale = $state(1.0);
  let isLoading = $state(false);
  let error: string | null = $state(null);
  let pdfjsLib: any = null;
  let renderTimeout: any = null;
  let currentRenderTask: any = null;
  const viewedPages = new Set<number>();
  let viewerVersion = 0;
  let renderVersion = 0;
  let viewingLessonId = $state<string | null>(null);
  let automaticDocumentKey: string | null = null;

  const inlineDocument = $derived(lessonApi.lesson ? getInlinePdfDocument(lessonApi.lesson) : null);
  const inlineDocumentKey = $derived(
    mode === MODES.view && inlineDocument
      ? `${lessonApi.lesson?.id}:${getPdfReadingResource(inlineDocument)}:${inlineDocument.link}`
      : null
  );

  $effect(() => {
    if (!mounted) return;

    const nextDocumentKey = inlineDocumentKey;
    untrack(() => {
      if (automaticDocumentKey === nextDocumentKey) return;

      automaticDocumentKey = nextDocumentKey;
      closePDFViewer();
      if (nextDocumentKey && inlineDocument) void viewPDF(inlineDocument);
    });
  });

  onMount(() => {
    const script = document.createElement('script');
    script.src = '/js/pdf.js/pdf.min.js';
    script.onload = () => {
      pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdf.js/pdf.worker.min.js';
    };
    document.head.appendChild(script);
    mounted = true;
    window.addEventListener('scroll', recordVisiblePage, true);
    window.addEventListener('resize', handleResize);
    window.addEventListener('focus', recordVisiblePage);

    return () => {
      closePDFViewer();
      window.removeEventListener('scroll', recordVisiblePage, true);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('focus', recordVisiblePage);
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  });

  function openDocumentUploadModal() {
    $lessonDocUpload.isModalOpen = true;
  }

  function deleteDocument(index: number) {
    void lessonApi.deleteLessonDocument(index);
  }

  function requestRemoveDocument(index: number) {
    documentIndexToDelete = index;
    openDeleteDocumentModal = true;
  }

  function confirmRemoveDocument() {
    if (documentIndexToDelete !== null) {
      deleteDocument(documentIndexToDelete);
      documentIndexToDelete = null;
    }
    openDeleteDocumentModal = false;
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async function downloadDocument(doc: LessonDocument) {
    if (!canDownload) {
      snackbar.error('course.navItem.lessons.materials.tabs.document.download_disabled');
      return;
    }

    const courseId = courseApi.course?.id;
    const lessonId = lessonApi.lesson?.id;
    const documentId = getLessonDocumentIdentity(doc);
    if (!courseId || !lessonId || !documentId) {
      snackbar.error('interface_feedback.document_not_loaded_correctly');
      return;
    }

    const approvedDownload = await lessonApi.getDocumentDownload(courseId, lessonId, documentId);
    if (!approvedDownload) return;

    try {
      const response = await fetch(approvedDownload.url);
      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = approvedDownload.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      snackbar.success($t('course.navItem.lessons.materials.tabs.document.download_success'));
    } catch (error) {
      console.error('Error downloading document:', error);
      snackbar.error($t('course.navItem.lessons.materials.tabs.document.download_error'));
    }
  }

  function debouncedRender() {
    renderedPage = 0;
    if (renderTimeout) {
      clearTimeout(renderTimeout);
    }
    renderTimeout = setTimeout(() => {
      renderPage();
      renderTimeout = null;
    }, 150);
  }
  async function viewPDF(attachment: LessonDocument, fullscreen = false) {
    closePDFViewer();
    const openingVersion = viewerVersion;
    viewedPages.clear();
    viewingPDF = attachment;
    viewingLessonId = lessonApi.lesson?.id ?? null;
    pdfViewerOpen = true;
    isFullscreen = fullscreen;
    isLoading = true;
    error = null;

    try {
      if (!getPdfReadingResource(attachment) || !attachment.link) throw new Error('Missing PDF resource');

      for (let attempt = 0; !pdfjsLib && attempt < 100; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (openingVersion !== viewerVersion) return;
      }
      if (!pdfjsLib) throw new Error('PDF reader unavailable');

      const response = await fetch(attachment.link);
      if (!response.ok) throw new Error('Failed to fetch PDF');

      const arrayBuffer = await response.arrayBuffer();
      if (openingVersion !== viewerVersion) return;

      const loadedPdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      if (openingVersion !== viewerVersion) {
        void loadedPdf.destroy();
        return;
      }

      pdfDoc = loadedPdf;
      pageCount = pdfDoc.numPages;
      pageNum = 1;
      scale = 1.0;
      isLoading = false;
      await renderPage();
    } catch (err) {
      if (openingVersion !== viewerVersion) return;

      console.error('Error loading PDF:', err);
      error = 'course.navItem.lessons.materials.tabs.document.failed_to_load_pdf';
      isLoading = false;
    }
  }

  async function renderPage() {
    if (!pdfDoc || !viewingPDF || !pdfViewerOpen) return;

    const renderingVersion = ++renderVersion;
    const renderingViewer = viewerVersion;
    const renderingDocument = pdfDoc;
    const renderingPage = pageNum;
    const renderingScale = scale;
    renderedPage = 0;

    let attempts = 0;
    while (!pdfCanvas && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    if (renderingVersion !== renderVersion || renderingViewer !== viewerVersion) return;

    if (!pdfCanvas) {
      console.error('Canvas not available after waiting');
      return;
    }

    try {
      if (currentRenderTask) {
        currentRenderTask.cancel();
      }

      const page = await renderingDocument.getPage(renderingPage);
      if (renderingVersion !== renderVersion || renderingViewer !== viewerVersion) return;

      const originalViewport = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(1, (pdfViewport?.clientWidth ?? originalViewport.width) - 32);
      const fitScale = Math.min(1, availableWidth / originalViewport.width);
      const viewport = page.getViewport({ scale: fitScale * renderingScale });

      pdfCanvas.height = viewport.height;
      pdfCanvas.width = viewport.width;

      const ctx = pdfCanvas.getContext('2d');
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };

      currentRenderTask = page.render(renderContext);
      await currentRenderTask.promise;
      if (renderingVersion !== renderVersion || renderingViewer !== viewerVersion) return;

      currentRenderTask = null;
      if (renderingPage !== pageNum) return;

      renderedPage = renderingPage;
      recordVisiblePage();
    } catch (err) {
      if (renderingVersion !== renderVersion || renderingViewer !== viewerVersion) return;
      if (err instanceof Error && err.name === 'RenderingCancelledException') return;

      console.error('Error rendering page:', err);
      error = 'course.navItem.lessons.materials.tabs.document.failed_to_render_pdf';
      currentRenderTask = null;
    }
  }

  function recordVisiblePage() {
    if (!pdfViewerOpen || !pdfCanvas || !pdfViewport || !viewingPDF || renderedPage !== pageNum) return;
    if (document.visibilityState !== 'visible' || !document.hasFocus()) return;

    const canvasBottom = pdfCanvas.getBoundingClientRect().bottom;
    const viewportBounds = pdfViewport.getBoundingClientRect();
    if (!isPdfPageEndVisible(canvasBottom, viewportBounds, window.innerHeight)) return;

    viewedPages.add(renderedPage);
    const resource = getPdfReadingResource(viewingPDF);
    if (resource && viewedPages.size === pageCount && renderedPage === pageCount) {
      window.dispatchEvent(
        new CustomEvent('lesson-reading-resource', {
          detail: { lessonId: viewingLessonId, resource }
        })
      );
    }
  }

  function nextPage() {
    if (pageNum < pageCount) {
      pageNum++;
      debouncedRender();
    }
  }

  function prevPage() {
    if (pageNum > 1) {
      pageNum--;
      debouncedRender();
    }
  }

  function zoomIn() {
    scale = Math.min(scale + 0.25, 3.0);
    debouncedRender();
  }

  function zoomOut() {
    scale = Math.max(scale - 0.25, 0.5);
    debouncedRender();
  }

  function handleViewPDF(doc: LessonDocument) {
    const inlineResource = inlineDocument ? getPdfReadingResource(inlineDocument) : null;
    const fullscreen = mode === MODES.edit || getPdfReadingResource(doc) !== inlineResource;
    void viewPDF(doc, fullscreen);
  }

  function handleViewDocument(doc: LessonDocument) {
    if (isPdfDocument(doc)) {
      handleViewPDF(doc);
      return;
    }

    snackbar.info(
      canDownload
        ? 'course.navItem.lessons.materials.tabs.document.preview_unavailable'
        : 'course.navItem.lessons.materials.tabs.document.download_disabled'
    );
  }

  function reorderDocuments(documents: LessonDocument[]) {
    lessonApi.updateLessonState('documents', documents);
  }

  function closePDFViewer() {
    renderedPage = 0;
    viewerVersion++;
    renderVersion++;
    if (currentRenderTask) {
      currentRenderTask.cancel();
    }

    if (renderTimeout) {
      clearTimeout(renderTimeout);
    }

    pdfViewerOpen = false;
    isFullscreen = false;
    viewingPDF = null;
    viewingLessonId = null;
    if (pdfDoc) void pdfDoc.destroy();
    pdfDoc = null;
    pageNum = 1;
    pageCount = 0;
    scale = 1.0;
    error = null;
    currentRenderTask = null;
    renderTimeout = null;
  }

  function handleResize() {
    if (!pdfViewerOpen) return;

    debouncedRender();
  }

  async function toggleFullscreen() {
    isFullscreen = !isFullscreen;
    await tick();
    await renderPage();
  }

  function focusViewer(event: PointerEvent) {
    if (event.target instanceof Element && event.target.closest('button, a, input, textarea, select')) return;

    pdfViewer?.focus({ preventScroll: true });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!pdfViewerOpen || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]'))
      return;
    if (!isFullscreen && (!pdfViewer || !pdfViewer.contains(document.activeElement))) return;

    switch (event.key) {
      case 'ArrowLeft':
        prevPage();
        break;
      case 'ArrowRight':
        nextPage();
        break;
      case '+':
      case '=':
        zoomIn();
        break;
      case '-':
        zoomOut();
        break;
      case 'Escape':
        if (isFullscreen) void toggleFullscreen();
        else closePDFViewer();
        break;
      default:
        return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  });

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
  }

  function handleDragStart(event: DragEvent) {
    event.preventDefault();
  }

  let displayDocuments = $derived(lessonApi.lesson?.documents || []);
</script>

{#if pdfViewerOpen}
  <div
    bind:this={pdfViewer}
    data-testid="lesson-pdf-viewer"
    data-reading-lesson={viewingLessonId}
    data-presentation={isFullscreen ? 'fullscreen' : 'inline'}
    role="region"
    aria-label={viewingPDF?.name}
    tabindex="-1"
    onpointerdown={focusViewer}
    class={isFullscreen
      ? 'ui:z-modal fixed inset-0 flex flex-col bg-white dark:bg-neutral-800'
      : 'my-4 flex min-w-0 flex-col overflow-hidden rounded-lg border bg-white dark:bg-neutral-800'}
  >
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:bg-neutral-800"
    >
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <h2 class="max-w-full truncate text-lg font-semibold text-gray-900 sm:max-w-md dark:text-gray-300">
          {viewingPDF?.name}
        </h2>
        {#if !isLoading && !error}
          <span class="text-sm text-gray-500">
            {$t('course.navItem.lessons.materials.tabs.document.page_of', {
              page: pageNum,
              total: pageCount
            })}
          </span>
        {/if}
      </div>

      <div class="flex shrink-0 items-center space-x-2">
        {#if !isLoading && !error}
          <div class="flex items-center space-x-1">
            <IconButton
              onclick={prevPage}
              disabled={pageNum <= 1}
              tooltip={$t('pdf_reader.previous')}
              aria-label={$t('pdf_reader.previous')}
            >
              <ChevronLeftIcon size={16} />
            </IconButton>

            <IconButton
              onclick={nextPage}
              disabled={pageNum >= pageCount}
              tooltip={$t('pdf_reader.next')}
              aria-label={$t('pdf_reader.next')}
            >
              <ChevronRightIcon size={16} />
            </IconButton>
          </div>

          <div class="flex items-center space-x-1">
            <IconButton
              onclick={zoomOut}
              disabled={scale <= 0.5}
              tooltip={$t('pdf_reader.zoom_out')}
              aria-label={$t('pdf_reader.zoom_out')}
            >
              <ZoomOutIcon size={16} />
            </IconButton>

            <span class="min-w-12 text-center text-sm text-gray-600">
              {Math.round(scale * 100)}%
            </span>

            <IconButton
              onclick={zoomIn}
              disabled={scale >= 3.0}
              tooltip={$t('pdf_reader.zoom_in')}
              aria-label={$t('pdf_reader.zoom_in')}
            >
              <ZoomInIcon size={16} />
            </IconButton>
          </div>
        {/if}

        <IconButton
          onclick={() => void toggleFullscreen()}
          tooltip={$t(isFullscreen ? 'pdf_reader.exit_fullscreen' : 'pdf_reader.fullscreen')}
          aria-label={$t(isFullscreen ? 'pdf_reader.exit_fullscreen' : 'pdf_reader.fullscreen')}
        >
          {#if isFullscreen}<MinimizeIcon size={16} />{:else}<MaximizeIcon size={16} />{/if}
        </IconButton>

        <CloseButton onClick={closePDFViewer} tooltip={$t('pdf_reader.close')} />
      </div>
    </div>

    <div
      bind:this={pdfViewport}
      data-testid="lesson-pdf-viewport"
      class={isFullscreen
        ? 'min-h-0 flex-1 overflow-auto bg-gray-100 p-4'
        : 'h-[min(65vh,680px)] min-h-72 overflow-auto bg-gray-100 p-4'}
    >
      {#if isLoading}
        <div class="flex h-full items-center justify-center">
          <div class="text-center">
            <div
              class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
            ></div>
            <p class="text-gray-600">
              {$t('course.navItem.lessons.materials.tabs.document.loading_pdf')}
            </p>
          </div>
        </div>
      {:else if error}
        <div class="flex h-full items-center justify-center">
          <div class="text-center">
            <div class="mb-4 text-red-500">
              <svg class="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <p class="mb-2 text-red-600">{$t(error)}</p>
            <Button variant="outline" onclick={() => viewingPDF && viewPDF(viewingPDF, isFullscreen)}>
              {$t('course.navItem.lessons.materials.tabs.document.try_again')}
            </Button>
          </div>
        </div>
      {:else}
        <div class="flex justify-center">
          <canvas
            bind:this={pdfCanvas}
            oncontextmenu={handleContextMenu}
            ondragstart={handleDragStart}
            class="shadow-lg"
          ></canvas>
        </div>
      {/if}
    </div>

    {#if !isLoading && !error}
      <div class="border-t border-gray-200 bg-gray-50 px-4 py-2">
        <p class="text-center text-xs text-gray-500">
          {$t('course.navItem.lessons.materials.tabs.document.use_arrow_keys')}
        </p>
      </div>
    {/if}
  </div>
{/if}

<DocumentList
  {mode}
  {displayDocuments}
  {canDownload}
  {formatFileSize}
  {openDocumentUploadModal}
  {requestRemoveDocument}
  onViewDocument={handleViewDocument}
  {downloadDocument}
  {reorderDocuments}
/>

<DeleteModal bind:open={openDeleteDocumentModal} onDelete={confirmRemoveDocument} />

<style>
  canvas {
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    pointer-events: auto;
  }
</style>
