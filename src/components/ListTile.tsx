// src/components/ListTile.tsx
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { CatalogList } from '../domain/types';
import { theme } from '../theme/theme';

interface Props {
  list: CatalogList;
  itemCount: number;
  onPress: () => void;
}

export function ListTile({ list, itemCount, onPress }: Props) {
  return (
    <Pressable style={styles.tile} onPress={onPress}>
      <View style={styles.thumbnail} />
      <Text style={styles.name}>{list.name}</Text>
      <Text style={styles.count}>{itemCount} items</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.radii.medium,
    padding: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  thumbnail: {
    width: '100%',
    height: 60,
    borderRadius: theme.radii.small,
    backgroundColor: theme.colors.accent,
  },
  name: {
    fontFamily: theme.fonts.heading,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  count: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
});
