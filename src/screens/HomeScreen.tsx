import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
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

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      const repo = new FirebaseCatalogRepository(user.uid);
      repo.getLists().then(setLists);
    }, [user])
  );

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={[...lists, null]}
        keyExtractor={(item, index) => item?.id ?? `add-${index}`}
        numColumns={2}
        columnWrapperClassName="gap-4"
        contentContainerClassName="p-5 gap-4"
        renderItem={({ item }) =>
          item ? (
            <ListTile
              list={item}
              itemCount={0}
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
