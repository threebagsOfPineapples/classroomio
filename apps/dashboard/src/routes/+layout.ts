import { ensureTranslations, getPersistedLocale } from '$lib/utils/functions/translations';

export const load = async ({ data }) => {
  await ensureTranslations(getPersistedLocale() ?? data?.localeCookie ?? 'zh');

  return data ?? {};
};
