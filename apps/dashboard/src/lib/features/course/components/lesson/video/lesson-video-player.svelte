<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { MediaPlayer, type MediaPlayerI18n } from '@cio/ui/custom/media-player';
  import { presignApi } from '$features/course/api/presign.svelte';
  import { mediaApi } from '$features/media/api';
  import { jobsApi, JobPoller, type MediaJobEnvelope } from '$features/jobs';
  import { t } from '$lib/utils/functions/translations';
  import { sidePanel } from '$features/side-panel';
  import { classroomio, isAuthError } from '$lib/utils/services/api';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { lessonApi } from '$features/course/api';
  import type { AssetTranscriptPayload } from '$features/media/utils/types';
  import { isCourseLearnerView, canRecordCourseLearning } from '$lib/utils/store/app';
  import { isEnforceableLessonVideo, resolveWatchEnforcedAssetIds, type LessonVideo } from './video-card-utils';
  import { lessonVideoBus } from './lesson-video-bus.svelte';
  import { TRANSCRIPT_PANEL_ID } from './transcript-panel-definition';

  /**
   * HLS playback flag — set by the upload flow when the asset was encoded
   * via Mediabunny and stored as a manifest. `video.metadata` is untyped
   * `Record<string, unknown>` at the call site, so the cast keeps the
   * boolean lookup honest.
   */
  function isHlsVideo(v: LessonVideo): boolean {
    return Boolean((v.metadata as { hls?: boolean } | undefined)?.hls);
  }

  /**
   * Build a fully-qualified URL for an HLS manifest or segment from the
   * relative `/hls/{assetId}/{rest}` form stored in `lesson.videos[].link`.
   * Uses the typed Hono client so the URL goes through the same base every
   * other API call uses (PUBLIC_SERVER_URL locally, `${origin}/proxy/...`
   * in Cloud production — the tenant-router Worker intercepts the latter
   * and streams directly from R2).
   */
  function resolveHlsUrl(rawUrl: string): string {
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
    const match = rawUrl.match(/^\/?hls\/([^/]+)\/(.+)$/);
    if (!match) return rawUrl;

    const [, assetId, rest] = match;
    const built = classroomio.hls[':assetId']['*'].$url({ param: { assetId } });
    return built.toString().replace(/\/\*$/, '') + '/' + rest;
  }

  async function mintHlsCookie(assetId: string): Promise<{ authExpired?: boolean } | void> {
    try {
      await classroomio.organization.assets[':assetId'].hls.cookie.$post({
        param: { assetId }
      });
    } catch (error) {
      // A 401 here means the viewer's session expired — the player should
      // prompt a re-login rather than retry. Other failures (e.g. 503 when
      // HLS_SIGNING_SECRET is unset locally) fall through so playback can
      // still attempt the session-auth streaming route.
      if (isAuthError(error)) return { authExpired: true };
    }
  }

  /**
   * Fetch the transcript VTT through the typed RPC client and turn it
   * into a `blob:` URL. We can't point the `<track>` element directly at
   * the api URL: `<video crossorigin>` would force CORS on every video
   * subresource (poster on r2.dev, Plyr's `blank.mp4`, …) and break
   * those. Without `crossorigin` the browser refuses cross-origin
   * tracks. `blob:` URLs side-step both: same-origin from the browser's
   * POV, and the fetch itself runs through the same auth'd path as
   * every other API call.
   */
  let blobTrackUrl = $state<string | null>(null);
  let revokeBlobTrackUrl: (() => void) | null = null;

  async function loadTranscriptTrack(rawUrl: string): Promise<void> {
    const match = rawUrl.match(/^\/?transcripts\/([^/]+)\/track\.vtt$/);
    if (!match) {
      blobTrackUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : null;
      return;
    }

    const [, assetId] = match;
    try {
      const response = await classroomio.transcripts[':assetId']['track.vtt'].$get({ param: { assetId } });
      if (!response.ok) return;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      revokeBlobTrackUrl?.();
      revokeBlobTrackUrl = () => URL.revokeObjectURL(url);
      blobTrackUrl = url;
    } catch (error) {
      console.warn('Failed to load transcript track', error);
    }
  }

  interface Props {
    video: LessonVideo;
    courseId: string;
    lessonId: string;
    videoIndex: number;
  }

  let { video, courseId, lessonId, videoIndex }: Props = $props();

  let localTranscript = $state<AssetTranscriptPayload | null>(null);
  let localTranscriptLoading = $state(false);

  const playbackAssetId = isEnforceableLessonVideo(video) ? (video.assetId ?? null) : null;
  const uploadAssetId =
    video.type === 'upload' ? ((video as LessonVideo & { assetId?: string }).assetId ?? null) : null;
  const uploadStorageKey =
    video.type === 'upload' && typeof video.key === 'string' && video.key.length > 0 ? video.key : null;

  // YouTube assets also register on the transcript bus so the side panel
  // can display their captions once fetched.
  const youtubeAssetId =
    video.type === 'youtube' ? ((video as LessonVideo & { assetId?: string }).assetId ?? null) : null;

  /** The assetId used for transcript loading — upload or YouTube. */
  const transcriptAssetId = uploadAssetId ?? youtubeAssetId;

  /** Refresh ~10 minutes before server presign expiry (1 hour). */
  const PLAYBACK_URL_REFRESH_MS = 50 * 60 * 1000;

  let isMounted = true;
  const isHls = $derived(isHlsVideo(video));
  let playbackUrl = $state(isHlsVideo(video) ? resolveHlsUrl(video.link) : video.link);
  let playbackUrlIssuedAt = $state(Date.now());
  let playbackRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  let vttRefetchTimer: ReturnType<typeof setTimeout> | null = null;
  let jobPoller: JobPoller<MediaJobEnvelope> | null = null;

  let localSeekFn: (seconds: number) => void = () => {};

  function ownsPlaybackBus(): boolean {
    return playbackAssetId !== null && lessonVideoBus.assetId === playbackAssetId;
  }

  function syncPlaybackBus(): void {
    if (!playbackAssetId) return;

    lessonVideoBus.assetId = playbackAssetId;
    lessonVideoBus.setSeekFn(localSeekFn);
  }

  function syncTranscriptToRegistry(): void {
    if (!transcriptAssetId) return;

    lessonVideoBus.updateTranscriptSource(transcriptAssetId, {
      transcript: localTranscript,
      transcriptLoading: localTranscriptLoading
    });
  }

  $effect(() => {
    const rawUrl = localTranscript?.vttUrl;
    if (!rawUrl) {
      revokeBlobTrackUrl?.();
      revokeBlobTrackUrl = null;
      blobTrackUrl = null;
      return;
    }
    void loadTranscriptTrack(rawUrl);
  });

  $effect(() => {
    playbackUrl = isHlsVideo(video) ? resolveHlsUrl(video.link) : video.link;
    playbackUrlIssuedAt = Date.now();
    schedulePlaybackUrlRefresh();
  });

  function clearPlaybackRefreshTimer() {
    if (playbackRefreshTimer) {
      clearTimeout(playbackRefreshTimer);
      playbackRefreshTimer = null;
    }
  }

  function schedulePlaybackUrlRefresh() {
    clearPlaybackRefreshTimer();
    if (!uploadStorageKey || isHls) return;

    const delayMs = PLAYBACK_URL_REFRESH_MS - (Date.now() - playbackUrlIssuedAt);
    if (delayMs <= 0) {
      void refreshPlaybackUrlIfIdle();
      return;
    }

    playbackRefreshTimer = setTimeout(() => {
      void refreshPlaybackUrlIfIdle();
    }, delayMs);
  }

  async function refreshPlaybackUrl(): Promise<string | null> {
    if (!uploadStorageKey || !isMounted) return null;

    const urls = await presignApi.getVideoDownloadUrls([uploadStorageKey]);
    const freshUrl = urls[uploadStorageKey];

    if (!freshUrl || !isMounted) return null;

    playbackUrl = freshUrl;
    playbackUrlIssuedAt = Date.now();
    schedulePlaybackUrlRefresh();

    return freshUrl;
  }

  async function refreshPlaybackUrlIfIdle(): Promise<string | null> {
    if (lessonVideoBus.hasPlayed) return null;

    return refreshPlaybackUrl();
  }

  async function handlePlaybackReload(): Promise<boolean> {
    pendingResumeSeconds = lessonVideoBus.currentTimeSeconds;

    if (uploadStorageKey) {
      return Boolean(await refreshPlaybackUrl());
    }

    return true;
  }

  let pendingResumeSeconds: number | null = null;
  let loadedVideoElement: HTMLVideoElement | null = null;
  let watchProgressRestored = false;
  let watchProgressQueue: Promise<unknown> = Promise.resolve();
  let watchProgressAcceptedAt: number | null = null;

  function applyPendingResume() {
    if (!loadedVideoElement || pendingResumeSeconds == null || pendingResumeSeconds <= 0) return;

    loadedVideoElement.currentTime = pendingResumeSeconds;
    pendingResumeSeconds = null;
  }

  function reportWatchProgress(payload: {
    positionSeconds: number;
    playedDeltaSeconds: number;
    durationSeconds: number;
  }) {
    if (!$canRecordCourseLearning || !playbackAssetId) return;

    const assetId = playbackAssetId;
    watchProgressQueue = watchProgressQueue
      .catch(() => undefined)
      .then(async () => {
        const playedDeltaSeconds = Math.floor(payload.playedDeltaSeconds);
        if (playedDeltaSeconds > 0 && watchProgressAcceptedAt !== null) {
          const elapsedMs = performance.now() - watchProgressAcceptedAt;
          const remainingMs = playedDeltaSeconds * 1000 - elapsedMs;
          if (remainingMs > 0)
            await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.ceil(remainingMs) + 10));
        }

        const response = await lessonApi.reportWatchProgress(courseId, lessonId, {
          ...payload,
          playedDeltaSeconds,
          assetId
        });
        if (
          response &&
          'success' in response &&
          response.success &&
          (playedDeltaSeconds > 0 || watchProgressAcceptedAt === null)
        ) {
          watchProgressAcceptedAt = performance.now();
        }

        return response;
      });
  }

  function handleSourceLoaded(element: HTMLVideoElement) {
    loadedVideoElement = element;
    applyPendingResume();
    if (
      !watchProgressRestored ||
      lessonApi.lesson?.completionPolicy !== 'video_watch' ||
      !isWatchEnforcedForVideo ||
      !Number.isFinite(element.duration) ||
      element.duration <= 0
    )
      return;

    reportWatchProgress({
      positionSeconds: element.currentTime,
      playedDeltaSeconds: 0,
      durationSeconds: element.duration
    });
  }

  function clearVttRefetchTimer() {
    if (vttRefetchTimer) {
      clearTimeout(vttRefetchTimer);
      vttRefetchTimer = null;
    }
  }

  function scheduleVttRefetch(expiresAtIso: string | undefined) {
    clearVttRefetchTimer();
    if (!expiresAtIso) return;

    const deadlineMs = new Date(expiresAtIso).getTime() - 60_000;
    const delayMs = deadlineMs - Date.now();

    if (delayMs <= 0) {
      void loadTranscript();

      return;
    }

    vttRefetchTimer = setTimeout(() => {
      void loadTranscript();
    }, delayMs);
  }

  function stopJobPoller() {
    jobPoller?.stop();
    jobPoller = null;
  }

  async function loadTranscript(): Promise<void> {
    if (!transcriptAssetId) {
      if (isMounted) {
        localTranscript = null;
        syncTranscriptToRegistry();
      }

      return;
    }

    if (!isMounted) return;

    localTranscriptLoading = true;
    syncTranscriptToRegistry();

    try {
      const data = await mediaApi.getAssetTranscript(transcriptAssetId);

      if (!isMounted) return;

      localTranscript = data;
      scheduleVttRefetch(data?.vttUrlExpiresAt);
      syncTranscriptToRegistry();
    } finally {
      if (isMounted) {
        localTranscriptLoading = false;
        syncTranscriptToRegistry();
      }
    }
  }

  async function watchJobsUntilTerminalThenReload(): Promise<void> {
    if (!transcriptAssetId || localTranscript || !isMounted) return;

    stopJobPoller();

    const runs = await jobsApi.getMediaJobsForAsset(transcriptAssetId);

    if (!isMounted) return;

    const latest = runs?.[0];

    if (!latest) return;

    if (latest.job.status === 'completed') {
      void loadTranscript();

      return;
    }

    if (latest.job.status === 'failed' || latest.job.status === 'canceled') {
      return;
    }

    jobPoller = new JobPoller<MediaJobEnvelope>({
      fetch: () => jobsApi.getMediaJob(latest.job.id),
      onUpdate: (envelope) => {
        if (envelope.job.status === 'completed') {
          stopJobPoller();
          void loadTranscript();
        }

        if (envelope.job.status === 'failed' || envelope.job.status === 'canceled') {
          stopJobPoller();
        }
      }
    });
    jobPoller.start();
  }

  const isWatchEnforcedForVideo = $derived.by(() => {
    const lesson = lessonApi.lesson;
    if (!lesson || !playbackAssetId) return false;

    const enforcedAssetIds = resolveWatchEnforcedAssetIds(lesson.videos, lesson.completionPolicy);

    return enforcedAssetIds.includes(playbackAssetId);
  });

  const assetWatchProgress = $derived.by(() => {
    const lesson = lessonApi.lesson;
    if (!lesson?.watchProgress?.assets || !playbackAssetId) return null;

    return lesson.watchProgress.assets.find((asset) => asset.assetId === playbackAssetId) ?? null;
  });

  const seekPolicy = $derived.by(() => {
    const lesson = lessonApi.lesson;
    if (!$canRecordCourseLearning || !lesson || lesson.completionPolicy !== 'video_watch' || !isWatchEnforcedForVideo) {
      return undefined;
    }

    return {
      mode: 'tracking' as const,
      watchThresholdPercent: lesson.videoWatchThreshold ?? 95,
      initialFurthestSeconds: assetWatchProgress?.furthestSeconds ?? 0,
      pauseOnHidden: true,
      onProgress: reportWatchProgress
    };
  });

  async function restoreWatchProgress(): Promise<void> {
    if (!$canRecordCourseLearning || !playbackAssetId) return;

    const cachedAsset = assetWatchProgress;
    if (cachedAsset?.lastPositionSeconds && cachedAsset.lastPositionSeconds > 0) {
      pendingResumeSeconds = cachedAsset.lastPositionSeconds;
      applyPendingResume();
      return;
    }

    const progress = await lessonApi.getWatchProgress(courseId, lessonId);
    if (!isMounted) return;

    const assetProgress = progress?.assets?.find((asset) => asset.assetId === playbackAssetId);
    if (assetProgress?.lastPositionSeconds && assetProgress.lastPositionSeconds > 0) {
      pendingResumeSeconds = assetProgress.lastPositionSeconds;
      applyPendingResume();
    }
  }

  onMount(() => {
    // Register on the transcript bus for both upload and YouTube assets
    if (transcriptAssetId) {
      lessonVideoBus.registerTranscriptSource({
        assetId: transcriptAssetId,
        videoIndex,
        transcript: null,
        transcriptLoading: false,
        currentTimeSeconds: 0,
        seek: video.type === 'youtube' ? () => {} : (seconds) => localSeekFn(seconds)
      });
    }

    if (playbackAssetId && (lessonVideoBus.assetId === null || lessonVideoBus.assetId === playbackAssetId)) {
      syncPlaybackBus();
    }

    void restoreWatchProgress().finally(() => {
      if (!isMounted) return;

      watchProgressRestored = true;
      if (loadedVideoElement) handleSourceLoaded(loadedVideoElement);
    });

    void (async () => {
      await loadTranscript();
      if (!isMounted) return;

      await watchJobsUntilTerminalThenReload();
    })();
  });

  onDestroy(() => {
    isMounted = false;
    loadedVideoElement = null;
    clearPlaybackRefreshTimer();
    clearVttRefetchTimer();
    stopJobPoller();
    revokeBlobTrackUrl?.();
    revokeBlobTrackUrl = null;

    if (transcriptAssetId) {
      lessonVideoBus.unregisterTranscriptSource(transcriptAssetId);
    }

    if (lessonVideoBus.transcriptSources.size === 0) {
      lessonVideoBus.reset();
      sidePanel.closeIfScope('lesson');
      return;
    }

    if (playbackAssetId && ownsPlaybackBus()) {
      lessonVideoBus.assetId = null;
      lessonVideoBus.currentTimeSeconds = 0;
      lessonVideoBus.hasPlayed = false;
      lessonVideoBus.setSeekFn(() => {});
    }
  });

  const tracks = $derived(
    blobTrackUrl && localTranscript
      ? [
          {
            kind: 'captions' as const,
            src: blobTrackUrl,
            srclang: localTranscript.language,
            label: t.get('course.navItem.lessons.materials.tabs.video.transcript.captions_label'),
            default: false
          }
        ]
      : []
  );

  function handleFirstPlay() {
    syncPlaybackBus();
    lessonVideoBus.hasPlayed = true;
  }

  function openTranscriptPanel() {
    if (!transcriptAssetId) return;

    lessonVideoBus.selectTranscriptSource(transcriptAssetId);
    sidePanel.open(TRANSCRIPT_PANEL_ID);
  }

  const transcriptPanelControl = $derived(
    localTranscript
      ? {
          label: t.get('course.navItem.lessons.materials.tabs.video.transcript.open_side_panel'),
          onClick: openTranscriptPanel
        }
      : undefined
  );

  const playerI18n: MediaPlayerI18n = $derived({
    restart: $t('media_player.restart'),
    rewind: $t('media_player.rewind', { seektime: '{seektime}' }),
    play: $t('media_player.play'),
    pause: $t('media_player.pause'),
    fastForward: $t('media_player.fast_forward', { seektime: '{seektime}' }),
    seek: $t('media_player.seek'),
    seekLabel: $t('media_player.seek_label', { currentTime: '{currentTime}', duration: '{duration}' }),
    played: $t('media_player.played'),
    buffered: $t('media_player.buffered'),
    currentTime: $t('media_player.current_time'),
    duration: $t('media_player.duration'),
    volume: $t('media_player.volume'),
    mute: $t('media_player.mute'),
    unmute: $t('media_player.unmute'),
    enableCaptions: $t('media_player.enable_captions'),
    disableCaptions: $t('media_player.disable_captions'),
    download: $t('media_player.download'),
    enterFullscreen: $t('media_player.enter_fullscreen'),
    exitFullscreen: $t('media_player.exit_fullscreen'),
    frameTitle: $t('media_player.frame_title', { title: '{title}' }),
    captions: $t('media_player.captions'),
    settings: $t('media_player.settings'),
    pip: $t('media_player.pip'),
    airplay: $t('media_player.airplay'),
    menuBack: $t('media_player.menu_back'),
    speed: $t('media_player.speed'),
    normal: $t('media_player.normal'),
    quality: $t('media_player.quality'),
    loop: $t('media_player.loop'),
    start: $t('media_player.start'),
    end: $t('media_player.end'),
    all: $t('media_player.all'),
    reset: $t('media_player.reset'),
    disabled: $t('media_player.disabled'),
    enabled: $t('media_player.enabled'),
    advertisement: $t('media_player.advertisement'),
    qualityLabel: { 0: $t('media_player.auto') },
    qualityBadge: {
      1440: $t('media_player.quality_hd'),
      1080: $t('media_player.quality_hd'),
      720: $t('media_player.quality_hd'),
      576: $t('media_player.quality_sd'),
      480: $t('media_player.quality_sd')
    }
  });
