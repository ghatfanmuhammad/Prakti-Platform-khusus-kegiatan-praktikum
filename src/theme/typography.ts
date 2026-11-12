import type { TextStyle } from 'react-native';

export const typography = {
  headerTitle: { fontSize: 16, lineHeight: 20, fontWeight: '700', letterSpacing: 1.5 },
  headerSubtitle: { fontSize: 12, lineHeight: 16 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  subtitle: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  body: { fontSize: 13, lineHeight: 18 },
  bodyBold: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16 },
  captionBold: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  button: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
} satisfies Record<string, TextStyle>;
