import { describe, expect, it } from 'vitest';
import { getPlyrI18n } from '@cio/ui/custom/media-player/players/player-i18n';

describe('host supplied player labels', () => {
  it('preserves controls, quality labels and badges while adding the HLS automatic fallback', () => {
    const labels = {
      settings: '设置',
      normal: '正常',
      qualityLabel: { 720: '高清' },
      qualityBadge: { 720: '高清' }
    };

    expect(getPlyrI18n(labels, true)).toEqual({
      ...labels,
      qualityLabel: { 0: 'Auto', 720: '高清' }
    });
    expect(labels.qualityLabel).toEqual({ 720: '高清' });
  });

  it('keeps the host automatic label instead of replacing it with the fallback', () => {
    expect(getPlyrI18n({ qualityLabel: { 0: '自动' } }, true)?.qualityLabel).toEqual({ 0: '自动' });
  });

  it('uses the same dictionary for progressive HTML5 and embedded players', () => {
    const labels = { settings: '设置', play: '播放', seekLabel: '{currentTime} / {duration}' };

    expect(getPlyrI18n(labels)).toBe(labels);
    expect(getPlyrI18n()).toBeUndefined();
  });
});
