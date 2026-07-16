import { Text, View, Pressable } from 'react-native';
import { useAuth } from '../services/auth';

export function SignInScreen() {
  const { signIn, canSignIn } = useAuth();

  return (
    <View className="flex-1 bg-background items-center justify-center px-5 gap-8">
      <View className="items-center gap-4">
        <Text className="font-display-lg text-display-lg-mobile text-primary">Catalogify</Text>
        <Text className="font-body-md text-body-md text-on-surface-variant italic text-center opacity-80">
          Catalog the things you love.
        </Text>
      </View>
      <Pressable
        onPress={signIn}
        disabled={!canSignIn}
        className={`w-full flex-row items-center justify-center gap-3 bg-primary rounded-xl py-5 ${
          !canSignIn ? 'opacity-50' : ''
        }`}
      >
        <Text className="font-label-lg text-label-lg text-white">Sign in with Google</Text>
      </Pressable>
      <Text className="font-label-sm text-label-sm text-on-surface-variant opacity-50 uppercase tracking-widest absolute bottom-12">
        Your personal catalogs
      </Text>
    </View>
  );
}
