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

import { ROLE_LABELS } from '../../features/auth/roles';
import { usePrakti } from '../../context/PraktiContext';
import {
  formatAuthError,
  loginUser,
  registerUser,
  toCurrentUser,
  type UserRole,
} from '../../services/authService';
import { cardShadow, colors, radius, spacing, typography } from '../../theme';

interface Props {
  onBypassDemo?: () => void;
}

export function AuthScreen({ onBypassDemo }: Props) {
  const insets = useSafeAreaInsets();
  const { masuk } = usePrakti();

  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('praktikan');
  const [nimOrCode, setNimOrCode] = useState('');

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
<<<<<<< HEAD
          role === 'praktikan'
            ? 'NIM wajib diisi.'
            : role === 'aslab'
              ? 'Kode Aslab wajib diisi.'
              : 'Kode Asprak wajib diisi.',
=======
          role === 'praktikan' ? 'NIM wajib diisi.' : 'Kode Staf wajib diisi.',
>>>>>>> origin/main
        );
        return;
      }
    }

    setLoading(true);

    try {
      const profile =
        mode === 'login'
          ? await loginUser(email, password)
          : await registerUser(email, password, name, role, nimOrCode);
      masuk(toCurrentUser(profile));
    } catch (err: any) {
      console.warn('Firebase Auth error:', err);
      const pesan = formatAuthError(err?.code ?? '', {
        role: mode === 'register' ? role : undefined,
      });
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
        <View style={styles.header}>
          <Text style={styles.logo}>PRAKTI</Text>
          <Text style={styles.tagline}>Autentikasi Kegiatan Praktikum</Text>
        </View>

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

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.formCard}>
          {mode === 'register' && (
            <>
              <Text style={styles.fieldLabel}>Peran Pengguna:</Text>
              <View style={styles.roleToggleRow}>
<<<<<<< HEAD
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
                  style={[styles.roleBtn, role === 'asprak' && styles.roleBtnActive]}
                  onPress={() => setRole('asprak')}
                >
                  <Ionicons
                    name="school-outline"
                    size={18}
                    color={role === 'asprak' ? colors.surface : colors.navy}
                  />
                  <Text
                    style={[styles.roleBtnText, role === 'asprak' && styles.roleBtnTextActive]}
                  >
                    Asprak
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.roleBtn, role === 'aslab' && styles.roleBtnActive]}
                  onPress={() => setRole('aslab')}
                >
                  <Ionicons
                    name="business-outline"
                    size={18}
                    color={role === 'aslab' ? colors.surface : colors.navy}
                  />
                  <Text
                    style={[styles.roleBtnText, role === 'aslab' && styles.roleBtnTextActive]}
                  >
                    Aslab
                  </Text>
                </Pressable>
=======
                {(['praktikan', 'asprak', 'aslab'] as const).map((value) => (
                  <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: role === value }}
                    style={[styles.roleBtn, role === value && styles.roleBtnActive]} onPress={() => setRole(value)}>
                    <Text style={[styles.roleBtnText, role === value && styles.roleBtnTextActive]}>{ROLE_LABELS[value]}</Text>
                  </Pressable>
                ))}
>>>>>>> origin/main
              </View>

              <Text style={styles.fieldLabel}>Nama Lengkap:</Text>
              <TextInput
                style={styles.input}
                placeholder="cth. Felicia Amanda"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.fieldLabel}>
<<<<<<< HEAD
                {role === 'praktikan'
                  ? 'Nomor Induk Mahasiswa (NIM):'
                  : role === 'aslab'
                    ? 'Kode Aslab:'
                    : 'Kode Asprak:'}
=======
                {role === 'praktikan' ? 'Nomor Induk Mahasiswa (NIM):' : 'Kode Staf:'}
>>>>>>> origin/main
              </Text>
              <TextInput
                style={styles.input}
                placeholder={
                  role === 'praktikan'
                    ? 'cth. 1301213000'
                    : role === 'aslab'
                      ? 'cth. ASL-01'
                      : 'cth. ASP-01'
                }
                placeholderTextColor={colors.textSecondary}
                value={nimOrCode}
                onChangeText={setNimOrCode}
              />
            </>
          )}

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

          <Text style={styles.fieldLabel}>Kata Sandi:</Text>
          <TextInput
            style={styles.input}
            placeholder="Minimal 6 karakter"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

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

        {__DEV__ && onBypassDemo && (
          <Pressable style={styles.bypassBtn} onPress={onBypassDemo}>
            <Text style={styles.bypassText}>Gunakan Data Dummy Demo &rarr;</Text>
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

  roleToggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  roleBtn: {
    flexGrow: 1,
    minWidth: 92,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
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
