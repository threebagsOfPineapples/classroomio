import { describe, expect, it } from 'vitest';
import {
  calculateVideoWatchProgress,
  getRegisteredVideoDuration,
  getVideoWatchedPercent,
  isEnforceableLessonVideo,
  isNativeVideoUrl,
  isValidVideoWatchDelta,
  resolveWatchEnforcedAssetIds
} from '../src/functions/lesson-video';

describe('native lesson video tracking', () => {
  it('allows registered uploads and native external media with query parameters', () => {
    expect(isEnforceableLessonVideo({ type: 'upload', assetId: 'uploaded-asset' })).toBe(true);
    expect(
      isEnforceableLessonVideo({
        type: 'generic',
        assetId: 'external-asset',
        link: 'https://cdn.yingdao.com/course/video.mp4?token=sample'
      })
    ).toBe(true);
    expect(isNativeVideoUrl('https://cdn.example.cn/lesson.WEBM')).toBe(true);
  });

  it.each([
    { type: 'generic', link: 'https://cdn.example.cn/video.mp4' },
    { type: 'generic', assetId: 'asset', link: 'https://college.yingdao.com/lesson' },
    { type: 'generic', assetId: 'asset', link: 'https://www.youtube.com/watch?v=abc123abc12' },
    { type: 'youtube', assetId: 'asset', link: 'https://cdn.example.cn/video.mp4' },
    { type: 'vimeo', assetId: 'asset', link: 'https://vimeo.com/12345678' },
    { type: 'google_drive', assetId: 'asset', link: 'https://drive.google.com/file/d/video/preview' },
    { type: 'generic', assetId: 'asset', link: 'javascript:alert(1)' },
    { type: 'generic', assetId: 'asset', link: 'file:///video.mp4' },
    { type: 'generic', assetId: 'asset', link: 'https://cdn.example.cn/video.html?file=video.mp4' },
    { type: 'generic', assetId: 'asset', link: 'https://cdn.example.cn/playlist.m3u8' }
  ])('rejects unregistered media, webpages, and iframe sources: $link', (video) => {
    expect(isEnforceableLessonVideo(video)).toBe(false);
  });

  it('resolves explicit tracked assets before the lesson-wide fallback and removes duplicates', () => {
    const videos = [
      { type: 'upload', assetId: 'upload' },
      { type: 'generic', assetId: 'external', watchEnforced: true, link: 'https://cdn.example.cn/video.mp4' },
      { type: 'generic', assetId: 'external', watchEnforced: true, link: 'https://cdn.example.cn/video.mp4' },
      { type: 'youtube', assetId: 'youtube', watchEnforced: true }
    ];
    expect(resolveWatchEnforcedAssetIds(videos, 'video_watch')).toEqual(['external']);
    expect(
      resolveWatchEnforcedAssetIds(
        videos.map((video) => ({ ...video, watchEnforced: false })),
        'video_watch'
      )
    ).toEqual(['upload', 'external']);
    expect(resolveWatchEnforcedAssetIds([], 'video_watch')).toEqual([]);
    expect(resolveWatchEnforcedAssetIds([{ type: 'upload', assetId: 'upload' }], 'manual')).toEqual([]);
  });

  it('only accepts a verified duration from a registered native video asset', () => {
    expect(
      getRegisteredVideoDuration({
        kind: 'video',
        provider: 'external_url',
        sourceUrl: 'https://cdn.example.cn/video.mp4',
        durationSeconds: 125.4
      })
    ).toBe(125);
    expect(getRegisteredVideoDuration({ kind: 'video', provider: 'upload', durationSeconds: 125 })).toBe(125);
    expect(getRegisteredVideoDuration({ kind: 'video', provider: 'youtube', durationSeconds: 125 })).toBeNull();
    expect(
      getRegisteredVideoDuration({
        kind: 'video',
        provider: 'generic',
        sourceUrl: 'https://college.yingdao.com/lesson',
        durationSeconds: 125
      })
    ).toBeNull();
    expect(getRegisteredVideoDuration({ kind: 'document', provider: 'upload', durationSeconds: 125 })).toBeNull();
    expect(getRegisteredVideoDuration({ kind: 'video', provider: 'upload', durationSeconds: 0 })).toBeNull();
    expect(getRegisteredVideoDuration({ kind: 'video', provider: 'upload', durationSeconds: Number.NaN })).toBeNull();
    expect(getRegisteredVideoDuration(null)).toBeNull();
  });
});

