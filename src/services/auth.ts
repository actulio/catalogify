import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signOut, User } from 'firebase/auth';
import { auth } from './firebase';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
  }, []);

  async function signIn() {
    try {
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices();
      }
      const response = await GoogleSignin.signIn();
      if (response.type !== 'success' || !response.data.idToken) return;

      const credential = GoogleAuthProvider.credential(response.data.idToken);
      await signInWithCredential(auth, credential);
    } catch (error) {
      if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) return;
      throw error;
    }
  }

  return {
    user,
    initializing,
    canSignIn: true,
    signIn,
    signOut: async () => {
      await GoogleSignin.signOut();
      await signOut(auth);
    },
  };
}
