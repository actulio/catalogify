import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Alert } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { FieldDef, FieldType } from '../domain/types';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EditListFields'>;

const FIELD_TYPES: FieldType[] = ['shortText', 'longText', 'number', 'rating', 'photo', 'boolean', 'date'];

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
  const [fields, setFields] = useState<FieldDef[]>(existing?.fields ?? []);
  const [saving, setSaving] = useState(false);

  function addField() {
    setFields((prev) => [
      ...prev,
      { key: `field_${prev.length}_${Date.now()}`, label: '', type: 'shortText', required: false },
    ]);
  }

  function updateField(index: number, patch: Partial<FieldDef>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    if (!user || !name.trim()) return;
    setSaving(true);
    try {
      const repo = new FirebaseCatalogRepository(user.uid);
      if (existing) {
        await repo.updateListFields(existing.id, fields);
      } else {
        await repo.createList(name.trim(), fields);
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
      <TextInput
        className="bg-surface-container-low rounded-lg p-4 mb-4 font-body-md text-body-md text-on-surface"
        placeholder="List name (e.g. Coffees)"
        placeholderClassName="text-surface-dim"
        value={name}
        onChangeText={setName}
        editable={!existing}
      />
      <FlatList
        data={fields}
        keyExtractor={(f) => f.key}
        contentContainerClassName="gap-4 pb-6"
        renderItem={({ item, index }) => (
          <View className="bg-surface-container-low rounded-lg p-4 gap-3">
            <TextInput
              className="font-label-md text-label-md text-on-surface border-b border-outline-variant/40 pb-1"
              placeholder="Field label"
              placeholderClassName="text-surface-dim"
              value={item.label}
              onChangeText={(label) => updateField(index, { label })}
            />
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
            <Pressable onPress={() => removeField(index)}>
              <Text className="font-label-sm text-label-sm text-error">Remove field</Text>
            </Pressable>
          </View>
        )}
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
