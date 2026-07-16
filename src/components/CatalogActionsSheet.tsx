import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../theme/theme';

interface CatalogActionsSheetProps {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function CatalogActionsSheet({ visible, onClose, onEdit, onDelete }: CatalogActionsSheetProps) {
  // Keep the Modal mounted through the close animation: `rendered` lags `visible`
  // so the sheet can finish sliding out before the native modal unmounts.
  const [rendered, setRendered] = useState(visible);
  const progress = useSharedValue(0); // 0 = hidden, 1 = fully shown
  const sheetHeight = useSharedValue(500); // measured on layout; large default keeps it off-screen

  useEffect(() => {
    if (visible) {
      setRendered(true);
      progress.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
    } else {
      progress.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setRendered)(false);
      });
    }
  }, [visible, progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * sheetHeight.value }],
  }));

  if (!rendered) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle, styles.backdrop]}>
          <Pressable
            className="flex-1"
            onPress={onClose}
            accessibilityLabel="Close catalog actions"
            accessibilityRole="button"
          />
        </Animated.View>
        <Animated.View
          style={sheetStyle}
          onLayout={(e) => {
            sheetHeight.value = e.nativeEvent.layout.height;
          }}
        >
          <View className="bg-background rounded-t-xl pb-8">
            <View className="items-center pt-3 pb-2">
              <View className="w-12 h-1 rounded-full bg-secondary/20" />
            </View>
            <View className="px-5 py-4 border-b border-outline-variant/40 items-center">
              <Text className="font-headline-sm text-headline-sm text-on-background">Catalog Actions</Text>
            </View>
            <Pressable
              onPress={onEdit}
              className="flex-row items-center gap-4 px-5 py-5"
              accessibilityRole="button"
              accessibilityLabel="Edit Catalog"
            >
              <MaterialIcons name="edit" size={22} color={theme.colors.onSurfaceVariant} />
              <Text className="font-body-lg text-body-lg text-on-background">Edit Catalog</Text>
            </Pressable>
            <Pressable
              onPress={onDelete}
              className="flex-row items-center gap-4 px-5 py-5"
              accessibilityRole="button"
              accessibilityLabel="Delete Catalog"
            >
              <MaterialIcons name="delete" size={22} color={theme.colors.danger} />
              <Text className="font-body-lg text-body-lg text-error">Delete Catalog</Text>
            </Pressable>
            <View className="px-5 pt-2">
              <Pressable
                onPress={onClose}
                className="w-full py-4 rounded-lg bg-surface-container-highest items-center"
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text className="font-label-md text-label-md text-on-surface-variant">CANCEL</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // on-background (#1b1c1a) at 40% — the scrim behind the sheet.
  backdrop: { backgroundColor: 'rgba(27, 28, 26, 0.4)' },
});
