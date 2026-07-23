import { useCallback, useLayoutEffect, useState } from 'react';
import { View, TextInput, FlatList, Pressable, Text, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/RootNavigator';
import { CatalogItem } from '../domain/types';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { ItemCard } from '../components/ItemCard';
import { CatalogActionsSheet } from '../components/CatalogActionsSheet';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ListDetail'>;

// Sort cycles: date (newest first, no rating sort) -> rating high-to-low -> rating low-to-high.
type SortMode = 'date' | 'desc' | 'asc';
const NEXT_SORT: Record<SortMode, SortMode> = { date: 'desc', desc: 'asc', asc: 'date' };
const SORT_ARROW: Record<SortMode, keyof typeof MaterialIcons.glyphMap> = {
  date: 'unfold-more',
  desc: 'arrow-downward',
  asc: 'arrow-upward',
};

export function ListDetailScreen({ route, navigation }: Props) {
  const { list } = route.params;
  const { user } = useAuth();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [sortMode, setSortMode] = useState<SortMode>('desc');
  const [actionsVisible, setActionsVisible] = useState(false);
  const ratingField = list.fields.find((f) => f.type === 'rating');

  const load = useCallback(() => {
    if (!user) return;
    const repo = new FirebaseCatalogRepository(user.uid);
    repo
      .getItems(list.id, {
        searchText: debouncedSearch || undefined,
        sortByRatingKey: sortMode === 'date' ? undefined : ratingField?.key,
        sortDirection: sortMode === 'asc' ? 'asc' : 'desc',
      })
      .then(setItems);
  }, [user, debouncedSearch, list.id, ratingField, sortMode]);

  useFocusEffect(load);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => setActionsVisible(true)}
          accessibilityLabel="Catalog actions"
          accessibilityRole="button"
        >
          <MaterialIcons name="more-vert" size={24} color={theme.colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation]);

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
    <View className="flex-1 bg-background">
      <Text
        className="px-5 pt-4 font-headline-md text-headline-md text-on-surface"
        numberOfLines={1}
      >
        {list.name}
      </Text>
      <View className="px-5 pt-3 pb-4 flex-row items-stretch gap-3">
        <TextInput
          className="flex-1 bg-surface-container-low rounded-lg p-4 font-body-md text-body-md text-on-surface"
          placeholder="Search"
          placeholderClassName="text-surface-dim"
          value={search}
          onChangeText={setSearch}
        />
        {ratingField && (
          <Pressable
            onPress={() => setSortMode((prev) => NEXT_SORT[prev])}
            className={`flex-row items-center justify-center gap-1 px-4 rounded-lg border ${
              sortMode === 'date' ? 'border-outline-variant/40' : 'border-primary'
            }`}
            accessibilityLabel={
              sortMode === 'date'
                ? 'Sort by rating'
                : `Sorted by rating ${sortMode === 'desc' ? 'high to low' : 'low to high'}`
            }
            accessibilityRole="button"
          >
            <MaterialIcons
              name="star"
              size={18}
              color={sortMode === 'date' ? theme.colors.onSurfaceVariant : theme.colors.primary}
            />
            <MaterialIcons
              name={SORT_ARROW[sortMode]}
              size={18}
              color={sortMode === 'date' ? theme.colors.onSurfaceVariant : theme.colors.primary}
            />
          </Pressable>
        )}
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerClassName="px-5 pb-24"
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            list={list}
            onPress={() => navigation.navigate('ItemDetail', { list, item })}
          />
        )}
        ListEmptyComponent={
          <View className="items-center pt-24 px-8 gap-3">
            <View className="w-16 h-16 rounded-full bg-surface-container items-center justify-center">
              <MaterialIcons
                name={debouncedSearch.trim() ? 'search-off' : 'inbox'}
                size={30}
                color={theme.colors.outline}
              />
            </View>
            <Text className="font-headline-sm text-headline-sm text-on-surface text-center">
              {debouncedSearch.trim() ? 'No matches' : 'This catalog is empty'}
            </Text>
            <Text className="font-body-md text-body-md text-on-surface-variant text-center">
              {debouncedSearch.trim()
                ? `No items match "${debouncedSearch.trim()}".`
                : 'Tap + to add your first item.'}
            </Text>
          </View>
        }
      />
      <Pressable
        onPress={() => navigation.navigate('ItemForm', { list })}
        className="absolute right-5 bottom-5 w-14 h-14 rounded-full bg-primary items-center justify-center"
        accessibilityLabel="Add item"
        accessibilityRole="button"
      >
        <MaterialIcons name="add" size={28} color="#ffffff" />
      </Pressable>
      <CatalogActionsSheet
        visible={actionsVisible}
        onClose={() => setActionsVisible(false)}
        onEdit={() => {
          setActionsVisible(false);
          navigation.navigate('EditListFields', { list });
        }}
        onDelete={() => {
          setActionsVisible(false);
          confirmDeleteList();
        }}
      />
    </View>
  );
}
