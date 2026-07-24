import { useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../navigation/RootNavigator';
import { CatalogList } from '../domain/types';
import { useLists, useItemCounts } from '../hooks/useCatalogQueries';
import { ListTile } from '../components/ListTile';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type GridCell =
  | { kind: 'list'; key: string; list: CatalogList }
  | { kind: 'add'; key: string };

export function HomeScreen({ navigation }: Props) {
  const { data: lists = [], isLoading } = useLists();
  const { data: counts = {} } = useItemCounts(lists.map((l) => l.id));
  const [search, setSearch] = useState('');
  const { t } = useTranslation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          accessibilityLabel={t('home.openSettings')}
          accessibilityRole="button"
        >
          <MaterialIcons name="settings" size={22} color={theme.colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation, t]);

  const filteredLists = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return lists;
    return lists.filter((l) => l.name.toLowerCase().includes(needle));
  }, [lists, search]);

  // The 2-column grid is the catalog tiles plus a trailing "New Catalog" tile.
  const gridCells = useMemo<GridCell[]>(() => {
    const cells: GridCell[] = filteredLists.map((list) => ({ kind: 'list', key: list.id, list }));
    cells.push({ kind: 'add', key: '__add__' });
    return cells;
  }, [filteredLists]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="px-5 pt-4 pb-1">
        <TextInput
          className="bg-surface-container-low rounded-lg p-4 font-body-md text-body-md text-on-surface"
          placeholder="Search catalogs"
          placeholderClassName="text-surface-dim"
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <FlatList
        data={gridCells}
        keyExtractor={(cell) => cell.key}
        numColumns={2}
        columnWrapperClassName="justify-between"
        contentContainerClassName="p-5 gap-4"
        renderItem={({ item: cell }) => {
          if (cell.kind === 'list') {
            return (
              <ListTile
                list={cell.list}
                itemCount={counts[cell.list.id] ?? 0}
                onPress={() => navigation.navigate('ListDetail', { list: cell.list })}
              />
            );
          }
          return (
            <Pressable
              className="w-[48%] aspect-[4/5] rounded-lg border-2 border-dashed border-outline-variant items-center justify-center gap-3"
              onPress={() => navigation.navigate('EditListFields', {})}
            >
              <View className="w-14 h-14 rounded-full bg-surface-container items-center justify-center">
                <MaterialIcons name="add" size={26} color={theme.colors.outline} />
              </View>
              <Text className="font-label-md text-label-md text-secondary uppercase tracking-widest">
                New Catalog
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
