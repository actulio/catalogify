import { Pressable, Text, View, Image, StyleSheet } from 'react-native';
import { CatalogItem, CatalogList } from '../domain/types';
import { theme } from '../theme/theme';

interface Props {
  item: CatalogItem;
  list: CatalogList;
  onPress: () => void;
}

export function ItemCard({ item, list, onPress }: Props) {
  const ratingField = list.fields.find((f) => f.type === 'rating');
  const rating = ratingField ? item.values[ratingField.key] : undefined;
  const secondaryField = list.fields.find((f) => f.type === 'shortText' || f.type === 'longText');
  const secondary = secondaryField ? item.values[secondaryField.key] : undefined;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} style={styles.thumbnail} />
      ) : (
        <View style={styles.thumbnailPlaceholder} />
      )}
      <View style={styles.body}>
        <Text style={styles.title}>{item.title}</Text>
        {rating !== undefined && rating !== null && (
          <Text style={styles.rating}>{'★'.repeat(Number(rating))}</Text>
        )}
        {secondary ? <Text style={styles.secondary}>{String(secondary)}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.radii.small,
    padding: theme.spacing.sm,
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  thumbnail: { width: 48, height: 48, borderRadius: theme.radii.small },
  thumbnailPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.small,
    backgroundColor: theme.colors.accent,
  },
  body: { flex: 1 },
  title: { fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.textPrimary },
  rating: { color: theme.colors.accentStrong, fontSize: 12 },
  secondary: { color: theme.colors.textSecondary, fontSize: 12 },
});
