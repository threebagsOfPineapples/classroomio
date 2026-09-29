import type { TLocale } from '@cio/db/types';

export const LANGUAGE: Record<TLocale, string> = {
  zh: '简体中文',
  da: '丹麦语',
  de: '德语',
  en: '英语',
  es: '西班牙语',
  fr: '法语',
  hi: '印地语',
  pl: '波兰语',
  pt: '葡萄牙语',
  ru: '俄语',
  vi: '越南语'
};

export const LANGUAGES = Object.keys(LANGUAGE).map((lang) => ({
  id: lang,
  text: LANGUAGE[lang]
}));
