import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

import { KonfirmasiPresensiModal } from './konfirmasi-presensi-modal';
import type { CatatanPresensi, KondisiPresensi, StatusSesi } from './types';
import { formatWaktuHadir, tentukanKondisiPresensi } from './utils';

type Props = {
  namaPraktikum: string;
  statusSesi: StatusSesi;
  /** Catatan presensi praktikan ini pada sesi ini; null/undefined jika belum presensi. */
  catatan?: CatatanPresensi | null;
  /** Dipanggil saat praktikan mengonfirmasi presensi, dengan waktu ISO saat itu. */
  onPresensi: (waktuHadir: string) => void;
};

const KETERANGAN_NONAKTIF: Partial<Record<KondisiPresensi, string>> = {
  sesi_belum_dibuka: 'Sesi belum dibuka oleh asisten. Presensi dapat dilakukan setelah sesi dibuka.',
  sesi_ditutup: 'Sesi sudah ditutup. Presensi tidak dapat dilakukan lagi.',
};

const DURASI_PESAN_BERHASIL = 3000;

/** Bagian presensi praktikan pada halaman detail sesi (SRS-005). */
export function PresensiPanel({ namaPraktikum, statusSesi, catatan, onPresensi }: Props) {
  const [modalTampil, setModalTampil] = useState(false);
  const [pesanBerhasil, setPesanBerhasil] = useState(false);
  // Mencegah presensi ganda jika tombol konfirmasi ditekan dua kali sebelum render ulang.
  const sudahDikirim = useRef(false);

  const kondisi = tentukanKondisiPresensi(statusSesi, catatan);

  useEffect(() => {
    if (!pesanBerhasil) return;
    const timer = setTimeout(() => setPesanBerhasil(false), DURASI_PESAN_BERHASIL);
    return () => clearTimeout(timer);
  }, [pesanBerhasil]);

  const handleKonfirmasi = () => {
    setModalTampil(false);
    // Jaga-jaga: jangan catat jika kondisi sudah berubah (mis. sesi baru ditutup).
    if (kondisi !== 'bisa_presensi' || sudahDikirim.current) return;
    sudahDikirim.current = true;
    onPresensi(new Date().toISOString());
    setPesanBerhasil(true);
  };

  return (
    <View style={styles.wadah}>
      {pesanBerhasil && (
        <View style={styles.banner} accessibilityLiveRegion="polite">
          <ThemedText type="smallBold" style={styles.teksHijau}>
            ✓ Presensi berhasil dicatat
          </ThemedText>
        </View>
      )}

      {kondisi === 'sudah_presensi' && catatan ? (
        <View style={styles.kartuSukses}>
          <ThemedText type="smallBold" style={styles.teksHijau}>
            Presensi sudah tercatat
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatWaktuHadir(catatan.waktuHadir)}
          </ThemedText>
        </View>
      ) : (
        <ThemedView type="backgroundElement" style={styles.kartu}>
          <Pressable
            disabled={kondisi !== 'bisa_presensi'}
            onPress={() => setModalTampil(true)}
            accessibilityRole="button"
            accessibilityState={{ disabled: kondisi !== 'bisa_presensi' }}
            style={({ pressed }) => [
              styles.tombol,
              kondisi !== 'bisa_presensi' && styles.tombolNonaktif,
              pressed && styles.ditekan,
            ]}>
            <ThemedText type="smallBold" style={styles.teksPutih}>
              Presensi Sekarang
            </ThemedText>
          </Pressable>

          {kondisi !== 'bisa_presensi' && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.keterangan}>
              {KETERANGAN_NONAKTIF[kondisi]}
            </ThemedText>
          )}
        </ThemedView>
      )}

      <KonfirmasiPresensiModal
        visible={modalTampil}
        namaPraktikum={namaPraktikum}
        onKonfirmasi={handleKonfirmasi}
        onBatal={() => setModalTampil(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wadah: {
    width: '100%',
    gap: Spacing.two,
  },
  kartu: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  tombol: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    backgroundColor: '#3c87f7',
  },
  tombolNonaktif: {
    backgroundColor: '#9aa0a6',
  },
  ditekan: {
    opacity: 0.7,
  },
  teksPutih: {
    color: '#ffffff',
  },
  keterangan: {
    textAlign: 'center',
  },
  kartuSukses: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: '#1f9d55',
    backgroundColor: 'rgba(31,157,85,0.12)',
  },
  banner: {
    borderRadius: 12,
    padding: Spacing.two + Spacing.one,
    backgroundColor: 'rgba(31,157,85,0.18)',
  },
  teksHijau: {
    color: '#1f9d55',
  },
});
