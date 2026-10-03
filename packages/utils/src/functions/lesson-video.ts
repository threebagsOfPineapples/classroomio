import { getVideoMediaType } from './video';

export type TrackableLessonVideo = {
  type: string;
  assetId?: string | null;
  watchEnforced?: boolean | null;
  link?: string;
  metadata?: Record<string, unknown> | null;
};

export function isNativeVideoUrl(link: string | null | undefined): boolean {
  if (!link || getVideoMediaType(link) !== 'generic') return false;

  try {
    const videoUrl = new URL(link);
    if (videoUrl.protocol !== 'https:' && videoUrl.protocol !== 'http:') return false;

    return /\.(mp4|webm|ogv)$/i.test(videoUrl.pathname);
  } catch {
    return false;
  }
}

export function isEnforceableLessonVideo(video: TrackableLessonVideo): boolean {
  if (!video.assetId) return false;

  return video.type === 'upload' || (video.type === 'generic' && isNativeVideoUrl(video.link));
}

export function resolveWatchEnforcedAssetIds(
  videos: TrackableLessonVideo[] | null | undefined,
  completionPolicy: string | null | undefined
): string[] {
  const enforceableVideos = (videos ?? []).filter(isEnforceableLessonVideo);
  const flaggedVideos = enforceableVideos.filter((video) => video.watchEnforced);
  const requiredVideos =
    flaggedVideos.length > 0 ? flaggedVideos : completionPolicy === 'video_watch' ? enforceableVideos : [];

  return [...new Set(requiredVideos.map((video) => video.assetId as string))];
}

export function getRegisteredVideoDuration(
  asset: { kind: string; provider: string; sourceUrl?: string | null; durationSeconds?: number | null } | null
): number | null {
  if (!asset || asset.kind !== 'video') return null;

  const isUploaded = asset.provider === 'upload';
  const isExternal =
    (asset.provider === 'generic' || asset.provider === 'external_url') && isNativeVideoUrl(asset.sourceUrl);
  if (!isUploaded && !isExternal) return null;

  const durationSeconds = asset.durationSeconds;
  if (!durationSeconds || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;

  return Math.round(durationSeconds);
}

export function isValidVideoWatchDelta(
  playedDeltaSeconds: number,
  lastUpdatedAt: string | null | undefined,
  nowMs: number
): boolean {
  if (!lastUpdatedAt) return playedDeltaSeconds === 0;

  const elapsedSeconds = Math.max(0, (nowMs - new Date(lastUpdatedAt).getTime()) / 1000);
  const maxAllowedDelta = Math.min(30, Math.floor(elapsedSeconds));

  return Number.isFinite(maxAllowedDelta) && playedDeltaSeconds >= 0 && playedDeltaSeconds <= maxAllowedDelta;
}

export function getVideoWatchedPercent(watchedSeconds: number, durationSeconds: number | null | undefined): number {
  if (!durationSeconds || durationSeconds <= 0) return 0;

  return Math.min(100, Math.round((watchedSeconds / durationSeconds) * 100));
}

export function calculateVideoWatchProgress(
  previous: { watchedSeconds?: number | null; furthestSeconds?: number | null } | null,
  beat: { positionSeconds: number; playedDeltaSeconds: number; durationSeconds: number },
  thresholdPercent: number
) {
  const playedDeltaSeconds = Math.max(0, Math.round(beat.playedDeltaSeconds));
  const priorFurthestSeconds = previous?.furthestSeconds ?? 0;
  const positionSeconds = Math.max(0, Math.min(beat.durationSeconds, Math.floor(beat.positionSeconds)));
  const watchedSeconds = Math.min(beat.durationSeconds, (previous?.watchedSeconds ?? 0) + playedDeltaSeconds);
  const furthestSeconds = Math.min(beat.durationSeconds, Math.max(priorFurthestSeconds, positionSeconds));
  const isComplete = (watchedSeconds / beat.durationSeconds) * 100 >= thresholdPercent;

  return {
    watchedSeconds,
    furthestSeconds,
    lastPositionSeconds: positionSeconds,
    isComplete
  };
}
