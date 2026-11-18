import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { IzinStatusBadge } from '../../components/IzinStatusBadge';
import { useToast } from '../../components/Toast';
import { useCurrentPraktikan, usePrakti } from '../../context/PraktiContext';
import { PracticumLoading } from '../../features/data-praktikum/PracticumLoading';
import { daftarPilihanSesiIzin, namaSesiIzin } from '../../features/izin/aturanIzin';
import type { AppStackParamList } from '../../navigation/types';
import {
  ALASAN_MAX,
  ajukanIzin,
  formatIzinError,
  subscribeIzinPraktikan,
  validasiAlasan,
  type PengajuanIzin,
} from '../../services/izinService';
import { colors, radius, spacing, typography } from '../../theme';
import { formatTanggal } from '../../utils/date';

type Props = NativeStackScreenProps<AppStackParamList, 'AjukanIzin'>;

/** Klasifikasi AI dibatasi 10 detik, sisanya untuk menyimpan ke Firestore. */
const BATAS_WAKTU_KIRIM = 25_000;

class WaktuHabisError extends Error {}

function denganBatasWaktu<T>(proses: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const habis = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new WaktuHabisError()), ms);
  });
  return Promise.race([proses, habis]).finally(() => clearTimeout(timer));
}

/**
 * [SRS-010] Praktikan memilih sesi dan mengisi alasan izin.
 * Input kosong atau terlalu pendek ditolak; pengajuan tersimpan di Firestore dengan status Menunggu.
 */
