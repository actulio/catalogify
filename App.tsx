import './global.css';
import './src/theme/nativewind-setup';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAppFonts } from './src/theme/useAppFonts';

export default function App() {
  const { loaded, error } = useAppFonts();

  if (error) {
    console.error('Font loading failed', error);
    return <RootNavigator />;
  }

  if (!loaded) return null;

  return <RootNavigator />;
}
