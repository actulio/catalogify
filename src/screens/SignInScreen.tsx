import { Text, View, Pressable } from 'react-native';
import { useAuth } from '../services/auth';

export function SignInScreen() {
  const { signIn, canSignIn } = useAuth();

  return (
    <View className="flex-1 bg-background items-center justify-center px-5 gap-8">
      <View className="items-center gap-4">
        <Text className="font-display-lg text-display-lg-mobile text-primary">Catalogify</Text>
        <Text className="font-body-md text-body-md text-on-surface-variant italic text-center opacity-80">
          Curate your world, one heirloom at a time.
        </Text>
      </View>
      <Pressable
        onPress={signIn}
        disabled={!canSignIn}
        className={`w-full flex-row items-center justify-center gap-3 bg-primary rounded-lg py-4 ${
          !canSignIn ? 'opacity-50' : ''
        }`}
      >
        <Text className="font-label-md text-label-md text-white">Sign in with Google</Text>
      </Pressable>
      <Text className="font-label-sm text-label-sm text-on-surface-variant opacity-50 uppercase tracking-widest absolute bottom-12">
        A digital heirloom platform
      </Text>
    </View>
  );
}
