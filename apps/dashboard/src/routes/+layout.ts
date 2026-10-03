import { ensureTranslations } from '$lib/utils/functions/translations';

export const load = async ({ data }) => {
  await ensureTranslations('zh');

  return data ?? {};
};
