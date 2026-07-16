import { View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../theme/theme';

export type StarState = 'full' | 'half' | 'empty';

// Map a raw rating on a 0..max scale onto a fixed number of stars, rounded to
// the nearest half so the 0-10 field values render as familiar 5-star ratings
// (e.g. 7/10 -> 3.5 stars). max <= 0 yields all-empty stars.
export function getStarStates(rating: number, max: number, starCount = 5): StarState[] {
  const scaled = max > 0 ? Math.max(0, Math.min(rating / max, 1)) * starCount : 0;
  const halves = Math.round(scaled * 2) / 2;
  return Array.from({ length: starCount }, (_, i) => {
    if (halves >= i + 1) return 'full';
    if (halves >= i + 0.5) return 'half';
    return 'empty';
  });
}

const ICON: Record<StarState, keyof typeof MaterialIcons.glyphMap> = {
  full: 'star',
  half: 'star-half',
  empty: 'star-border',
};

interface StarRatingProps {
  rating: number;
  max?: number;
  size?: number;
}

export function StarRating({ rating, max = 10, size = 14 }: StarRatingProps) {
  const stars = getStarStates(rating, max);

  return (
    <View className="flex-row items-center gap-0.5">
      {stars.map((state, index) => (
        <MaterialIcons
          key={index}
          name={ICON[state]}
          size={size}
          color={state === 'empty' ? theme.colors.outlineVariant : theme.colors.primary}
        />
      ))}
    </View>
  );
}
