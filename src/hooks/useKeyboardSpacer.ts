import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';

/**
 * True while the on-screen keyboard is visible. Used to render the keyboard
 * spacer only when needed, so its container's flex `gap` doesn't leave a
 * constant empty gap at the bottom while the keyboard is closed.
 */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

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
