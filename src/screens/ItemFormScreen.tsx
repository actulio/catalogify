import { useState } from 'react';
import { View, Text, TextInput, Pressable, Image, Switch, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { FieldValue } from '../domain/types';
import { validateItem, hasErrors, ValidationErrors } from '../domain/validation';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { useInvalidateCatalog } from '../hooks/useCatalogQueries';
import { theme } from '../theme/theme';
import { FormScreen } from '../components/FormScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemForm'>;

export function ItemFormScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { list, item } = route.params;
  const { user } = useAuth();
  const invalidate = useInvalidateCatalog(list.id);
  const [title, setTitle] = useState(item?.title ?? '');
  const [values, setValues] = useState<Record<string, FieldValue>>(item?.values ?? {});
  const [photoUri, setPhotoUri] = useState<string | undefined>(item?.photoUrl);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saving, setSaving] = useState(false);
  const [datePickerFor, setDatePickerFor] = useState<string | null>(null);

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
      invalidate();
      navigation.goBack();
    } catch (error) {
      console.error('Failed to save item', error);
      Alert.alert(t('common.couldNotSave'), t('common.couldNotSaveBody'));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!item || !user) return;
    Alert.alert(t('itemDetail.deleteItemTitle'), t('itemDetail.deleteItemMessage', { title: item.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            const repo = new FirebaseCatalogRepository(user.uid);
            await repo.deleteItem(list.id, item.id);
            invalidate();
            navigation.goBack();
          } catch (error) {
            console.error('Failed to delete item', error);
            Alert.alert(t('common.couldNotDelete'), t('common.couldNotDeleteBody'));
          }
        },
      },
    ]);
  }

  return (
    <FormScreen className="flex-1 bg-background" contentContainerClassName="p-5 gap-8 pb-16">
      <View className="gap-2">
        <Text className="font-label-md text-label-sm uppercase tracking-widest text-on-surface-variant">
          {t('itemForm.itemTitleLabel')}
        </Text>
        <TextInput
          className="border-b-2 border-surface-dim font-headline-sm text-headline-sm text-on-surface py-3"
          placeholder={t('itemForm.namePlaceholder')}
          placeholderClassName="text-surface-dim"
          value={title}
          onChangeText={setTitle}
        />
        {errors.title ? <Text className="text-error text-xs">{errors.title}</Text> : null}
      </View>

      {list.fields.some((f) => f.type === 'photo') && (
        <View className="gap-2">
          <Text className="font-label-md text-label-sm uppercase tracking-widest text-on-surface-variant">
            {t('itemForm.galleryImageLabel')}
          </Text>
          <Pressable onPress={pickPhoto}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} className="w-full aspect-square rounded-xl" resizeMode="cover" />
            ) : (
              <View className="w-full aspect-square rounded-xl border-2 border-dashed border-surface-dim bg-surface-container-low items-center justify-center">
                <Text className="font-label-md text-label-md text-on-surface-variant">{t('itemForm.tapToAddPhoto')}</Text>
              </View>
            )}
          </Pressable>
        </View>
      )}

      {list.fields
        .filter((f) => f.type !== 'photo')
        .map((field) => (
          <View key={field.key} className="gap-2">
            <Text className="font-label-md text-label-sm uppercase tracking-widest text-on-surface-variant">
              {field.label}
            </Text>

            {(field.type === 'shortText' || field.type === 'number') && (
              <TextInput
                className="bg-surface-container-low border border-surface-dim rounded-lg p-4 font-body-md text-body-md text-on-surface"
                placeholderClassName="text-surface-dim"
                value={values[field.key] != null ? String(values[field.key]) : ''}
                onChangeText={(text) =>
                  setValue(field.key, field.type === 'number' ? Number(text) || 0 : text)
                }
                keyboardType={field.type === 'number' ? 'numeric' : 'default'}
              />
            )}

            {field.type === 'date' && (
              <>
                <Pressable
                  onPress={() => setDatePickerFor(field.key)}
                  className="bg-surface-container-low border border-surface-dim rounded-lg p-4"
                >
                  <Text className="font-body-md text-body-md text-on-surface">
                    {values[field.key] != null
                      ? new Date(Number(values[field.key])).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : t('itemForm.pickDate')}
                  </Text>
                </Pressable>
                {datePickerFor === field.key && (
                  <DateTimePicker
                    value={values[field.key] != null ? new Date(Number(values[field.key])) : new Date()}
                    mode="date"
                    onChange={(event, selected) => {
                      setDatePickerFor(null);
                      if (event.type === 'set' && selected) setValue(field.key, selected.getTime());
                    }}
                  />
                )}
              </>
            )}

            {field.type === 'longText' && (
              <TextInput
                className="bg-surface-container-low border border-surface-dim rounded-lg p-4 font-body-md text-body-md text-on-surface min-h-[80px]"
                placeholderClassName="text-surface-dim"
                multiline
                textAlignVertical="top"
                value={values[field.key] != null ? String(values[field.key]) : ''}
                onChangeText={(text) => setValue(field.key, text)}
              />
            )}

            {field.type === 'rating' && (
              <TextInput
                className="bg-surface-container-low border border-surface-dim rounded-lg p-4 font-body-md text-body-md text-on-surface"
                placeholderClassName="text-surface-dim"
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
                trackColor={{ true: theme.colors.primary }}
              />
            )}

            {errors[field.key] ? <Text className="text-error text-xs">{errors[field.key]}</Text> : null}
          </View>
        ))}

      <Pressable
        className={`bg-primary rounded-lg py-4 items-center ${saving ? 'opacity-60' : ''}`}
        onPress={save}
        disabled={saving}
      >
        <Text className="text-white text-base">{saving ? t('common.saving') : t('common.save')}</Text>
      </Pressable>

      {item && (
        <Pressable onPress={remove}>
          <Text className="text-error text-center">{t('itemForm.deleteItem')}</Text>
        </Pressable>
      )}
    </FormScreen>
  );
}
