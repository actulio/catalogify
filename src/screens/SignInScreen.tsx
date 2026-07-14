// src/screens/SignInScreen.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useAuth } from '../services/auth';
import { theme } from '../theme/theme';

export function SignInScreen() {
  const { signIn, canSignIn } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Catalogify</Text>
      <Pressable style={styles.button} disabled={!canSignIn} onPress={signIn}>
        <Text style={styles.buttonText}>Sign in with Google</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  title: {
    fontSize: 28,
    fontFamily: theme.fonts.heading,
    color: theme.colors.textPrimary,
  },
  button: {
    backgroundColor: theme.colors.accentStrong,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radii.medium,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
