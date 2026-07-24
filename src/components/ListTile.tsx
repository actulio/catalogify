import { Pressable, Text, View, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CatalogList } from '../domain/types';

interface Props {
  list: CatalogList;
  itemCount: number;
  onPress: () => void;
}

export function ListTile({ list, itemCount, onPress }: Props) {
  const { t } = useTranslation();
  const hasCover = !!list.coverUrl;
  return (
    <Pressable
      onPress={onPress}
      className="w-[48%] aspect-[4/5] bg-surface-container rounded-lg overflow-hidden justify-end p-4"
    >
      {hasCover && (
        <>
          <Image
            source={{ uri: list.coverUrl }}
            className="absolute inset-0"
            resizeMode="cover"
          />
          {/* Solid dark scrim behind the text so the name/count stay legible over
              any cover. A true gradient would need the native expo-linear-gradient
              module (and a dev rebuild); a solid scrim works on a plain JS reload. */}
          <View className="absolute inset-x-0 bottom-0 h-1/2 bg-black/45" />
        </>
      )}
      <Text
        className={`font-headline-sm text-headline-sm ${hasCover ? 'text-white' : 'text-on-surface'}`}
        numberOfLines={2}
      >
        {list.name}
      </Text>
      <Text
        className={`font-label-sm text-label-sm uppercase tracking-tighter mt-1 ${
          hasCover ? 'text-white/80' : 'text-on-surface-variant'
        }`}
      >
        {t('common.item', { count: itemCount })}
      </Text>
    </Pressable>
  );
}
