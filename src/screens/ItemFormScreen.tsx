import { useState } from 'react';
import { View, Text, TextInput, Pressable, Switch, Image, ScrollView, Alert, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { FieldValue } from '../domain/types';
import { validateItem, hasErrors, ValidationErrors } from '../domain/validation';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemForm'>;

export function ItemFormScreen({ route, navigation }: Props) {
  const { list, item } = route.params;
  const { user } = useAuth();
  const [title, setTitle] = useState(item?.title ?? '');
  const [values, setValues] = useState<Record<string, FieldValue>>(item?.values ?? {});
  const [photoUri, setPhotoUri] = useState<string | undefined>(item?.photoUrl);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saving, setSaving] = useState(false);

  function setValue(key: string, value: FieldValue) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function save() {
    const fieldErrors = validateItem(list, title, values);
    setErrors(fieldErrors);
    if (hasErrors(fieldErrors) || !user) return;

    setSaving(true);
    try {
      const repo = new FirebaseCatalogRepository(user.uid);
      const photoChanged = photoUri && photoUri !== item?.photoUrl && !photoUri.startsWith('https://');
      const photoToUpload = photoChanged ? photoUri : undefined;
      if (item) {
        await repo.updateItem(list.id, item.id, title, values, photoToUpload);
      } else {
        await repo.addItem(list.id, title, values, photoToUpload);
      }
      navigation.goBack();
    } catch {
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!item || !user) return;
    Alert.alert('Delete item?', `This removes "${item.title}" permanently.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const repo = new FirebaseCatalogRepository(user.uid);
            await repo.deleteItem(list.id, item.id);
            navigation.goBack();
          } catch {
            Alert.alert('Could not delete', 'Please try again.');
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TextInput
        style={styles.titleInput}
        placeholder="Title"
        value={title}
        onChangeText={setTitle}
      />
      {errors.title ? <Text style={styles.error}>{errors.title}</Text> : null}

      {list.fields.some((f) => f.type === 'photo') && (
        <Pressable onPress={pickPhoto}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>Add photo</Text>
            </View>
          )}
        </Pressable>
      )}

      {list.fields
        .filter((f) => f.type !== 'photo')
        .map((field) => (
          <View key={field.key} style={styles.fieldBlock}>
            <Text style={styles.label}>{field.label}</Text>

            {(field.type === 'shortText' || field.type === 'number' || field.type === 'date') && (
              <TextInput
                style={styles.input}
                value={values[field.key] != null ? String(values[field.key]) : ''}
                onChangeText={(text) =>
                  setValue(field.key, field.type === 'number' ? Number(text) || 0 : text)
                }
                keyboardType={field.type === 'number' ? 'numeric' : 'default'}
              />
            )}

            {field.type === 'longText' && (
              <TextInput
                style={[styles.input, styles.multiline]}
                multiline
                value={values[field.key] != null ? String(values[field.key]) : ''}
                onChangeText={(text) => setValue(field.key, text)}
              />
            )}

            {field.type === 'rating' && (
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder={`0-${field.ratingScale?.max ?? 10}`}
                value={values[field.key] != null ? String(values[field.key]) : ''}
                onChangeText={(text) => setValue(field.key, Number(text) || 0)}
              />
            )}

            {field.type === 'boolean' && (
              <Switch
                value={Boolean(values[field.key])}
                onValueChange={(v) => setValue(field.key, v)}
              />
            )}

            {errors[field.key] ? <Text style={styles.error}>{errors[field.key]}</Text> : null}
          </View>
        ))}

      <Pressable style={styles.saveButton} onPress={save} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
      </Pressable>

      {item && (
        <Pressable onPress={remove}>
          <Text style={styles.deleteText}>Delete item</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  titleInput: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.radii.small,
    padding: theme.spacing.md,
    fontSize: 16,
  },
  fieldBlock: { gap: theme.spacing.xs },
  label: { fontSize: 12, color: theme.colors.textSecondary },
  input: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.radii.small,
    padding: theme.spacing.md,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  photo: { width: '100%', height: 160, borderRadius: theme.radii.medium },
  photoPlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: theme.radii.medium,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: { color: '#FFFFFF' },
  error: { color: theme.colors.danger, fontSize: 12 },
  saveButton: {
    backgroundColor: theme.colors.accentStrong,
    borderRadius: theme.radii.medium,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 16 },
  deleteText: { color: theme.colors.danger, textAlign: 'center' },
});
