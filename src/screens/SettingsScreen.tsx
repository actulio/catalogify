import { useLayoutEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, Language } from '../i18n/config';
import { setLanguage } from '../i18n';
import { theme } from '../theme/theme';

const LABEL_KEY: Record<Language, string> = {
  pt: 'settings.languagePortuguese',
  en: 'settings.languageEnglish',
};

export function SettingsScreen() {
  // Read the current language reactively via the hook so the check mark updates
  // instantly when setLanguage() calls i18n.changeLanguage().
  const { t, i18n } = useTranslation();
  const current = i18n.language as Language;
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('settings.title') });
  }, [navigation, t]);

  return (
    <View className="flex-1 bg-background">
      <Text className="px-5 pt-5 pb-2 font-label-md text-label-md text-secondary uppercase tracking-widest">
        {t('settings.languageSection')}
      </Text>
      {SUPPORTED_LANGUAGES.map((lng) => {
        const active = lng === current;
        return (
          <Pressable
            key={lng}
            onPress={() => void setLanguage(lng)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className="flex-row items-center justify-between px-5 py-4 border-b border-outline-variant/30"
          >
            <Text className="font-body-md text-body-md text-on-surface">{t(LABEL_KEY[lng])}</Text>
            {active && <MaterialIcons name="check" size={22} color={theme.colors.primary} />}
          </Pressable>
        );
      })}
    </View>
  );
}
