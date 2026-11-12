// SRS-001: Pemilihan Peran & Identitas
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '@/constants/palette';
import { useApp } from '@/context/app-context';
import { ASISTEN, PRAKTIKAN, type Peran } from '@/data/dummy';

const OPSI_PERAN: { peran: Peran; judul: string; deskripsi: string }[] = [
  { peran: 'asisten', judul: 'Asisten', deskripsi: 'Buka sesi dan pantau kehadiran' },
  { peran: 'praktikan', judul: 'Praktikan', deskripsi: 'Presensi dan lihat riwayat' },
];

export default function PilihPeranScreen() {
  const { masuk } = useApp();
  const insets = useSafeAreaInsets();
  const [peran, setPeran] = useState<Peran | null>(null);
  const [idDipilih, setIdDipilih] = useState<string | null>(null);

  const daftarIdentitas = peran === 'asisten' ? ASISTEN : peran === 'praktikan' ? PRAKTIKAN : [];
  const siap = peran !== null && idDipilih !== null;

  function pilihPeran(baru: Peran) {
    if (baru === peran) return;
    setPeran(baru);
    setIdDipilih(null);
  }

  function lanjut() {
    if (peran && idDipilih) masuk(peran, idDipilih);
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 32 }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <Text style={styles.brand}>Prakti</Text>
          <Text style={styles.tagline}>Platform khusus kegiatan praktikum</Text>

          <Text style={styles.sectionTitle}>Masuk sebagai</Text>
          <View style={styles.roleRow} accessibilityRole="radiogroup">
            {OPSI_PERAN.map((opsi) => {
              const aktif = peran === opsi.peran;
              return (
                <Pressable
                  key={opsi.peran}
                  onPress={() => pilihPeran(opsi.peran)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: aktif }}
                  style={[styles.roleCard, aktif && styles.roleCardActive]}>
                  <Text style={[styles.roleTitle, aktif && styles.roleTitleActive]}>{opsi.judul}</Text>
                  <Text style={[styles.roleDesc, aktif && styles.roleDescActive]}>{opsi.deskripsi}</Text>
                </Pressable>
              );
            })}
          </View>

          {peran ? (
            <>
              <Text style={styles.sectionTitle}>
                {peran === 'asisten' ? 'Pilih asisten' : 'Pilih praktikan'}
              </Text>
              <View style={styles.identityList} accessibilityRole="radiogroup">
                {daftarIdentitas.map((item) => {
                  const aktif = idDipilih === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setIdDipilih(item.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: aktif }}
                      style={[styles.identityRow, aktif && styles.identityRowActive]}>
                      <View style={[styles.radio, aktif && styles.radioActive]}>
                        {aktif ? <View style={styles.radioDot} /> : null}
                      </View>
                      <View style={styles.identityText}>
                        <Text style={styles.identityName}>{item.nama}</Text>
                        <Text style={styles.identityCode}>
                          {peran === 'asisten' ? 'Kode asisten' : 'NIM'} {item.kode}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.column}>
          {!siap ? (
            <Text style={styles.hint}>
              {peran ? 'Pilih identitasmu untuk melanjutkan' : 'Pilih peran untuk memulai'}
            </Text>
          ) : null}
          <Pressable
            onPress={lanjut}
            disabled={!siap}
            accessibilityRole="button"
            accessibilityState={{ disabled: !siap }}
            style={({ pressed }) => [
              styles.button,
              !siap && styles.buttonDisabled,
              pressed && siap && styles.buttonPressed,
            ]}>
            <Text style={styles.buttonLabel}>Lanjut</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.mist },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  brand: { fontSize: 40, fontWeight: '800', color: palette.teal, letterSpacing: -1 },
  tagline: { fontSize: 16, color: palette.muted, marginTop: 2, marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: palette.ink, marginBottom: 12 },
  roleRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  roleCard: {
    flex: 1,
    padding: 16,
    gap: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.white,
  },
  roleCardActive: { borderColor: palette.teal, backgroundColor: palette.teal },
  roleTitle: { fontSize: 18, fontWeight: '700', color: palette.ink },
  roleTitleActive: { color: palette.white },
  roleDesc: { fontSize: 14, color: palette.muted },
  roleDescActive: { color: '#D6F0EC' },
  identityList: { gap: 10 },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.white,
  },
  identityRowActive: { borderColor: palette.teal, backgroundColor: palette.tealSoft },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: palette.disabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: palette.teal },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.teal },
  identityText: { flex: 1, gap: 2 },
  identityName: { fontSize: 16, fontWeight: '600', color: palette.ink },
  identityCode: { fontSize: 14, color: palette.muted },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: palette.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
  },
  hint: { fontSize: 14, color: palette.muted, textAlign: 'center', marginBottom: 10 },
  button: { alignItems: 'center', paddingVertical: 15, borderRadius: 12, backgroundColor: palette.teal },
  buttonDisabled: { backgroundColor: palette.disabled },
  buttonPressed: { opacity: 0.85 },
  buttonLabel: { fontSize: 17, fontWeight: '700', color: palette.white },
});
