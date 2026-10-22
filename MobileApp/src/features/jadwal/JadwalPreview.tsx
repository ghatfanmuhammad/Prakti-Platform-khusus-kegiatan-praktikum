import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JadwalScreen } from './JadwalScreen';
import { DetailSesiScreen } from './DetailSesiScreen';
import { useSessionManager } from '@/features/kelola-sesi';

/**
 * Komponen preview sementara untuk menguji integrasi:
 * - SRS-003: JadwalScreen & DetailSesiScreen
 * - SRS-004: Pengelolaan Sesi (Buka / Tutup Sesi oleh Asisten)
 * 
 * File ini hanya untuk preview sementara sebelum kerangka PM masuk.
 */
export function JadwalPreview() {
  const { sessions, setSessions, bukaSesi, tutupSesi, resetSessions } = useSessionManager();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [role, setRole] = useState<'asisten' | 'praktikan'>('asisten');

  // Ambil sesi terpilih dari state bersama
  const selectedSession = sessions.find((s) => s.id === selectedSessionId) || null;

  // Toggle peran untuk menguji tampilan asisten vs praktikan
  const toggleRole = () => {
    setRole((prev) => (prev === 'asisten' ? 'praktikan' : 'asisten'));
  };

  // Handler untuk mengosongkan / me-reset data jadwal
  const handleToggleEmpty = () => {
    if (sessions.length === 0) {
      resetSessions();
    } else {
      setSessions([]);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Baris kontrol preview sementara */}
      <View style={styles.previewToolbar}>
        <View style={styles.toolbarLeft}>
          <Text style={styles.toolbarTag}>PREVIEW SRS-003 & SRS-004</Text>
        </View>

        <View style={styles.toolbarRight}>
          {/* Tombol switch peran: Asisten vs Praktikan */}
          <Pressable
            onPress={toggleRole}
            style={[styles.roleButton, role === 'asisten' ? styles.roleAsisten : styles.rolePraktikan]}
          >
            <Text style={styles.roleButtonText}>
              Peran: {role === 'asisten' ? '👨‍🏫 Asisten' : '👨‍🎓 Praktikan'}
            </Text>
          </Pressable>

          {/* Tombol uji daftar kosong (hanya ditampilkan saat di layar jadwal) */}
          {!selectedSessionId && (
            <Pressable
              onPress={handleToggleEmpty}
              style={styles.toggleButton}
            >
              <Text style={styles.toggleButtonText}>
                {sessions.length === 0 ? '🔄 Reset Data' : '🗑️ Kosongkan'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Navigasi layar berbasis state */}
      {selectedSessionId ? (
        <DetailSesiScreen
          session={selectedSession}
          onBack={() => setSelectedSessionId(null)}
          // Hanya asisten yang mendapatkan fungsi aksi buka/tutup sesi
          onBukaSesi={role === 'asisten' ? bukaSesi : undefined}
          onTutupSesi={role === 'asisten' ? tutupSesi : undefined}
        />
      ) : (
        <JadwalScreen
          sessions={sessions}
          onPressItem={(id) => setSelectedSessionId(id)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  previewToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    flexWrap: 'wrap',
    gap: 8,
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolbarTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.5,
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleAsisten: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  rolePraktikan: {
    backgroundColor: '#F3E8FF',
    borderColor: '#D8B4FE',
  },
  roleButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  toggleButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#94A3B8',
  },
  toggleButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
});
