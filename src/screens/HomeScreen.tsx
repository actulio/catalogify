import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/RootNavigator';
import { CatalogList } from '../domain/types';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { ListTile } from '../components/ListTile';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [lists, setLists] = useState<CatalogList[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const filteredLists = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return lists;
    return lists.filter((l) => l.name.toLowerCase().includes(needle));
  }, [lists, search]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let active = true;
      const repo = new FirebaseCatalogRepository(user.uid);
      setLoading(true);
      repo
        .getLists()
        .then(async (fetched) => {
          if (!active) return;
          setLists(fetched);
          setCounts(await repo.getItemCounts(fetched.map((l) => l.id)));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [user])
  );

  if (loading) {
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
        data={[...filteredLists, null]}
        keyExtractor={(item, index) => item?.id ?? `add-${index}`}
        numColumns={2}
        columnWrapperClassName="gap-4"
        contentContainerClassName="p-5 gap-4"
        renderItem={({ item }) =>
          item ? (
            <ListTile
              list={item}
              itemCount={counts[item.id] ?? 0}
              onPress={() => navigation.navigate('ListDetail', { list: item })}
            />
          ) : (
            <Pressable
              className="flex-1 aspect-[4/5] rounded-lg border-2 border-dashed border-outline-variant items-center justify-center gap-3"
              onPress={() => navigation.navigate('EditListFields', {})}
            >
              <View className="w-14 h-14 rounded-full bg-surface-container items-center justify-center">
                <MaterialIcons name="add" size={26} color={theme.colors.outline} />
              </View>
              <Text className="font-label-md text-label-md text-secondary uppercase tracking-widest">
                New Catalog
              </Text>
            </Pressable>
          )
        }
      />
    </View>
  );
}
