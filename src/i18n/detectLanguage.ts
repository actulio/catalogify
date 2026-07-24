import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, Language, isSupportedLanguage } from './config';

function mapDeviceLocale(): Language {
  const code = getLocales()[0]?.languageCode?.toLowerCase() ?? '';
  return code.startsWith('pt') ? 'pt' : 'en';
}

// Stored choice wins; otherwise map the device locale (pt* -> pt, else en) and
// persist it so the resolved default is stable across launches.
export async function resolveInitialLanguage(): Promise<Language> {
  const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (isSupportedLanguage(stored)) return stored;

  const resolved = mapDeviceLocale();
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, resolved);
  } catch {
    // Persistence is best-effort; fall through with the resolved value.
  }
  return resolved ?? DEFAULT_LANGUAGE;
}
