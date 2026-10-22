import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JadwalScreen } from './JadwalScreen';
import { DetailSesiScreen } from './DetailSesiScreen';
import { DUMMY_SESSIONS, Session } from './temp-data';

/**
 * Komponen preview sementara untuk menguji integrasi JadwalScreen & DetailSesiScreen.
 * Bukan bagian dari navigasi final (Expo Router / React Navigation).
 */
export function JadwalPreview() {
  const [sessions, setSessions] = useState<Session[]>(DUMMY_SESSIONS);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Cari data sesi yang dipilih
  const selectedSession = sessions.find((s) => s.id === selectedSessionId) || null;

  // Tombol bantuan untuk simulasi mengosongkan daftar (test empty state)
  const toggleEmptyState = () => {
    setSessions((prev) => (prev.length === 0 ? DUMMY_SESSIONS : []));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Baris kontrol preview sementara */}
      <View style={styles.previewToolbar}>
        <Text style={styles.toolbarTag}>PREVIEW SRS-003</Text>
        {!selectedSessionId && (
          <Pressable onPress={toggleEmptyState} style={styles.toggleButton}>
            <Text style={styles.toggleButtonText}>
              {sessions.length === 0 ? '🔄 Isi Data Dummy' : '🗑️ Tes Empty State'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Navigasi sederhana berbasis state */}
      {selectedSessionId ? (
        <DetailSesiScreen
          session={selectedSession}
          onBack={() => setSelectedSessionId(null)}
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  toolbarTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
  },
  toggleButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
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
