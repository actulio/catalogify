import { useCallback, useState } from 'react';
import { View, TextInput, FlatList, Pressable, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { CatalogItem } from '../domain/types';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { ItemCard } from '../components/ItemCard';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ListDetail'>;

export function ListDetailScreen({ route, navigation }: Props) {
  const { list } = route.params;
  const { user } = useAuth();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState('');
  const ratingField = list.fields.find((f) => f.type === 'rating');

  const load = useCallback(() => {
    if (!user) return;
    const repo = new FirebaseCatalogRepository(user.uid);
    repo
      .getItems(list.id, {
        searchText: search || undefined,
        sortByRatingKey: ratingField?.key,
        sortDirection: 'desc',
      })
      .then(setItems);
  }, [user, search, list.id, ratingField]);

  useFocusEffect(load);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search"
        value={search}
        onChangeText={(text) => {
          setSearch(text);
          load();
        }}
      />
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            list={list}
            onPress={() => navigation.navigate('ItemForm', { list, item })}
          />
        )}
      />
      <Pressable style={styles.fab} onPress={() => navigation.navigate('ItemForm', { list })}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  search: {
    margin: theme.spacing.lg,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.radii.small,
    padding: theme.spacing.md,
  },
  list: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm },
  fab: {
    position: 'absolute',
    right: theme.spacing.lg,
    bottom: theme.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.accentStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: { color: '#FFFFFF', fontSize: 28, lineHeight: 30 },
});
