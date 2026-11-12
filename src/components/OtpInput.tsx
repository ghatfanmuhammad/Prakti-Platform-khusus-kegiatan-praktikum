import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing } from '../theme';

interface Props {
  value: string;
  onChangeText: (value: string) => void;
  length?: number;
  hasError?: boolean;
  autoFocus?: boolean;
}

/**
 * Input kode gaya OTP: kotak-kotak ditampilkan, sedangkan TextInput transparan
 * menutupi seluruh area sehingga satu ketukan langsung memunculkan papan angka.
 */
export function OtpInput({ value, onChangeText, length = 4, hasError = false, autoFocus = false }: Props) {
  return (
    <View>
      <View style={styles.row} pointerEvents="none">
        {Array.from({ length }, (_, index) => {
          const aktif = index === Math.min(value.length, length - 1);
          return (
            <View
              key={index}
              style={[styles.box, aktif && styles.boxActive, hasError && styles.boxError]}
            >
              <Text style={styles.digit}>{value[index] ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        value={value}
        onChangeText={(teks) => onChangeText(teks.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        accessibilityLabel={`Kode sesi ${length} angka`}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  box: {
    width: 56,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.divider,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.navy },
  boxError: { borderColor: colors.danger },
  digit: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
  input: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 },
});
