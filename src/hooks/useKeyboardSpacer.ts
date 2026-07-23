import { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';

/**
 * Returns an animated style whose `height` tracks the on-screen keyboard height.
 * Render it on a spacer `<Animated.View>` as the last child of a scroll view (or
 * as a FlatList footer) to add scrollable room equal to the keyboard, so a
 * focused input can be scrolled clear of the keyboard. Using a spacer rather than
 * `contentContainerStyle` padding avoids colliding with NativeWind's
 * `contentContainerClassName` (which also targets `contentContainerStyle`).
 * Works on both Android and iOS under the new architecture.
 */
export function useKeyboardSpacerStyle() {
  const keyboard = useAnimatedKeyboard();
  return useAnimatedStyle(() => ({
    height: keyboard.height.value,
  }));
}
