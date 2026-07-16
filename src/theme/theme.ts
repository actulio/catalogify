// Non-className values for the few RN props NativeWind's `className` can't
// reach: @expo/vector-icons' `color` prop and Switch.trackColor.
// tailwind.config.js remains the single source of truth for all Warm Archive
// tokens — these are kept in sync with it by hand, since there's no
// cross-runtime way to import Tailwind config values into plain JS props.
export const theme = {
  colors: {
    primary: '#97422f',
    onSurfaceVariant: '#55423e',
    outline: '#88726d',
    danger: '#ba1a1a',
  },
} as const;

export type Theme = typeof theme;
