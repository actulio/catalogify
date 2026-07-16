import {
  useFonts as usePlayfairDisplayFonts,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import {
  useFonts as useInterFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';

export type AppFontsStatus = {
  loaded: boolean;
  error: Error | null;
};

export function useAppFonts(): AppFontsStatus {
  const [playfairLoaded, playfairError] = usePlayfairDisplayFonts({
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
  });
  const [interLoaded, interError] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  return {
    loaded: playfairLoaded && interLoaded,
    error: playfairError ?? interError,
  };
}
