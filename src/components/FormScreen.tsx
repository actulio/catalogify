import { forwardRef } from 'react';
import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewProps,
  KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';

type Props = KeyboardAwareScrollViewProps & { children: React.ReactNode };

/**
 * App-wide keyboard-aware form container. Wraps react-native-keyboard-controller's
 * KeyboardAwareScrollView with the app's defaults so every form gets the same
 * behaviour: the focused input stays above the keyboard with a little breathing
 * room, and taps outside inputs still register. Tune the keyboard feel for every
 * form in one place here.
 *
 * `className` / `contentContainerClassName` are forwarded to the underlying
 * (NativeWind-registered, see theme/nativewind-setup) KeyboardAwareScrollView, so
 * screens keep styling with Tailwind classes.
 */
export const FormScreen = forwardRef<KeyboardAwareScrollViewRef, Props>(
  function FormScreen({ bottomOffset = 32, keyboardShouldPersistTaps = 'handled', ...rest }, ref) {
    return (
      <KeyboardAwareScrollView
        ref={ref}
        bottomOffset={bottomOffset}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        {...rest}
      />
    );
  }
);
