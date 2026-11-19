import { createNavigationContainerRef } from '@react-navigation/native';

import type { AppStackParamList } from './types';

/** Dipakai untuk berpindah layar dari luar komponen layar, mis. saat notifikasi diketuk. */
export const navigationRef = createNavigationContainerRef<AppStackParamList>();
