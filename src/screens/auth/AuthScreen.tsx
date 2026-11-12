import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePrakti } from '../../context/PraktiContext';
import {
  formatAuthError,
  loginUser,
  registerUser,
  type UserRole,
} from '../../services/authService';
import { cardShadow, colors, radius, spacing, typography } from '../../theme';

interface Props {
  onBypassDemo?: () => void;
}

export function AuthScreen({ onBypassDemo }: Props) {
  const insets = useSafeAreaInsets();
  const { masuk } = usePrakti();

  // Mode: 'login' | 'register'
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Input states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('praktikan');
  const [nimOrCode, setNimOrCode] = useState('');

  // UI status
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Email dan kata sandi wajib diisi.');
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setErrorMessage('Nama lengkap wajib diisi.');
        return;
      }
      if (!nimOrCode.trim()) {
        setErrorMessage(
          role === 'praktikan' ? 'NIM wajib diisi.' : 'Kode Asisten wajib diisi.',
        );
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const profile = await loginUser(email, password);
        // Simpan ke state global aplikasi sesuai tipe CurrentUser
        if (profile.role === 'asisten') {
          masuk({
            role: 'asisten',
            asisten: {
              id: profile.uid,
              nama: profile.name,
            },
          });
        } else {
          masuk({
            role: 'praktikan',
            praktikan: {
              id: profile.uid,
              nama: profile.name,
              nim: profile.nimOrCode,
            },
          });
        }
      } else {
        const profile = await registerUser(email, password, name, role, nimOrCode);
        if (profile.role === 'asisten') {
          masuk({
            role: 'asisten',
            asisten: {
              id: profile.uid,
              nama: profile.name,
            },
          });
        } else {
          masuk({
            role: 'praktikan',
            praktikan: {
              id: profile.uid,
              nama: profile.name,
              nim: profile.nimOrCode,
            },
          });
        }
      }
    } catch (err: any) {
      console.warn('Firebase Auth error:', err);
      const pesan = formatAuthError(err?.code || err?.message || '');
      setErrorMessage(pesan);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl }]}>
        {/* Header Logo */}
        <View style={styles.header}>
          <Text style={styles.logo}>PRAKTI</Text>
          <Text style={styles.tagline}>Autentikasi Kegiatan Praktikum</Text>
        </View>

        {/* Tab Toggle Login / Register */}
        <View style={styles.tabContainer}>
          <Pressable
            style={[styles.tabBtn, mode === 'login' && styles.tabBtnActive]}
            onPress={() => {
              setMode('login');
              setErrorMessage(null);
            }}
          >
            <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>
              Masuk
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, mode === 'register' && styles.tabBtnActive]}
            onPress={() => {
              setMode('register');
              setErrorMessage(null);
            }}
          >
            <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>
              Daftar Akun
            </Text>
          </Pressable>
        </View>

        {/* Error Banner */}
        {errorMessage ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Form Card */}
        <View style={styles.formCard}>
          {mode === 'register' && (
            <>
              {/* Pilihan Peran */}
              <Text style={styles.fieldLabel}>Peran Pengguna:</Text>
              <View style={styles.roleToggleRow}>
                <Pressable
                  style={[styles.roleBtn, role === 'praktikan' && styles.roleBtnActive]}
                  onPress={() => setRole('praktikan')}
                >
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={role === 'praktikan' ? colors.surface : colors.navy}
                  />
                  <Text
                    style={[
                      styles.roleBtnText,
                      role === 'praktikan' && styles.roleBtnTextActive,
                    ]}
                  >
                    Praktikan
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.roleBtn, role === 'asisten' && styles.roleBtnActive]}
                  onPress={() => setRole('asisten')}
                >
                  <Ionicons
                    name="school-outline"
                    size={18}
                    color={role === 'asisten' ? colors.surface : colors.navy}
                  />
                  <Text
                    style={[styles.roleBtnText, role === 'asisten' && styles.roleBtnTextActive]}
                  >
                    Asisten
                  </Text>
                </Pressable>
              </View>

              {/* Input Nama */}
              <Text style={styles.fieldLabel}>Nama Lengkap:</Text>
              <TextInput
                style={styles.input}
                placeholder="cth. Ghatfan Muhammad"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
              />

              {/* Input NIM / Kode */}
              <Text style={styles.fieldLabel}>
                {role === 'praktikan' ? 'Nomor Induk Mahasiswa (NIM):' : 'Kode Asisten:'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={role === 'praktikan' ? 'cth. 1301213000' : 'cth. AST-01'}
                placeholderTextColor={colors.textSecondary}
                value={nimOrCode}
                onChangeText={setNimOrCode}
              />
            </>
          )}

          {/* Input Email */}
          <Text style={styles.fieldLabel}>Email:</Text>
          <TextInput
            style={styles.input}
            placeholder="cth. user@university.ac.id"
            placeholderTextColor={colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          {/* Input Password */}
          <Text style={styles.fieldLabel}>Kata Sandi:</Text>
          <TextInput
            style={styles.input}
            placeholder="Minimal 6 karakter"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {/* Tombol Submit */}
          <Pressable
            disabled={loading}
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
          >
            {loading ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.submitBtnText}>
                {mode === 'login' ? 'Masuk ke Aplikasi' : 'Daftarkan Akun'}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Opsi Beralih ke Mode Demo (Fallback Sprint 1) */}
        {onBypassDemo && (
          <Pressable style={styles.bypassBtn} onPress={onBypassDemo}>
            <Text style={styles.bypassText}>Gunakan Data Dummy Demo (Sprint 1) &rarr;</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },

  header: { alignItems: 'center', marginBottom: spacing.xl },
  logo: { ...typography.display, color: colors.navy, letterSpacing: 2 },
  tagline: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },

  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.tile,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.md,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabBtnActive: { backgroundColor: colors.surface, ...cardShadow },
  tabText: { ...typography.button, color: colors.textSecondary },
  tabTextActive: { color: colors.navy, fontWeight: '700' },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  errorText: { ...typography.caption, color: colors.danger, flex: 1 },

  formCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    ...cardShadow,
  },
  fieldLabel: { ...typography.caption, color: colors.textPrimary, fontWeight: '600', marginBottom: 6, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    ...typography.body,
    color: colors.textPrimary,
  },

  roleToggleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  roleBtnActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  roleBtnText: { ...typography.button, color: colors.navy, fontSize: 13 },
  roleBtnTextActive: { color: colors.surface },

  submitBtn: {
    backgroundColor: colors.navy,
    paddingVertical: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { ...typography.button, color: colors.surface, fontSize: 15 },

  bypassBtn: { marginTop: spacing.xl, alignItems: 'center' },
  bypassText: { ...typography.caption, color: colors.textSecondary, textDecorationLine: 'underline' },
});
