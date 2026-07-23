import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Image, Alert, Switch } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { FieldDef, FieldType } from '../domain/types';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EditListFields'>;

const FIELD_TYPES: FieldType[] = ['shortText', 'longText', 'number', 'rating', 'photo', 'boolean', 'date'];

// Every catalog gets one required rating field, pre-added and locked (can't be
// removed or retyped) so items always sort/display by a star rating on a 0-10 scale.
const RATING_FIELD_KEY = 'rating';
function makeRatingField(): FieldDef {
  return {
    key: RATING_FIELD_KEY,
    label: 'Rating',
    type: 'rating',
    required: true,
    ratingScale: { max: 10, style: 'stars' },
  };
}
function isLockedRating(field: FieldDef): boolean {
  return field.key === RATING_FIELD_KEY && field.type === 'rating';
}

const FIELD_TYPE_ICONS: Record<FieldType, { name: string; family: 'material' | 'community' }> = {
  shortText: { name: 'short-text', family: 'material' },
  longText: { name: 'notes', family: 'material' },
  number: { name: 'numeric', family: 'community' },
  rating: { name: 'star', family: 'material' },
  photo: { name: 'photo-camera', family: 'material' },
  boolean: { name: 'toggle-on', family: 'material' },
  date: { name: 'event', family: 'material' },
};

function FieldTypeIcon({ type, active }: { type: FieldType; active: boolean }) {
  const { name, family } = FIELD_TYPE_ICONS[type];
  const color = active ? '#ffffff' : theme.colors.onSurfaceVariant;
  return family === 'material' ? (
    <MaterialIcons name={name as any} size={18} color={color} />
  ) : (
    <MaterialCommunityIcons name={name as any} size={18} color={color} />
  );
}

export function EditListFieldsScreen({ route, navigation }: Props) {
  const { user } = useAuth();
  const existing = route.params?.list;
  const [name, setName] = useState(existing?.name ?? '');
  const [fields, setFields] = useState<FieldDef[]>(existing?.fields ?? [makeRatingField()]);
  const [coverUri, setCoverUri] = useState<string | undefined>(existing?.coverUrl);
  const [saving, setSaving] = useState(false);

  function addField() {
    setFields((prev) => [
      ...prev,
      { key: `field_${prev.length}_${Date.now()}`, label: '', type: 'shortText', required: false },
    ]);
  }

  function updateField(index: number, patch: Partial<FieldDef>) {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;
        const next = { ...f, ...patch };
        // A rating field is always required.
        if (next.type === 'rating') next.required = true;
        return next;
      })
    );
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((f, i) => !(i === index && !isLockedRating(f))));
  }

  async function pickCover() {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (!result.canceled) setCoverUri(result.assets[0].uri);
  }

  async function save() {
    if (!user || !name.trim()) return;
    setSaving(true);
    try {
      const repo = new FirebaseCatalogRepository(user.uid);
      // Only upload when the cover is a freshly picked local file — an existing
      // https:// signed URL means it's unchanged.
      const coverChanged =
        !!coverUri && coverUri !== existing?.coverUrl && !coverUri.startsWith('https://');
      const coverToUpload = coverChanged ? coverUri : undefined;
      if (existing) {
        await repo.updateListFields(existing.id, fields);
        if (coverToUpload) await repo.updateListCover(existing.id, coverToUpload);
      } else {
        await repo.createList(name.trim(), fields, coverToUpload);
      }
      navigation.goBack();
    } catch (error) {
      console.error('Failed to save list', error);
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-background p-5">
      <FlatList
        data={fields}
        keyExtractor={(f) => f.key}
        contentContainerClassName="gap-4 pb-6"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View className="gap-6 mb-4">
            <View className="gap-2">
              <Text className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">
                Catalog Identity
              </Text>
              <TextInput
                className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant/40 pb-2"
                placeholder="Catalog Name"
                placeholderClassName="text-surface-dim"
                value={name}
                onChangeText={setName}
                editable={!existing}
              />
              <Text className="font-body-md text-body-md text-on-surface-variant">
                Give your catalog a name. This is what you'll see on the home screen.
              </Text>
            </View>
            <View className="gap-2">
              <Text className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">
                Cover Image
              </Text>
              <Pressable onPress={pickCover}>
                {coverUri ? (
                  <Image
                    source={{ uri: coverUri }}
                    className="w-32 aspect-[4/5] rounded-lg"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-32 aspect-[4/5] rounded-lg border-2 border-dashed border-surface-dim bg-surface-container-low items-center justify-center px-2">
                    <Text className="font-label-md text-label-md text-on-surface-variant text-center">
                      Tap to add cover
                    </Text>
                  </View>
                )}
              </Pressable>
              <Text className="font-body-md text-body-md text-on-surface-variant">
                Optional. Shown behind the catalog name on the home screen.
              </Text>
            </View>
            <View className="gap-1">
              <Text className="font-headline-sm text-headline-sm text-on-surface">
                Attributes & Schema
              </Text>
              <Text className="font-body-md text-body-md text-on-surface-variant">
                Choose what details each item in this catalog will have.
              </Text>
            </View>
          </View>
        }
        renderItem={({ item, index }) => {
          const locked = isLockedRating(item);
          return (
            <View className="bg-surface-container-low rounded-lg p-4 gap-3">
              <TextInput
                className="font-label-md text-label-md text-on-surface border-b border-outline-variant/40 pb-1"
                placeholder="Field label"
                placeholderClassName="text-surface-dim"
                value={item.label}
                onChangeText={(label) => updateField(index, { label })}
              />
              {locked ? (
                <View className="flex-row items-center gap-2">
                  <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary">
                    <FieldTypeIcon type="rating" active />
                    <Text className="font-label-sm text-label-sm text-white">rating</Text>
                  </View>
                  <Text className="font-label-sm text-label-sm text-on-surface-variant">
                    Always included · required
                  </Text>
                </View>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {FIELD_TYPES.map((type) => {
                    const active = item.type === type;
                    return (
                      <Pressable
                        key={type}
                        onPress={() => updateField(index, { type })}
                        className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant/40 ${
                          active ? 'bg-primary' : 'bg-surface-container'
                        }`}
                      >
                        <FieldTypeIcon type={type} active={active} />
                        <Text
                          className={`font-label-sm text-label-sm ${
                            active ? 'text-white' : 'text-on-surface-variant'
                          }`}
                        >
                          {type}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {(item.type === 'rating' || item.type === 'number') && (
                <View className="flex-row items-center justify-between">
                  <Text className="font-label-md text-label-md text-on-surface-variant">
                    Allow sorting by this field
                  </Text>
                  <Switch
                    value={item.sortable !== false}
                    onValueChange={(v) => updateField(index, { sortable: v })}
                    trackColor={{ true: theme.colors.primary }}
                  />
                </View>
              )}
              {!locked && (
                <Pressable onPress={() => removeField(index)}>
                  <Text className="font-label-sm text-label-sm text-error">Remove field</Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />
      <Pressable className="py-4 items-center" onPress={addField}>
        <Text className="font-label-md text-label-md text-primary">+ Add field</Text>
      </Pressable>
      <Pressable
        className={`bg-primary rounded-lg py-4 items-center ${saving ? 'opacity-60' : ''}`}
        onPress={save}
        disabled={saving}
      >
        <Text className="text-white text-base">{saving ? 'Saving...' : 'Save'}</Text>
      </Pressable>
    </View>
  );
}