describe('video learning time integrity', () => {
  it('requires a zero-second baseline for the first heartbeat', () => {
    expect(isValidVideoWatchDelta(0, null, 100_000)).toBe(true);
    expect(isValidVideoWatchDelta(120, null, 100_000)).toBe(false);
    expect(isValidVideoWatchDelta(1, null, 100_000)).toBe(false);
  });

  it('bounds heartbeats by elapsed time and a maximum delta even after a long absence', () => {
    expect(isValidVideoWatchDelta(15, new Date(85_000).toISOString(), 100_000)).toBe(true);
    expect(isValidVideoWatchDelta(120, new Date(85_000).toISOString(), 100_000)).toBe(false);
    expect(isValidVideoWatchDelta(120, new Date(0).toISOString(), 100_000)).toBe(false);
  });

  it('rejects positive deltas at the same instant and repeated subsecond requests', () => {
    const lastUpdatedAt = new Date(100_000).toISOString();
    expect(isValidVideoWatchDelta(1, lastUpdatedAt, 100_000)).toBe(false);
    expect(isValidVideoWatchDelta(1, lastUpdatedAt, 100_999)).toBe(false);
    expect(isValidVideoWatchDelta(0, lastUpdatedAt, 100_000)).toBe(true);
    for (let requestIndex = 0; requestIndex < 20; requestIndex += 1) {
      expect(isValidVideoWatchDelta(5, lastUpdatedAt, 100_000)).toBe(false);
    }
  });

  it('never credits more than actual elapsed seconds across repeated tabs', () => {
    let lastUpdatedMs = 0;
    let creditedSeconds = 0;
    for (let requestIndex = 0; requestIndex < 40; requestIndex += 1) {
      const nowMs = requestIndex * 250;
      if (isValidVideoWatchDelta(1, new Date(lastUpdatedMs).toISOString(), nowMs)) {
        creditedSeconds += 1;
        lastUpdatedMs = nowMs;
      }
    }
    expect(creditedSeconds).toBeLessThanOrEqual(9);
  });

  it('does not turn an end position or a seek into watched time', () => {
    const progress = calculateVideoWatchProgress(
      { watchedSeconds: 15, furthestSeconds: 15 },
      { positionSeconds: 600, playedDeltaSeconds: 0, durationSeconds: 600 },
      95
    );
    expect(progress.watchedSeconds).toBe(15);
    expect(progress.isComplete).toBe(false);
    expect(progress.lastPositionSeconds).toBe(600);
    expect(progress.furthestSeconds).toBe(600);
  });

  it('preserves paused time and completes only after actual watched seconds reach the threshold', () => {
    const paused = calculateVideoWatchProgress(
      { watchedSeconds: 50, furthestSeconds: 50 },
      { positionSeconds: 50, playedDeltaSeconds: 0, durationSeconds: 100 },
      95
    );
    expect(paused.watchedSeconds).toBe(50);
    expect(paused.isComplete).toBe(false);
    const complete = calculateVideoWatchProgress(
      { watchedSeconds: 90, furthestSeconds: 90 },
      { positionSeconds: 95, playedDeltaSeconds: 5, durationSeconds: 100 },
      95
    );
    expect(complete.watchedSeconds).toBe(95);
    expect(complete.isComplete).toBe(true);
  });

  it('clamps stored positions and watched seconds to the canonical duration', () => {
    const progress = calculateVideoWatchProgress(
      { watchedSeconds: 95, furthestSeconds: 100 },
      { positionSeconds: 120, playedDeltaSeconds: 15, durationSeconds: 100 },
      95
    );
    expect(progress).toEqual({ watchedSeconds: 100, furthestSeconds: 100, lastPositionSeconds: 100, isComplete: true });
  });

  it('completes from actual watched seconds regardless of the freely chosen position', () => {
    const progress = calculateVideoWatchProgress(
      { watchedSeconds: 90, furthestSeconds: 20 },
      { positionSeconds: 15, playedDeltaSeconds: 10, durationSeconds: 100 },
      95
    );
    expect(progress.watchedSeconds).toBe(100);
    expect(progress.furthestSeconds).toBe(20);
    expect(progress.isComplete).toBe(true);
  });

  it('shows cumulative 94 percent even when the learner repeatedly watches only the opening', () => {
    const progress = calculateVideoWatchProgress(
      { watchedSeconds: 90, furthestSeconds: 20 },
      { positionSeconds: 15, playedDeltaSeconds: 4, durationSeconds: 100 },
      95
    );
    expect(progress.furthestSeconds).toBe(20);
    expect(progress.watchedSeconds).toBe(94);
    expect(progress.isComplete).toBe(false);
    expect(getVideoWatchedPercent(progress.watchedSeconds, 100)).toBe(94);
    expect(getVideoWatchedPercent(0, null)).toBe(0);
  });

  it('saves a paused seek position without creating watched seconds', () => {
    const progress = calculateVideoWatchProgress(
      { watchedSeconds: 20, furthestSeconds: 20 },
      { positionSeconds: 170, playedDeltaSeconds: 0, durationSeconds: 198 },
      95
    );
    expect(progress).toEqual({ watchedSeconds: 20, furthestSeconds: 170, lastPositionSeconds: 170, isComplete: false });
    const rewind = calculateVideoWatchProgress(
      progress,
      { positionSeconds: 12, playedDeltaSeconds: 0, durationSeconds: 198 },
      95
    );
    expect(rewind.watchedSeconds).toBe(20);
    expect(rewind.lastPositionSeconds).toBe(12);
    expect(rewind.furthestSeconds).toBe(170);
  });
});
