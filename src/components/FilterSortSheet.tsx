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
import { CatalogList } from '../domain/types';
import { Filters, SortField, SortSpec, DATE_FILTER_KEY } from '../domain/itemQuery';
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
function sortOptions(list: CatalogList): { label: string; field: SortField }[] {
  const opts: { label: string; field: SortField }[] = [
    { label: 'Date added', field: { kind: 'dateAdded' } },
    { label: 'Title', field: { kind: 'title' } },
  ];
  for (const f of list.fields) {
    if (f.type === 'rating' || f.type === 'number') {
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
  const [rendered, setRendered] = useState(visible);
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
  const rangeFields = list.fields.filter((f) => f.type === 'rating' || f.type === 'number');

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
          <Text className="font-headline-sm text-headline-sm text-on-surface mb-3">Sort by</Text>
          <View className="gap-2 mb-6">
            {sortOptions(list).map((opt) => {
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
                  {active && (
                    <MaterialIcons
                      name={sort.direction === 'asc' ? 'arrow-upward' : 'arrow-downward'}
                      size={18}
                      color={theme.colors.primary}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>

          {(rangeFields.length > 0 || boolFields.length > 0) && (
            <Text className="font-headline-sm text-headline-sm text-on-surface mb-3">Filters</Text>
          )}

          {rangeFields.map((f) => {
            const current = filters[f.key];
            const min = current?.kind === 'range' ? current.min : undefined;
            return (
              <View key={f.key} className="mb-4">
                <Text className="font-label-md text-label-md text-on-surface-variant mb-2">
                  {f.label}: at least {min ?? 'any'}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {[undefined, ...thresholdsFor(f.type as 'rating' | 'number', f.ratingScale?.max)].map((t, idx) => {
                    const selected = min === t;
                    return (
                      <Pressable
                        key={idx}
                        onPress={() =>
                          setFilter(f.key, t === undefined ? undefined : { kind: 'range', min: t })
                        }
                        className={`px-3 py-2 rounded-full border ${
                          selected ? 'border-primary bg-primary/10' : 'border-outline-variant/40'
                        }`}
                      >
                        <Text className="font-label-md text-label-md text-on-surface">
                          {t === undefined ? 'Any' : `${t}+`}
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
              { label: 'Any', value: undefined },
              { label: 'Yes', value: true },
              { label: 'No', value: false },
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

          <Pressable onPress={() => onFiltersChange({})} className="mt-2 mb-1 py-3 items-center">
            <Text className="font-label-md text-label-md text-primary">Clear all filters</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// Threshold chips: ratings step by 2 up to their max (default 10); numbers use a
// small generic ladder. Kept simple deliberately — a range slider is future work.
function thresholdsFor(type: 'rating' | 'number', ratingMax = 10): number[] {
  if (type === 'rating') {
    const out: number[] = [];
    for (let t = 2; t <= ratingMax; t += 2) out.push(t);
    return out;
  }
  return [10, 25, 50, 100];
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '85%' },
});
