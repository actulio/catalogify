import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="mx-5 mb-3 rounded-xl bg-surface-container-low overflow-hidden">
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        className="flex-row items-center justify-between px-4 py-3"
        accessibilityRole="button"
        accessibilityLabel={t('listDetail.toggleStats')}
      >
        <Text className="font-label-md text-label-md text-on-surface">
          {t('common.item', { count: stats.total })}
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
                {f.type === 'rating' && t('stats.average', { value: fmt(f.average) })}
                {f.type === 'number' &&
                  t('stats.averageRange', {
                    avg: fmt(f.average),
                    min: fmt(f.min),
                    max: fmt(f.max),
                  })}
                {f.type === 'boolean' && t('stats.yesNo', { yes: f.yes, no: f.no })}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
