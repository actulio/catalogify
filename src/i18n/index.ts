import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, Language } from './config';
import { resolveInitialLanguage } from './detectLanguage';
import pt from './locales/pt.json';
import en from './locales/en.json';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const resources = {
  pt: { translation: pt },
  en: { translation: en },
} as const;

// Initialize i18next once, with the resolved startup language. Returns the
// i18n instance so App can render it via I18nextProvider.
export async function initI18n(): Promise<typeof i18n> {
  const lng = await resolveInitialLanguage();
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: DEFAULT_LANGUAGE,
      interpolation: { escapeValue: false }, // RN doesn't need HTML escaping
      returnNull: false,
    });
  } else {
    await i18n.changeLanguage(lng);
  }
  return i18n;
}

export function getLanguage(): Language {
  return (i18n.language as Language) ?? DEFAULT_LANGUAGE;
}

// Switch language at runtime: re-renders all useTranslation consumers instantly
// (no reload) and persists the choice.
export async function setLanguage(lng: Language): Promise<void> {
  await i18n.changeLanguage(lng);
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
}

export default i18n;
