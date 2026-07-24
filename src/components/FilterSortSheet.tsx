import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { CatalogList } from '../domain/types';
import { Filters, SortField, SortSpec, DEFAULT_SORT } from '../domain/itemQuery';
import { theme } from '../theme/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  list: CatalogList;
  sort: SortSpec;
  onSortChange: (sort: SortSpec) => void;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

// Sortable options: date, title, then each rating/number field in the schema.
function sortOptions(list: CatalogList, t: TFunction): { label: string; field: SortField }[] {
  const opts: { label: string; field: SortField }[] = [
    { label: t('filterSort.sortDateAdded'), field: { kind: 'dateAdded' } },
    { label: t('filterSort.sortTitle'), field: { kind: 'title' } },
  ];
  for (const f of list.fields) {
    if ((f.type === 'rating' || f.type === 'number') && f.sortable !== false) {
      opts.push({ label: f.label, field: { kind: 'field', key: f.key } });
    }
  }
  return opts;
}

function sameField(a: SortField, b: SortField): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'field' && b.kind === 'field') return a.key === b.key;
  return true;
}

export function FilterSortSheet({
  visible,
  onClose,
  list,
  sort,
  onSortChange,
  filters,
  onFiltersChange,
}: Props) {
  const { t } = useTranslation();
  const [rendered, setRendered] = useState(visible);
  const [datePickerFor, setDatePickerFor] = useState<{ key: string; bound: 'from' | 'to' } | null>(null);
  const progress = useSharedValue(0);
  const sheetHeight = useSharedValue(700);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      progress.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
    } else {
      progress.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }, (f) => {
        if (f) runOnJS(setRendered)(false);
      });
    }
  }, [visible, progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * sheetHeight.value }],
  }));

  if (!rendered) return null;

  function setFilter(key: string, filter: Filters[string] | undefined) {
    const next = { ...filters };
    if (filter === undefined) delete next[key];
    else next[key] = filter;
    onFiltersChange(next);
  }

  const boolFields = list.fields.filter((f) => f.type === 'boolean');
  const ratingFields = list.fields.filter((f) => f.type === 'rating');
  const numberFields = list.fields.filter((f) => f.type === 'number');
  const dateFields = list.fields.filter((f) => f.type === 'date');

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      </Pressable>
      <Animated.View
        onLayout={(e) => (sheetHeight.value = e.nativeEvent.layout.height)}
        style={[styles.sheet, sheetStyle]}
        className="absolute inset-x-0 bottom-0 bg-surface-container rounded-t-3xl p-5"
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text className="font-headline-sm text-headline-sm text-on-surface mb-3">
            {t('filterSort.sortBy')}
          </Text>
          <View className="gap-2 mb-6">
            {sortOptions(list, t).map((opt) => {
              const active = sameField(sort.field, opt.field);
              return (
                <Pressable
                  key={opt.label}
                  onPress={() =>
                    onSortChange({
                      field: opt.field,
                      direction: active && sort.direction === 'desc' ? 'asc' : 'desc',
                    })
                  }
                  className={`flex-row items-center justify-between rounded-lg px-4 py-3 border ${
                    active ? 'border-primary' : 'border-outline-variant/40'
                  }`}
                >
                  <Text className="font-body-md text-body-md text-on-surface">{opt.label}</Text>
                  <MaterialIcons
                    name={
                      active && sort.direction === 'asc' ? 'arrow-upward' : 'arrow-downward'
                    }
                    size={18}
                    color={active ? theme.colors.primary : theme.colors.onSurfaceVariant}
                  />
                </Pressable>
              );
            })}
          </View>

          {(ratingFields.length > 0 ||
            numberFields.length > 0 ||
            boolFields.length > 0 ||
            dateFields.length > 0) && (
            <Text className="font-headline-sm text-headline-sm text-on-surface mb-3">
              {t('filterSort.filters')}
            </Text>
          )}

          {ratingFields.map((f) => {
            const current = filters[f.key];
            const min = current?.kind === 'range' && current.min !== undefined ? current.min : 0;
            const max = f.ratingScale?.max ?? 10;
            return (
              <View key={f.key} className="mb-4">
                <Text className="font-label-md text-label-md text-on-surface-variant mb-2">
                  {f.label}: {min === 0 ? t('filterSort.any') : t('filterSort.atLeast', { value: min })}
                </Text>
                <Slider
                  minimumValue={0}
                  maximumValue={max}
                  step={1}
                  value={min}
                  onSlidingComplete={(v) =>
                    setFilter(f.key, v === 0 ? undefined : { kind: 'range', min: v })
                  }
                  minimumTrackTintColor={theme.colors.primary}
                  maximumTrackTintColor={theme.colors.outlineVariant}
                  thumbTintColor={theme.colors.primary}
                />
              </View>
            );
          })}

          {numberFields.map((f) => {
            const current = filters[f.key];
            const min = current?.kind === 'range' ? current.min : undefined;
            return (
              <View key={f.key} className="mb-4">
                <Text className="font-label-md text-label-md text-on-surface-variant mb-2">
                  {f.label}:{' '}
                  {min === undefined ? t('filterSort.any') : t('filterSort.atLeast', { value: min })}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {[undefined, ...NUMBER_THRESHOLDS].map((threshold, idx) => {
                    const selected = min === threshold;
                    return (
                      <Pressable
                        key={idx}
                        onPress={() =>
                          setFilter(
                            f.key,
                            threshold === undefined ? undefined : { kind: 'range', min: threshold }
                          )
                        }
                        className={`px-3 py-2 rounded-full border ${
                          selected ? 'border-primary bg-primary/10' : 'border-outline-variant/40'
                        }`}
                      >
                        <Text className="font-label-md text-label-md text-on-surface">
                          {threshold === undefined ? t('filterSort.any') : `${threshold}+`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {boolFields.map((f) => {
            const current = filters[f.key];
            const val = current?.kind === 'boolean' ? current.value : undefined;
            const options: { label: string; value: boolean | undefined }[] = [
              { label: t('filterSort.any'), value: undefined },
              { label: t('filterSort.yes'), value: true },
              { label: t('filterSort.no'), value: false },
            ];
            return (
              <View key={f.key} className="mb-4">
                <Text className="font-label-md text-label-md text-on-surface-variant mb-2">
                  {f.label}
                </Text>
                <View className="flex-row gap-2">
                  {options.map((o) => {
                    const selected = val === o.value;
                    return (
                      <Pressable
                        key={o.label}
                        onPress={() =>
                          setFilter(f.key, o.value === undefined ? undefined : { kind: 'boolean', value: o.value })
                        }
                        className={`px-4 py-2 rounded-full border ${
                          selected ? 'border-primary bg-primary/10' : 'border-outline-variant/40'
                        }`}
                      >
                        <Text className="font-label-md text-label-md text-on-surface">{o.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {dateFields.map((f) => {
            const current = filters[f.key];
            const range = current?.kind === 'dateRange' ? current : undefined;
            const label = (ms?: number) =>
              ms === undefined
                ? t('filterSort.any')
                : new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
            function setBound(bound: 'from' | 'to', ms: number | undefined) {
              const next = { ...(range ?? { kind: 'dateRange' as const }) };
              if (ms === undefined) delete next[bound];
              else next[bound] = ms;
              // if both bounds cleared, drop the filter entirely
              if (next.from === undefined && next.to === undefined) setFilter(f.key, undefined);
              else setFilter(f.key, next);
            }
            return (
              <View key={f.key} className="mb-4">
                <Text className="font-label-md text-label-md text-on-surface-variant mb-2">{f.label}</Text>
                <View className="flex-row gap-2">
                  {(['from', 'to'] as const).map((bound) => (
                    <Pressable
                      key={bound}
                      onPress={() => setDatePickerFor({ key: f.key, bound })}
                      className={`flex-1 px-3 py-2 rounded-lg border ${
                        range?.[bound] !== undefined ? 'border-primary' : 'border-outline-variant/40'
                      }`}
                    >
                      <Text className="font-label-sm text-label-sm text-on-surface-variant">
                        {bound === 'from' ? t('filterSort.from') : t('filterSort.to')}
                      </Text>
                      <Text className="font-body-md text-body-md text-on-surface">{label(range?.[bound])}</Text>
                    </Pressable>
                  ))}
                  {range && (
                    <Pressable onPress={() => setFilter(f.key, undefined)} className="px-3 py-2 justify-center">
                      <Text className="font-label-md text-label-md text-primary">{t('filterSort.clear')}</Text>
                    </Pressable>
                  )}
                </View>
                {datePickerFor?.key === f.key && (
                  <DateTimePicker
                    value={range?.[datePickerFor.bound] !== undefined ? new Date(range[datePickerFor.bound]!) : new Date()}
                    mode="date"
                    onChange={(event, selected) => {
                      const bound = datePickerFor.bound;
                      setDatePickerFor(null);
                      if (event.type === 'set' && selected) setBound(bound, selected.getTime());
                    }}
                  />
                )}
              </View>
            );
          })}

          <Pressable
            onPress={() => {
              onFiltersChange({});
              onSortChange(DEFAULT_SORT);
            }}
            className="mt-2 mb-1 py-3 items-center"
          >
            <Text className="font-label-md text-label-md text-primary">{t('filterSort.clearAll')}</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// Number filter offers a small fixed ladder of "at least" thresholds.
const NUMBER_THRESHOLDS = [10, 25, 50, 100];

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '85%' },
});
