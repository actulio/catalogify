import { Pressable, Text } from 'react-native';
import { CatalogList } from '../domain/types';

interface Props {
  list: CatalogList;
  itemCount: number;
  onPress: () => void;
}

export function ListTile({ list, itemCount, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 aspect-[4/5] bg-surface-container rounded-lg overflow-hidden justify-end p-4"
    >
      <Text className="font-headline-sm text-headline-sm text-on-surface" numberOfLines={2}>
        {list.name}
      </Text>
      <Text className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-tighter mt-1">
        {itemCount} {itemCount === 1 ? 'item' : 'items'}
      </Text>
    </Pressable>
  );
}
