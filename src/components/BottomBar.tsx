import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { cardShadow, colors, TOUCH_TARGET } from '../theme';
import type { IconName } from './icons';

export interface BottomBarItem {
  label: string;
  icon: IconName;
  iconActive: IconName;
}

type Props = BottomTabBarProps & {
  /** Konfigurasi ikon per nama rute. */
  items: Record<string, BottomBarItem>;
  /** Bila diisi, tombol bulat melayang muncul di tengah (dipakai praktikan untuk presensi). */
  onCenterPress?: () => void;
};

const BAR_HEIGHT = 64;
const CENTER_SIZE = 56;

export function BottomBar({ state, navigation, insets, items, onCenterPress }: Props) {
  return (
    <View style={[styles.bar, { height: BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}>
      <View style={[styles.row, { paddingHorizontal: onCenterPress ? 36 : 72 }]}>
        {state.routes.map((route, index) => {
          const item = items[route.name];
          if (!item) return null;
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={focused ? { selected: true } : {}}
              onPress={onPress}
              style={[styles.tab, focused && styles.tabActive]}
            >
              <Ionicons
                name={focused ? item.iconActive : item.icon}
                size={22}
                color={focused ? colors.navy : colors.textSecondary}
              />
            </Pressable>
          );
        })}
      </View>

      {onCenterPress ? (
        <View pointerEvents="box-none" style={styles.centerWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Presensi"
            onPress={onCenterPress}
            style={({ pressed }) => [styles.center, pressed && styles.centerPressed]}
          >
            <Ionicons name="finger-print" size={26} color={colors.accent} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tab: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: colors.tile },
  centerWrap: {
    position: 'absolute',
    top: -24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  center: {
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.background,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  centerPressed: { opacity: 0.85 },
});
