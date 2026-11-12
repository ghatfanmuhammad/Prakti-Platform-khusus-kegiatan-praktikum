import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { BottomSheet } from '../../components/BottomSheet';
import { EmptyState } from '../../components/EmptyState';
import { usePrakti } from '../../context/PraktiContext';
import { colors, radius, spacing, typography } from '../../theme';
import type { Role } from '../../types';
import { toTitleCase } from '../../utils/text';

interface Props {
  role: Role | null;
  onClose: () => void;
}

/** Memilih akun dummy sesuai peran, menggantikan login karena belum ada backend. */
export function IdentityPickerSheet({ role, onClose }: Props) {
  const { asistenList, praktikanList, masuk } = usePrakti();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (role === null) setQuery('');
  }, [role]);

  const praktikanTersaring = useMemo(() => {
    const q = query.trim().toLowerCase();
    return praktikanList.filter((p) => p.nama.toLowerCase().includes(q) || p.nim.includes(q));
  }, [praktikanList, query]);

  const judul = role === 'asisten' ? 'Pilih akun asisten' : 'Pilih akun praktikan';

  return (
    <BottomSheet visible={role !== null} title={judul} onClose={onClose}>
      {role === 'praktikan' ? (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Cari nama atau NIM"
          placeholderTextColor={colors.textSecondary}
          style={styles.search}
        />
      ) : null}
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {role === 'asisten' &&
          asistenList.map((a) => (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              onPress={() => masuk({ role: 'asisten', asisten: a })}
              style={styles.item}
            >
              <Text style={styles.name}>{a.nama}</Text>
              <Text style={styles.meta}>Asisten praktikum</Text>
            </Pressable>
          ))}
        {role === 'praktikan' &&
          praktikanTersaring.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              onPress={() => masuk({ role: 'praktikan', praktikan: p })}
              style={styles.item}
            >
              <Text style={styles.name}>{toTitleCase(p.nama)}</Text>
              <Text style={styles.meta}>{p.nim}</Text>
            </Pressable>
          ))}
        {role === 'praktikan' && praktikanTersaring.length === 0 ? (
          <EmptyState icon="search-outline" title="Tidak ditemukan" description="Coba kata kunci lain." />
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  search: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  list: { maxHeight: 360 },
  item: {
    minHeight: 56,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: { ...typography.bodyBold, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary },
});
