import { Modal, View, Text, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme/theme';
import { TransferProgress } from '../services/catalogTransfer';

interface Props {
  visible: boolean;
  progress: TransferProgress | null;
}

/** Blocking progress overlay shown while an export/import runs. */
export function TransferProgressModal({ visible, progress }: Props) {
  const { t } = useTranslation();

  let label = t('transfer.preparing');
  if (progress?.phase === 'download') {
    label = t('transfer.downloading', { done: progress.done ?? 0, total: progress.total ?? 0 });
  } else if (progress?.phase === 'build') label = t('transfer.building');
  else if (progress?.phase === 'read') label = t('transfer.reading');
  else if (progress?.phase === 'finishing') label = t('transfer.finishing');

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 items-center justify-center bg-black/40">
        <View className="bg-background rounded-xl px-8 py-7 items-center gap-4 min-w-[220px]">
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text className="font-body-md text-body-md text-on-background text-center">{label}</Text>
        </View>
      </View>
    </Modal>
  );
}
