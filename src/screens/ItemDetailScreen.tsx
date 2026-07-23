import { useLayoutEffect } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/RootNavigator';
import { FieldDef } from '../domain/types';
import { StarRating } from '../components/StarRating';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { useInvalidateCatalog } from '../hooks/useCatalogQueries';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemDetail'>;

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === '';
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ItemDetailScreen({ route, navigation }: Props) {
  const { list, item } = route.params;
  const { user } = useAuth();
  const invalidate = useInvalidateCatalog(list.id);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: item.title || 'Item',
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('ItemForm', { list, item })}
          accessibilityLabel="Edit item"
          accessibilityRole="button"
        >
          <MaterialIcons name="edit" size={22} color={theme.colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation, list, item]);

  function remove() {
    if (!user) return;
    Alert.alert('Delete item?', `This removes "${item.title}" permanently.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await new FirebaseCatalogRepository(user.uid).deleteItem(list.id, item.id);
            invalidate();
            navigation.goBack();
          } catch (error) {
            console.error('Failed to delete item', error);
            Alert.alert('Could not delete', 'Please try again.');
          }
        },
      },
    ]);
  }

  // Show only fields that have a value; render each by its type.
  const visibleFields = list.fields.filter(
    (f: FieldDef) => f.type !== 'photo' && !isEmpty(item.values[f.key])
  );

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="pb-16">
      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} className="w-full h-72" resizeMode="cover" />
      ) : (
        <View className="w-full h-72 bg-surface-container items-center justify-center">
          <Text className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">
            No photo
          </Text>
        </View>
      )}

      <View className="p-5 gap-4">
        <Text className="font-headline-md text-headline-md text-on-surface">{item.title}</Text>

        {visibleFields.map((field) => {
          const value = item.values[field.key];
          return (
            <View key={field.key} className="gap-1">
              <Text className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">
                {field.label}
              </Text>
              {field.type === 'rating' ? (
                <StarRating rating={Number(value)} max={field.ratingScale?.max ?? 10} size={18} />
              ) : field.type === 'boolean' ? (
                <View
                  className={`self-start px-3 py-1 rounded-full ${
                    value ? 'bg-primary/15' : 'bg-surface-container'
                  }`}
                >
                  <Text className="font-label-md text-label-md text-on-surface">
                    {value ? 'Yes' : 'No'}
                  </Text>
                </View>
              ) : field.type === 'date' ? (
                <Text className="font-body-md text-body-md text-on-surface">
                  {formatDate(Number(value))}
                </Text>
              ) : (
                <Text className="font-body-md text-body-md text-on-surface">{String(value)}</Text>
              )}
            </View>
          );
        })}

        <Pressable onPress={remove} className="mt-4 py-3">
          <Text className="font-label-md text-label-md text-error text-center">Delete item</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
