import { Modal, Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../theme/theme';

interface CatalogActionsSheetProps {
  visible: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export function CatalogActionsSheet({ visible, onClose, onDelete }: CatalogActionsSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-on-background/40">
        <Pressable
          className="absolute inset-0"
          onPress={onClose}
          accessibilityLabel="Close catalog actions"
          accessibilityRole="button"
        />
        <View className="bg-background rounded-t-xl pb-8">
          <View className="items-center pt-3 pb-2">
            <View className="w-12 h-1 rounded-full bg-secondary/20" />
          </View>
          <View className="px-5 py-4 border-b border-outline-variant/40 items-center">
            <Text className="font-headline-sm text-headline-sm text-on-background">Catalog Actions</Text>
          </View>
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
      </View>
    </Modal>
  );
}
