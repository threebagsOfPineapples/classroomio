import type { MediaPlayerI18n } from '../types';

export function getPlyrI18n(i18n?: MediaPlayerI18n, includeAutoQuality = false): MediaPlayerI18n | undefined {
  if (!includeAutoQuality) return i18n;

  const qualityLabel = { 0: 'Auto', ...i18n?.qualityLabel };

  return { ...i18n, qualityLabel };
}
