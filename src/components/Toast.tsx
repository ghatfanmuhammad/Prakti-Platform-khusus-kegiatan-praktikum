import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '../theme';
import type { IconName } from './icons';

type ToastTone = 'success' | 'error' | 'info';

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
}

interface ToastState {
  message: string;
  tone: ToastTone;
}

const ICONS: Record<ToastTone, IconName> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle-outline',
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DURASI_TAMPIL_MS = 2400;

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, tone });
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(
          ({ finished }) => {
            if (finished) setToast(null);
          },
        );
      }, DURASI_TAMPIL_MS);
    },
    [opacity],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.container, { bottom: insets.bottom + 88, opacity }]}
        >
          <View style={[styles.toast, toast.tone === 'error' && styles.toastError]}>
            <Ionicons name={ICONS[toast.tone]} size={18} color={colors.textOnNavy} />
            <Text style={styles.message}>{toast.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast harus dipakai di dalam ToastProvider');
  return value;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyDeep,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  toastError: { backgroundColor: colors.danger },
  message: { ...typography.bodyBold, color: colors.textOnNavy, flexShrink: 1 },
});
