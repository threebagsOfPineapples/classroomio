export class PlaybackProgress {
  private playedSeconds = 0;
  private isSeeking = false;
  positionSeconds: number;

  constructor(positionSeconds = 0) {
    this.positionSeconds = positionSeconds;
  }

  observe(positionSeconds: number, isPlaying: boolean): number {
    const delta = positionSeconds - this.positionSeconds;
    const playedDelta = !this.isSeeking && isPlaying && delta > 0 && delta < 2 ? delta : 0;
    this.playedSeconds += playedDelta;
    if (!this.isSeeking) this.positionSeconds = positionSeconds;

    return playedDelta;
  }

  beginSeek() {
    this.isSeeking = true;
  }

  finishSeek(positionSeconds: number) {
    this.isSeeking = false;
    this.positionSeconds = positionSeconds;
  }

  finish(positionSeconds: number) {
    this.observe(positionSeconds, !this.isSeeking);
    this.positionSeconds = positionSeconds;
  }

  flush(positionSeconds = this.positionSeconds) {
    const playedDeltaSeconds = Math.floor(this.playedSeconds);
    this.playedSeconds -= playedDeltaSeconds;

    return { positionSeconds: Math.floor(positionSeconds), playedDeltaSeconds };
  }
}
