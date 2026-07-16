import { Pressable, Text, View, Image } from 'react-native';
import { CatalogItem, CatalogList } from '../domain/types';
import { StarRating } from './StarRating';

interface Props {
  item: CatalogItem;
  list: CatalogList;
  onPress: () => void;
}

function formatDateAdded(createdAt: number): string {
  return `Added ${new Date(createdAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
}

export function ItemCard({ item, list, onPress }: Props) {
  const ratingField = list.fields.find((f) => f.type === 'rating');
  const rating = ratingField ? item.values[ratingField.key] : undefined;
  const secondaryField = list.fields.find((f) => f.type === 'shortText' || f.type === 'longText');
  const secondary = secondaryField ? item.values[secondaryField.key] : undefined;

  return (
    <Pressable
      onPress={onPress}
      className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden mb-4"
    >
      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} className="w-full h-48" resizeMode="cover" />
      ) : (
        <View className="w-full h-48 bg-surface-container items-center justify-center">
          <Text className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">
            No photo
          </Text>
        </View>
      )}
      <View className="p-4 gap-2">
        <Text className="font-headline-sm text-headline-sm text-on-surface" numberOfLines={2}>
          {item.title}
        </Text>
        {rating !== undefined && rating !== null && (
          <StarRating rating={Number(rating)} max={ratingField?.ratingScale?.max ?? 10} size={15} />
        )}
        {secondary ? (
          <Text className="font-body-md text-body-md text-on-surface-variant" numberOfLines={2}>
            {String(secondary)}
          </Text>
        ) : null}
        <Text className="font-label-sm text-label-sm text-on-surface-variant opacity-70">
          {formatDateAdded(item.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}
