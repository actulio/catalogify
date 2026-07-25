// App.tsx
import './global.css';
import './src/theme/nativewind-setup';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { QueryClientProvider } from '@tanstack/react-query';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { I18nextProvider } from 'react-i18next';
import i18n, { initI18n } from './src/i18n';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAppFonts } from './src/theme/useAppFonts';
import { auth } from './src/services/firebase';
import { setupNotifications } from './src/services/reminders';
import { runKeepAlive } from './src/services/activity';
import { queryClient } from './src/services/queryClient';

export default function App() {
  const { loaded, error } = useAppFonts();
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    void initI18n().then(() => setI18nReady(true)).catch(() => setI18nReady(true));
  }, []);

  useEffect(() => {
    void setupNotifications();
    void runKeepAlive();

    // Reset the reminder as soon as a user is present (fires on sign-in and on
    // a cold start that restores a session) — this is where the permission
    // prompt surfaces, i.e. after sign-in, not on the sign-in screen.
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) void runKeepAlive();
    });

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void runKeepAlive();
    });

    return () => {
      unsubscribeAuth();
      appStateSub.remove();
    };
  }, []);

  if (error) {
    console.error('Font loading failed', error);
  }

  if (!loaded || !i18nReady) return null;

  return (
    <I18nextProvider i18n={i18n}>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <RootNavigator />
        </QueryClientProvider>
      </KeyboardProvider>
    </I18nextProvider>
  );
}
