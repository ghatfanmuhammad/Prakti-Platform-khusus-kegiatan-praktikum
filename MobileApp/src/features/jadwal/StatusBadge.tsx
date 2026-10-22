import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StatusSesi } from '@/data/dummy';

interface StatusBadgeProps {
  status: StatusSesi;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  // Menentukan warna dan label berdasarkan status sesi
  const getBadgeConfig = () => {
    switch (status) {
      case 'dibuka':
        return {
          label: 'Dibuka',
          containerStyle: styles.badgeDibuka,
          textStyle: styles.textDibuka,
          dotStyle: styles.dotDibuka,
        };
      case 'ditutup':
        return {
          label: 'Ditutup',
          containerStyle: styles.badgeDitutup,
          textStyle: styles.textDitutup,
          dotStyle: styles.dotDitutup,
        };
      case 'belum_dibuka':
      default:
        return {
          label: 'Belum Dibuka',
          containerStyle: styles.badgeBelumDibuka,
          textStyle: styles.textBelumDibuka,
          dotStyle: styles.dotBelumDibuka,
        };
    }
  };

  const { label, containerStyle, textStyle, dotStyle } = getBadgeConfig();

  return (
    <View style={[styles.badge, containerStyle]}>
      <View style={[styles.dot, dotStyle]} />
      <Text style={[styles.label, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Status: Belum Dibuka (Abu-abu)
  badgeBelumDibuka: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  dotBelumDibuka: {
    backgroundColor: '#64748B',
  },
  textBelumDibuka: {
    color: '#475569',
  },
  // Status: Dibuka (Hijau)
  badgeDibuka: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  dotDibuka: {
    backgroundColor: '#16A34A',
  },
  textDibuka: {
    color: '#15803D',
  },
  // Status: Ditutup (Merah)
  badgeDitutup: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  dotDitutup: {
    backgroundColor: '#DC2626',
  },
  textDitutup: {
    color: '#B91C1C',
  },
});
