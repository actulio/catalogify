import { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';

/**
 * Returns an animated style whose bottom padding tracks the on-screen keyboard
 * height, so scrollable content gains room to lift focused inputs clear of the
 * keyboard. Works on both Android and iOS under the new architecture.
 */
export function useKeyboardPadding() {
  const keyboard = useAnimatedKeyboard();
  return useAnimatedStyle(() => ({
    paddingBottom: keyboard.height.value,
  }));
}
