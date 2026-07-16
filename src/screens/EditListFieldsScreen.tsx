import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { FieldDef, FieldType } from '../domain/types';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EditListFields'>;

const FIELD_TYPES: FieldType[] = ['shortText', 'longText', 'number', 'rating', 'photo', 'boolean', 'date'];

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
    <View style={styles.container}>
      <TextInput
        style={styles.nameInput}
        placeholder="List name (e.g. Coffees)"
        value={name}
        onChangeText={setName}
        editable={!existing}
      />
      <FlatList
        data={fields}
        keyExtractor={(f) => f.key}
        contentContainerStyle={styles.fieldList}
        renderItem={({ item, index }) => (
          <View style={styles.fieldRow}>
            <TextInput
              style={styles.fieldLabelInput}
              placeholder="Field label"
              value={item.label}
              onChangeText={(label) => updateField(index, { label })}
            />
            <View style={styles.typeRow}>
              {FIELD_TYPES.map((type) => (
                <Pressable
                  key={type}
                  style={[styles.typeChip, item.type === type && styles.typeChipActive]}
                  onPress={() => updateField(index, { type })}
                >
                  <Text style={styles.typeChipText}>{type}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => removeField(index)}>
              <Text style={styles.removeText}>Remove field</Text>
            </Pressable>
          </View>
        )}
      />
      <Pressable style={styles.addFieldButton} onPress={addField}>
        <Text style={styles.addFieldText}>+ Add field</Text>
      </Pressable>
      <Pressable style={styles.saveButton} onPress={save} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.lg },
  nameInput: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.radii.small,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  fieldList: { gap: theme.spacing.md },
  fieldRow: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.radii.small,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  fieldLabelInput: { fontSize: 15, color: theme.colors.textPrimary },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  typeChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.background,
  },
  typeChipActive: { backgroundColor: theme.colors.accent },
  typeChipText: { fontSize: 11, color: theme.colors.textPrimary },
  removeText: { fontSize: 12, color: theme.colors.danger },
  addFieldButton: { paddingVertical: theme.spacing.md, alignItems: 'center' },
  addFieldText: { color: theme.colors.accentStrong },
  saveButton: {
    backgroundColor: theme.colors.accentStrong,
    borderRadius: theme.radii.medium,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 16 },
});
