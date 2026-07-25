import { useLayoutEffect, useMemo, useState } from 'react';
import { View, TextInput, FlatList, Pressable, Text, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../navigation/RootNavigator';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { ItemCard } from '../components/ItemCard';
import { CatalogActionsSheet } from '../components/CatalogActionsSheet';
import { FilterSortSheet } from '../components/FilterSortSheet';
import { CatalogStats } from '../components/CatalogStats';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useItems, useInvalidateCatalog } from '../hooks/useCatalogQueries';
import { applyQuery, computeStats, Filters, SortSpec } from '../domain/itemQuery';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ListDetail'>;

const DEFAULT_SORT: SortSpec = { field: { kind: 'dateAdded' }, direction: 'desc' };

export function ListDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { list } = route.params;
  const { user } = useAuth();
  const { data: items = [] } = useItems(list.id);
  const invalidate = useInvalidateCatalog(list.id);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [sort, setSort] = useState<SortSpec>(DEFAULT_SORT);
  const [filters, setFilters] = useState<Filters>({});
  const [sheetVisible, setSheetVisible] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);

  const visible = useMemo(
    () => applyQuery(items, { searchText: debouncedSearch, filters, sort }),
    [items, debouncedSearch, filters, sort]
  );
  const stats = useMemo(() => computeStats(visible, list.fields), [visible, list.fields]);
  const filterCount = Object.keys(filters).length;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => setActionsVisible(true)}
          accessibilityLabel={t('listDetail.catalogActions')}
          accessibilityRole="button"
        >
          <MaterialIcons name="more-vert" size={24} color={theme.colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation]);

  function confirmDeleteList() {
    if (!user) return;
    Alert.alert(
      t('listDetail.deleteListTitle'),
      t('listDetail.deleteListMessage', { name: list.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await new FirebaseCatalogRepository(user.uid).deleteList(list.id);
              invalidate();
              navigation.navigate('Home');
            } catch (error) {
              Alert.alert(t('listDetail.couldNotDeleteList'), t('common.couldNotDeleteBody'));
            }
          },
        },
      ]
    );
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
          placeholder={t('listDetail.searchPlaceholder')}
          placeholderClassName="text-surface-dim"
          value={search}
          onChangeText={setSearch}
        />
        <Pressable
          onPress={() => setSheetVisible(true)}
          className={`flex-row items-center justify-center gap-1 px-4 rounded-lg border ${
            filterCount > 0 ? 'border-primary' : 'border-outline-variant/40'
          }`}
          accessibilityLabel={t('listDetail.filterSort')}
          accessibilityRole="button"
        >
          <MaterialIcons
            name="tune"
            size={18}
            color={filterCount > 0 ? theme.colors.primary : theme.colors.onSurfaceVariant}
          />
          {filterCount > 0 && (
            <Text className="font-label-sm text-label-sm text-primary">{filterCount}</Text>
          )}
        </Pressable>
      </View>

      <CatalogStats stats={stats} />

      <FlatList
        data={visible}
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
                name={debouncedSearch.trim() || filterCount > 0 ? 'search-off' : 'inbox'}
                size={30}
                color={theme.colors.outline}
              />
            </View>
            <Text className="font-headline-sm text-headline-sm text-on-surface text-center">
              {debouncedSearch.trim() || filterCount > 0
                ? t('listDetail.noMatchesTitle')
                : t('listDetail.emptyTitle')}
            </Text>
            <Text className="font-body-md text-body-md text-on-surface-variant text-center">
              {debouncedSearch.trim() || filterCount > 0
                ? t('listDetail.noMatchesBody')
                : t('listDetail.emptyBody')}
            </Text>
          </View>
        }
      />

      <Pressable
        onPress={() => navigation.navigate('ItemForm', { list })}
        className="absolute right-5 bottom-5 w-14 h-14 rounded-full bg-primary items-center justify-center"
        accessibilityLabel={t('listDetail.addItem')}
        accessibilityRole="button"
      >
        <MaterialIcons name="add" size={28} color="#ffffff" />
      </Pressable>

      <FilterSortSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        list={list}
        sort={sort}
        onSortChange={setSort}
        filters={filters}
        onFiltersChange={setFilters}
      />

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
