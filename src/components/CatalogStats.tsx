import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CatalogStatsData } from '../domain/itemQuery';
import { theme } from '../theme/theme';

interface Props {
  stats: CatalogStatsData;
}

function fmt(n: number | null): string {
  if (n === null) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function CatalogStats({ stats }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="mx-5 mb-3 rounded-xl bg-surface-container-low overflow-hidden">
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        className="flex-row items-center justify-between px-4 py-3"
        accessibilityRole="button"
        accessibilityLabel="Toggle catalog stats"
      >
        <Text className="font-label-md text-label-md text-on-surface">
          {stats.total} {stats.total === 1 ? 'item' : 'items'}
        </Text>
        <MaterialIcons
          name={expanded ? 'expand-less' : 'expand-more'}
          size={20}
          color={theme.colors.onSurfaceVariant}
        />
      </Pressable>

      {expanded && stats.fields.length > 0 && (
        <View className="px-4 pb-3 gap-2">
          {stats.fields.map((f) => (
            <View key={f.key} className="flex-row justify-between">
              <Text className="font-body-md text-body-md text-on-surface-variant">{f.label}</Text>
              <Text className="font-body-md text-body-md text-on-surface">
                {f.type === 'rating' && `avg ${fmt(f.average)}`}
                {f.type === 'number' && `avg ${fmt(f.average)} · ${fmt(f.min)}–${fmt(f.max)}`}
                {f.type === 'boolean' && `${f.yes} yes · ${f.no} no`}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
