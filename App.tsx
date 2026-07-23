// App.tsx
import './global.css';
import './src/theme/nativewind-setup';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAppFonts } from './src/theme/useAppFonts';
import { auth } from './src/services/firebase';
import { setupNotifications } from './src/services/reminders';
import { runKeepAlive } from './src/services/activity';
import { queryClient } from './src/services/queryClient';

export default function App() {
  const { loaded, error } = useAppFonts();

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
    return (
      <QueryClientProvider client={queryClient}>
        <RootNavigator />
      </QueryClientProvider>
    );
  }

  if (!loaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <RootNavigator />
    </QueryClientProvider>
  );
}
