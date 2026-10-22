import React from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Session } from './temp-data';
import { StatusBadge } from './StatusBadge';

interface JadwalScreenProps {
  sessions: Session[];
  onPressItem: (id: string) => void;
}

export function JadwalScreen({ sessions, onPressItem }: JadwalScreenProps) {
  // Render item per sesi praktikum
  const renderItem = ({ item }: { item: Session }) => {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
        ]}
        onPress={() => onPressItem(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`Sesi ${item.namaPraktikum}, kelas ${item.kelas}`}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.namaPraktikum} numberOfLines={2}>
            {item.namaPraktikum}
          </Text>
          <StatusBadge status={item.status} />
        </View>

        <View style={styles.metaContainer}>
          <View style={styles.kelasBadge}>
            <Text style={styles.kelasText}>{item.kelas}</Text>
          </View>
          <Text style={styles.waktuText}>🕒 {item.waktu}</Text>
        </View>
      </Pressable>
    );
  };

  // Tampilan ketika daftar jadwal kosong (Empty State)
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📅</Text>
      <Text style={styles.emptyTitle}>Belum Ada Jadwal Praktikum</Text>
      <Text style={styles.emptySubtitle}>
        Daftar sesi praktikum akan muncul di sini saat jadwal sudah tersedia.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Jadwal Praktikum</Text>
        <Text style={styles.headerSubtitle}>
          Pilih salah satu sesi untuk melihat detail informasi pelaksanaan.
        </Text>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={[
          styles.listContent,
          sessions.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    // Shadow halus untuk iOS & Android
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPressed: {
    backgroundColor: '#F8FAFC',
    transform: [{ scale: 0.99 }],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  namaPraktikum: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 22,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  kelasBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  kelasText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4338CA',
  },
  waktuText: {
    fontSize: 13,
    color: '#475569',
  },
  // Empty State Styles
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});
