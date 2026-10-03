import type { TLocale } from '@cio/db/types';
import i18n from '@sveltekit-i18n/base';
import parser from '@sveltekit-i18n/parser-icu';
import { writable } from 'svelte/store';

async function loadChineseTranslations() {
  return (await import('../translations/zh.json')).default;
}

export const config = {
  parser: parser(),
  loaders: [
    {
      locale: 'zh',
      key: '',
      loader: loadChineseTranslations
    }
  ]
};

export const { t, loading, locales, locale, initialized, translations, loadTranslations } = new i18n(config);

export const selectedLocale = writable<string>('zh');
export const LOCALE_STORAGE_KEY = 'classroomio_locale';
export const LOCALE_COOKIE_KEY = 'classroomio_locale';

function isSupportedLocale(value: string): value is TLocale {
  return config.loaders.some((loader) => loader.locale === value);
}

const localeLoads = new Map<string, Promise<unknown>>();

/** Load a locale once per process, reusing the in-flight promise for callers that race. */
function primeLocale(targetLocale: string): Promise<unknown> {
  const inFlight = localeLoads.get(targetLocale);
  if (inFlight) return inFlight;

  const load = Promise.resolve(loadTranslations(targetLocale)).catch((error) => {
    localeLoads.delete(targetLocale);
    throw error;
  });

  localeLoads.set(targetLocale, load);

  return load;
}

/** Load Chinese interface translations and normalize browser language preferences. */
export async function ensureTranslations(requestedLocale: string): Promise<void> {
  const targetLocale = isSupportedLocale(requestedLocale) ? requestedLocale : 'zh';
  await primeLocale(targetLocale);

  locale.forceSet(targetLocale);
  if (typeof document !== 'undefined') document.documentElement.lang = 'zh-CN';
  persistLocale('zh');
}

export function handleLocaleChange(_requestedLocale: TLocale) {
  if (typeof document !== 'undefined') document.documentElement.lang = 'zh-CN';
  locale.forceSet('zh');
  selectedLocale.set('zh');
  persistLocale('zh');
}

export function getPersistedLocale(): TLocale | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (savedLocale && isSupportedLocale(savedLocale)) {
      return savedLocale;
    }
  } catch (error) {
    console.warn('Failed to read saved locale from localStorage', error);
  }

  const cookieMatch = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE_KEY}=([^;]*)`));
  const savedCookie = cookieMatch?.[1] ? decodeURIComponent(cookieMatch[1]) : null;
  return savedCookie && isSupportedLocale(savedCookie) ? savedCookie : null;
}

function persistLocale(newLocale: TLocale) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
  } catch (error) {
    console.warn('Failed to save locale to localStorage', error);
  }

  document.cookie = `${LOCALE_COOKIE_KEY}=${encodeURIComponent(newLocale)}; path=/; max-age=31536000; SameSite=Lax`;
}
