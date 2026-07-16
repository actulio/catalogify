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
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ListDetail'>;

export function ListDetailScreen({ route, navigation }: Props) {
  const { list } = route.params;
  const { user } = useAuth();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState('');
  const [sortByRating, setSortByRating] = useState(true);
  const [actionsVisible, setActionsVisible] = useState(false);
  const ratingField = list.fields.find((f) => f.type === 'rating');

  const load = useCallback(() => {
    if (!user) return;
    const repo = new FirebaseCatalogRepository(user.uid);
    repo
      .getItems(list.id, {
        searchText: search || undefined,
        sortByRatingKey: sortByRating ? ratingField?.key : undefined,
        sortDirection: 'desc',
      })
      .then(setItems);
  }, [user, search, list.id, ratingField, sortByRating]);

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
      <View className="px-5 pt-4 flex-row items-center gap-3">
        <TextInput
          className="flex-1 bg-surface-container-low rounded-lg p-4 font-body-md text-body-md text-on-surface"
          placeholder="Search"
          placeholderClassName="text-surface-dim"
          value={search}
          onChangeText={(text) => {
            setSearch(text);
            load();
          }}
        />
        {ratingField && (
          <Pressable
            onPress={() => setSortByRating((prev) => !prev)}
            className={`px-3 py-3 rounded-lg border border-outline-variant/40 ${
              sortByRating ? 'bg-primary' : 'bg-surface-container'
            }`}
            accessibilityLabel="Sort by rating"
            accessibilityRole="button"
          >
            <MaterialIcons
              name="star"
              size={16}
              color={sortByRating ? '#ffffff' : theme.colors.onSurfaceVariant}
            />
          </Pressable>
        )}
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerClassName="px-5 pt-4 pb-24"
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            list={list}
            onPress={() => navigation.navigate('ItemForm', { list, item })}
          />
        )}
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
        onDelete={() => {
          setActionsVisible(false);
          confirmDeleteList();
        }}
      />
    </View>
  );
}
