import { describe, expect, it } from 'vitest';
import { PlaybackProgress } from '@cio/ui/custom/media-player/players/playback-progress';

describe('freely seekable video learning records', () => {
  it('flushes real playback before a seek and then stores the new paused position with zero seconds', () => {
    const progress = new PlaybackProgress();
    for (let positionSeconds = 1; positionSeconds <= 12; positionSeconds += 1) progress.observe(positionSeconds, true);
    expect(progress.flush()).toEqual({ positionSeconds: 12, playedDeltaSeconds: 12 });
    progress.beginSeek();
    progress.observe(170, false);
    progress.finishSeek(170);
    expect(progress.flush()).toEqual({ positionSeconds: 170, playedDeltaSeconds: 0 });
  });

  it('does not turn a jump to the end into playback time or tail time', () => {
    const progress = new PlaybackProgress();
    progress.beginSeek();
    progress.finishSeek(198);
    progress.finish(198);
    expect(progress.flush()).toEqual({ positionSeconds: 198, playedDeltaSeconds: 0 });
  });

  it('does not credit skipped time when ended happens before seeked', () => {
    const progress = new PlaybackProgress(20);
    progress.beginSeek();
    progress.finish(198);
    expect(progress.flush()).toEqual({ positionSeconds: 198, playedDeltaSeconds: 0 });
  });

  it('preserves fractional real playback across heartbeats and collects only a short real ending tail', () => {
    const progress = new PlaybackProgress();
    progress.observe(0.8, true);
    expect(progress.flush().playedDeltaSeconds).toBe(0);
    progress.observe(1.4, true);
    expect(progress.flush().playedDeltaSeconds).toBe(1);
    progress.finish(2);
    expect(progress.flush()).toEqual({ positionSeconds: 2, playedDeltaSeconds: 1 });
  });

  it('does not credit paused movement or a large unobserved ending gap', () => {
    const progress = new PlaybackProgress(20);
    progress.observe(21, false);
    progress.finish(198);
    expect(progress.flush()).toEqual({ positionSeconds: 198, playedDeltaSeconds: 0 });
  });
});
