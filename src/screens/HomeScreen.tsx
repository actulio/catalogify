// src/screens/HomeScreen.tsx
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
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
    <View style={styles.container}>
      <FlatList
        data={[...lists, null]}
        keyExtractor={(item, index) => item?.id ?? `add-${index}`}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        renderItem={({ item }) =>
          item ? (
            <ListTile
              list={item}
              itemCount={0}
              onPress={() => navigation.navigate('ListDetail', { list: item })}
            />
          ) : (
            <Pressable
              style={styles.addTile}
              onPress={() => navigation.navigate('EditListFields', {})}
            >
              <Text style={styles.addIcon}>+</Text>
            </Pressable>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  row: { gap: theme.spacing.md },
  addTile: {
    flex: 1,
    borderRadius: theme.radii.medium,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
  },
  addIcon: { fontSize: 22, color: theme.colors.accent },
});
