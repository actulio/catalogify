import { View, Text } from 'react-native';

export function getStarStates(rating: number, max: number): ('filled' | 'empty')[] {
  const clamped = Math.max(0, Math.min(rating, max));
  return Array.from({ length: max }, (_, i) => (i < clamped ? 'filled' : 'empty'));
}

interface StarRatingProps {
  rating: number;
  max?: number;
  size?: number;
}

export function StarRating({ rating, max = 5, size = 14 }: StarRatingProps) {
  const stars = getStarStates(rating, max);

  return (
    <View className="flex-row items-center gap-0.5">
      {stars.map((state, index) => (
        <Text
          key={index}
          style={{ fontSize: size }}
          className={state === 'filled' ? 'text-primary' : 'text-outline-variant'}
        >
          ★
        </Text>
      ))}
    </View>
  );
}
