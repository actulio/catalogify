import { useCallback, useState } from 'react';
import { View, TextInput, FlatList, Pressable, Text, StyleSheet, Alert } from 'react-native';
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

  function confirmDeleteList() {
    if (!user) return;
    Alert.alert('Delete list?', `This removes "${list.name}" and all its items permanently.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const repo = new FirebaseCatalogRepository(user.uid);
            await repo.deleteList(list.id);
            navigation.navigate('Home');
          } catch (error) {
            Alert.alert('Could not delete list', 'Please try again.');
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={confirmDeleteList} style={styles.deleteListButton}>
        <Text style={styles.deleteListText}>Delete this list</Text>
      </Pressable>
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
  deleteListButton: { alignSelf: 'flex-end', marginHorizontal: theme.spacing.lg },
  deleteListText: { color: theme.colors.danger, fontSize: 12 },
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
