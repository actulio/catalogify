import './global.css';
import './src/theme/nativewind-setup';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAppFonts } from './src/theme/useAppFonts';

export default function App() {
  const fontsLoaded = useAppFonts();

  if (!fontsLoaded) return null;

  return <RootNavigator />;
}