export function AjukanIzinScreen({ navigation }: Props) {
  const praktikan = useCurrentPraktikan();
  const { sesi, presensi, practicum, retryPracticum } = usePrakti();
  const toast = useToast();

  const [izinSaya, setIzinSaya] = useState<PengajuanIzin[]>([]);
  const [izinLoading, setIzinLoading] = useState(true);
  const [izinError, setIzinError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [percobaan, setPercobaan] = useState(0);

  const [sesiId, setSesiId] = useState<string | null>(null);
  const [alasan, setAlasan] = useState('');
  const [sudahDikirim, setSudahDikirim] = useState(false);
  const [mengirim, setMengirim] = useState(false);
  const [errorKirim, setErrorKirim] = useState<string | null>(null);
  // Mencegah pengajuan ganda bila tombol ditekan dua kali sebelum render ulang.
  const prosesKirim = useRef(false);

  const praktikanId = praktikan?.id;

  // Izin milik praktikan didengarkan real-time untuk mencegah pengajuan ganda per sesi.
  useEffect(() => {
    if (!praktikanId) return;
    setIzinLoading(true);
    setIzinError(null);
    return subscribeIzinPraktikan(
      praktikanId,
      (hasil) => {
        setIzinSaya(hasil.daftar);
        setOffline(hasil.dariCache);
        setIzinError(null);
        setIzinLoading(false);
      },
      (err) => {
        setIzinError(formatIzinError(err));
        setIzinLoading(false);
      },
    );
  }, [praktikanId, percobaan]);

  const pilihan = useMemo(
    () => (praktikanId ? daftarPilihanSesiIzin(sesi, presensi, izinSaya, praktikanId) : []),
    [sesi, presensi, izinSaya, praktikanId],
  );

  if (!praktikan) return null;

  const errorMuat = (practicum ? practicum.error ?? practicum.attendance.error : null) ?? izinError;
  const sedangMuat = !errorMuat && (
    izinLoading || (practicum ? practicum.loading || practicum.attendance.loading : false)
  );
  const muatUlang = () => {
    retryPracticum();
    setPercobaan((n) => n + 1);
  };

  const terpilih = pilihan.find((p) => p.sesi.id === sesiId);
  // Sesi yang dipilih bisa jadi tidak tersedia secara real-time (mis. presensi tercatat dari perangkat lain).
  const sesiValid = terpilih && !terpilih.izinAktif ? terpilih.sesi : undefined;
  const errorSesi = sesiValid
    ? null
    : sesiId
      ? 'Sesi ini sudah tidak bisa diajukan izin. Pilih sesi lain.'
      : 'Pilih sesi yang ingin diajukan izinnya.';
  const errorAlasan = validasiAlasan(alasan);
  const panjang = alasan.trim().length;

  const kirim = async () => {
    setSudahDikirim(true);
    if (errorSesi || errorAlasan || !sesiValid || offline || prosesKirim.current) return;

    prosesKirim.current = true;
    setMengirim(true);
    setErrorKirim(null);
    try {
      await denganBatasWaktu(
        ajukanIzin({
          praktikanId: praktikan.id,
          praktikanNama: praktikan.nama,
          praktikanNim: praktikan.nim,
          sesiId: sesiValid.id,
          sesiNama: namaSesiIzin(sesiValid),
          alasan,
        }),
        BATAS_WAKTU_KIRIM,
      );
      toast.show('Pengajuan izin terkirim. Status: Menunggu.', 'success');
      navigation.popTo('StatusIzin');
    } catch (err) {
      prosesKirim.current = false;
      setErrorKirim(
        err instanceof WaktuHabisError
          ? 'Koneksi lambat atau terputus. Pengajuan akan dikirim otomatis saat koneksi kembali selama aplikasi tetap terbuka. Periksa halaman Status Izin sebelum mengajukan lagi.'
          : formatIzinError(err),
      );
    } finally {
      setMengirim(false);
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader subtitle="Ajukan Izin" onBack={navigation.goBack} />

      {sedangMuat || errorMuat ? (
        <PracticumLoading error={errorMuat} onRetry={muatUlang} />
      ) : pilihan.length === 0 ? (
        <EmptyState
          icon="calendar-clear-outline"
          title="Tidak ada sesi untuk diajukan izin"
          description="Izin bisa diajukan untuk sesi kelasmu yang belum kamu hadiri, termasuk sesi yang sudah lewat."
        />
      ) : (
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {offline ? (
              <View style={styles.offlineBanner} accessibilityLiveRegion="polite">
                <Ionicons name="cloud-offline-outline" size={16} color={colors.danger} />
                <Text style={styles.offlineText}>
                  Sedang offline. Sambungkan internet untuk mengirim pengajuan.
                </Text>
              </View>
            ) : null}

            <Card>
              <Text style={styles.label}>Pilih sesi</Text>
              <View style={styles.options} accessibilityRole="radiogroup">
                {pilihan.map(({ sesi: s, izinAktif }) => {
                  const dipilih = s.id === sesiId;
                  const nonaktif = Boolean(izinAktif) || mengirim;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSesiId(s.id)}
                      disabled={nonaktif}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: dipilih, disabled: nonaktif }}
                      style={[
                        styles.option,
                        dipilih && styles.optionSelected,
                        izinAktif && styles.optionDisabled,
                      ]}
                    >
                      <Ionicons
                        name={dipilih ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={izinAktif ? colors.disabledText : colors.navy}
                      />
                      <View style={styles.optionText}>
                        <Text style={styles.optionTitle}>
                          {s.praktikum} · Kelas {s.kelas}
                        </Text>
                        <Text style={styles.optionMeta}>
                          {formatTanggal(s.tanggal)}, {s.mulai} - {s.selesai}
                          {s.status === 'ditutup' ? ' · Sesi sudah lewat' : ''}
                        </Text>
                        {izinAktif ? (
                          <View style={styles.optionNote}>
                            <Text style={styles.optionMeta}>Izin sudah diajukan</Text>
                            <IzinStatusBadge status={izinAktif.status} />
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              {sudahDikirim && errorSesi ? <Text style={styles.error}>{errorSesi}</Text> : null}
            </Card>

            <Card>
              <Text style={styles.label} nativeID="label-alasan">Alasan izin</Text>
              <TextInput
                style={[styles.input, sudahDikirim && errorAlasan ? styles.inputError : null]}
                accessibilityLabelledBy="label-alasan"
                placeholder="cth. Sakit demam dan sudah ada surat keterangan dokter."
                placeholderTextColor={colors.textSecondary}
                value={alasan}
                onChangeText={setAlasan}
                editable={!mengirim}
                multiline
                maxLength={ALASAN_MAX}
                textAlignVertical="top"
              />
              <View style={styles.inputFooter}>
                <Text style={[styles.error, styles.flex]}>
                  {sudahDikirim && errorAlasan ? errorAlasan : ''}
                </Text>
                <Text style={styles.counter}>
                  {panjang}/{ALASAN_MAX}
                </Text>
              </View>
            </Card>

            {errorKirim ? (
              <View style={styles.errorBox} accessibilityLiveRegion="polite">
                <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                <Text style={[styles.errorBoxText, styles.flex]}>{errorKirim}</Text>
              </View>
            ) : null}

            {mengirim ? (
              <View style={styles.sending}>
                <ActivityIndicator color={colors.navy} />
                <Text style={styles.optionMeta}>Mengirim pengajuan…</Text>
              </View>
            ) : (
              <Button
                label="Kirim Pengajuan"
                icon="send-outline"
                onPress={() => void kirim()}
                disabled={offline}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  flex: { flex: 1 },
  label: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.sm },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.navy, backgroundColor: colors.neutralBg },
  optionDisabled: { backgroundColor: colors.background },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { ...typography.bodyBold, color: colors.textPrimary },
  optionMeta: { ...typography.caption, color: colors.textSecondary },
  optionNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  input: {
    minHeight: 110,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    ...typography.body,
    color: colors.textPrimary,
  },
  inputError: { borderColor: colors.danger },
  inputFooter: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xs },
  counter: { ...typography.caption, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerBg,
  },
  errorBoxText: { ...typography.body, color: colors.danger },
  sending: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.md },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
  },
  offlineText: { ...typography.caption, color: colors.danger, flex: 1 },
});
