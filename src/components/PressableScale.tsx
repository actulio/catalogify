import { forwardRef } from 'react';
import { Pressable, PressableProps, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'children'> & {
  /** How far to scale down on press-in. Default 0.96. */
  activeScale?: number;
  children?: React.ReactNode;
};

/**
 * Pressable that gives tactile feedback: scales to `activeScale` and dips
 * opacity while pressed, springing back on release. The animation lives on the
 * (reanimated) pressable itself; any `className` is applied to an inner plain
 * View so NativeWind resolves it (NativeWind does not interop reanimated's
 * animated components, so `className` on the AnimatedPressable would be dropped).
 */
export const PressableScale = forwardRef<View, Props>(function PressableScale(
  { activeScale = 0.96, onPressIn, onPressOut, disabled, style: styleProp, className, children, ...rest },
  ref
) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <AnimatedPressable
      ref={ref}
      disabled={disabled}
      onPressIn={(e) => {
        scale.value = withSpring(activeScale, { damping: 15, stiffness: 300 });
        opacity.value = withTiming(0.7, { duration: 80 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
        opacity.value = withTiming(1, { duration: 120 });
        onPressOut?.(e);
      }}
      {...rest}
      style={[styleProp, animatedStyle]}
    >
      <View className={className}>{children}</View>
    </AnimatedPressable>
  );
});