</script>

<div class="w-full">
  <MediaPlayer
    source={{
      type: video.type,
      url: playbackUrl,
      hls: isHls,
      metadata: video.metadata as { thumbnailUrl?: string; title?: string } | undefined,
      tracks
    }}
    options={{
      maxHeight: '569px',
      width: '100%',
      controls: true,
      playsinline: true,
      i18n: playerI18n,
      isLearnerView: $isCourseLearnerView,
      vimeoPrivacyErrorTitle: $t('course.navItem.lessons.materials.tabs.video.add_video.vimeo_privacy_error_title'),
      vimeoPrivacyErrorDescription: $t(
        'course.navItem.lessons.materials.tabs.video.add_video.vimeo_privacy_error_description'
      ),
      vimeoPrivacyErrorUnlistedHint: $t(
        'course.navItem.lessons.materials.tabs.video.add_video.vimeo_privacy_error_unlisted_hint'
      ),
      vimeoPrivacyErrorDomainPrefix: $t(
        'course.navItem.lessons.materials.tabs.video.add_video.vimeo_privacy_error_domain_prefix'
      ),
      vimeoPrivacyErrorDomainSuffix: $t(
        'course.navItem.lessons.materials.tabs.video.add_video.vimeo_privacy_error_domain_suffix'
      ),
      vimeoPrivacyErrorOtherHint: $t(
        'course.navItem.lessons.materials.tabs.video.add_video.vimeo_privacy_error_other_hint'
      ),
      vimeoRetryLabel: $t('course.navItem.lessons.materials.tabs.video.add_video.vimeo_retry_label'),
      vimeoLearnerErrorTitle: $t('course.navItem.lessons.materials.tabs.video.add_video.vimeo_learner_error_title'),
      vimeoLearnerErrorDescription: $t(
        'course.navItem.lessons.materials.tabs.video.add_video.vimeo_learner_error_description'
      ),
      onTimeUpdate: (seconds) => {
        if (uploadAssetId) {
          lessonVideoBus.updateTranscriptSource(uploadAssetId, { currentTimeSeconds: seconds });
        }

        if (ownsPlaybackBus()) {
          lessonVideoBus.currentTimeSeconds = seconds;
        }
      },
      onPlayerReady: (player) => {
        localSeekFn = (seconds) => {
          player.currentTime = seconds;
        };

        if (ownsPlaybackBus()) {
          lessonVideoBus.setSeekFn(localSeekFn);
        }
      },
      onFirstPlay: handleFirstPlay,
      onSourceLoaded: handleSourceLoaded,
      onBeforeHlsLoad: isHls && uploadAssetId ? () => mintHlsCookie(uploadAssetId) : undefined,
      transcriptPanelControl,
      loadingLabel: $t('course.navItem.lessons.materials.tabs.video.loading'),
      playbackErrorLabel: $t('course.navItem.lessons.materials.tabs.video.playback_error'),
      playbackReloadLabel: $t('course.navItem.lessons.materials.tabs.video.playback_reload'),
      onPlaybackReload: handlePlaybackReload,
      playbackAuthErrorLabel: $t('course.navItem.lessons.materials.tabs.video.playback_auth_error'),
      playbackAuthActionLabel: $t('course.navItem.lessons.materials.tabs.video.playback_auth_action'),
      onPlaybackAuthRequired: () => goto(resolve('/login', {})),
      seekPolicy
    }}
  />
</div>
