import { forwardRef, useEffect, useRef } from 'react';
import {
  findNodeHandle,
  Keyboard,
  ScrollView,
  ScrollViewProps,
  TextInput,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useKeyboardSpacerStyle } from '../hooks/useKeyboardSpacer';

type Props = ScrollViewProps & { children: React.ReactNode };

/**
 * ScrollView that keeps the focused input visible above the keyboard. It renders
 * a keyboard-height spacer as its last child (so there is scrollable room to
 * lift inputs) and, when the keyboard appears, scrolls the currently-focused
 * input above it. Drop-in replacement for a plain ScrollView — no per-input
 * wiring needed. A plain ScrollView (not Animated.ScrollView) is used on purpose
 * so NativeWind's `className` / `contentContainerClassName` still apply; only the
 * spacer is animated.
 */
export const KeyboardAwareScrollView = forwardRef<ScrollView, Props>(
  function KeyboardAwareScrollView({ children, ...rest }, ref) {
    const spacerStyle = useKeyboardSpacerStyle();
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
      <ScrollView
        ref={(r) => {
          scrollRef.current = r;
          if (typeof ref === 'function') ref(r);
          else if (ref) (ref as any).current = r;
        }}
        keyboardShouldPersistTaps="handled"
        {...rest}
      >
        {children}
        <Animated.View style={spacerStyle} />
      </ScrollView>
    );
  }
);
