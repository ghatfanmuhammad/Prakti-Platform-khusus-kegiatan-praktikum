import { Platform, type ViewStyle } from 'react-native';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  sheet: 20,
  pill: 999,
} as const;

/** Tinggi minimum area yang bisa disentuh. */
export const TOUCH_TARGET = 44;

export const cardShadow: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: '#0B1A5C',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
  },
  android: { elevation: 2 },
  default: {},
});
