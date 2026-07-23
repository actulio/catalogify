import { forwardRef, useEffect, useRef } from 'react';
import {
  findNodeHandle,
  Keyboard,
  ScrollView,
  ScrollViewProps,
  TextInput,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useKeyboardPadding } from '../hooks/useKeyboardPadding';

type Props = ScrollViewProps & { children: React.ReactNode };

/**
 * ScrollView that keeps the focused input visible above the keyboard: it grows
 * its bottom padding with the keyboard height (reanimated) and, when the keyboard
 * appears, scrolls the currently-focused input above it. Drop-in replacement for
 * a plain ScrollView — no per-input wiring needed.
 */
export const KeyboardAwareScrollView = forwardRef<ScrollView, Props>(
  function KeyboardAwareScrollView({ children, contentContainerStyle, ...rest }, ref) {
    const padStyle = useKeyboardPadding();
    const scrollRef = useRef<ScrollView | null>(null);

    useEffect(() => {
      const sub = Keyboard.addListener('keyboardDidShow', () => {
        const focused = TextInput.State.currentlyFocusedInput?.() as any;
        const responder = (scrollRef.current as any)?.getScrollResponder?.();
        const node = focused ? findNodeHandle(focused) : null;
        if (node != null && responder?.scrollResponderScrollNativeHandleToKeyboard) {
          // 24 = extra px kept above the keyboard; true = don't overscroll past top.
          responder.scrollResponderScrollNativeHandleToKeyboard(node, 24, true);
        }
      });
      return () => sub.remove();
    }, []);

    return (
      <Animated.ScrollView
        ref={(r: any) => {
          scrollRef.current = r as unknown as ScrollView;
          if (typeof ref === 'function') ref(r as any);
          else if (ref) (ref as any).current = r;
        }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[contentContainerStyle, padStyle]}
        {...rest}
      >
        {children}
      </Animated.ScrollView>
    );
  }
);
