import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBadge } from '@/features/jadwal/StatusBadge';
import { errorMessage } from './errors';
import { useClassRecords, useDataIdentity, usePracticumClasses } from './hooks';
import {
  DAYS,
  type FormValues,
  type Identity,
  type Kind,
  type Participant,
  type PracticumClass,
  type PracticumRecord,
  type PracticumSession,
  type Schedule,
} from './models';
import { changeSessionStatus, deleteRecord, saveRecord } from './repository';

const LABELS: Record<Kind, string> = {
  kelas: 'Kelas',
  peserta: 'Peserta',
  jadwal: 'Jadwal',
  sesi: 'Sesi',
};
type Editor = {
  kind: Kind;
  record: PracticumRecord | null;
  classId: string | null;
};
type Confirmation = {
  title: string;
  message: string;
  run: () => Promise<unknown>;
};

function Button({
  children,
  onPress,
  disabled = false,
  danger = false,
  secondary = false,
}: {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        danger && styles.danger,
        (disabled || pressed) && styles.dim,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{children}</Text>
    </Pressable>
  );
}
function Notice({
  title,
  message,
  loading,
  onRetry,
}: {
  title: string;
  message?: string;
  loading?: boolean;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.notice}>
      {loading && (
        <ActivityIndicator size="large" color="#2563EB" accessibilityLabel="Memuat data" />
      )}
      <Text style={styles.heading}>{title}</Text>
      {message && <Text style={styles.muted}>{message}</Text>}
      {onRetry && <Button onPress={onRetry}>Coba lagi</Button>}
    </View>
  );
}

export function DataPraktikumScreen({ initialKind }: { initialKind?: 'kelas' | 'jadwal' }) {
  const [retry, setRetry] = useState(0);
  const state = useDataIdentity(retry);
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {state.phase === 'loading' ? (
        <Notice title="Memuat akun…" loading />
      ) : state.phase === 'error' ? (
        <Notice
          title="Data belum dapat ditampilkan"
          message={state.error}
          onRetry={() => setRetry((value) => value + 1)}
        />
      ) : state.phase === 'signed-out' ? (
        <Notice
          title="Masuk untuk melihat data praktikum"
          message="Gunakan akun praktikan atau asisten Anda agar jadwal dan kelas yang sesuai dapat ditampilkan."
          onRetry={() => setRetry((value) => value + 1)}
        />
      ) : (
        <PracticumWorkspace
          key={`${state.identity.uid}:${state.identity.role}`}
          identity={state.identity}
          initialKind={initialKind}
        />
      )}
    </SafeAreaView>
  );
}
function PracticumWorkspace({
  identity,
  initialKind,
}: {
  identity: Identity;
  initialKind?: 'kelas' | 'jadwal';
}) {
  const [retry, setRetry] = useState(0);
  const classes = usePracticumClasses(identity, retry);
  const [chosenClassId, setChosenClassId] = useState<string | null>(null);
  const activeClass =
    classes.data.find((item) => item.id === chosenClassId) ?? classes.data[0] ?? null;
  const classId = activeClass?.id ?? null;
  const records = useClassRecords(identity, classId, retry);
  const assistant = identity.role === 'asisten';
  const [kind, setKind] = useState<Kind>(assistant ? (initialKind ?? 'kelas') : 'jadwal');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const source =
    kind === 'kelas'
      ? classes
      : kind === 'peserta'
        ? records.participants
        : kind === 'jadwal'
          ? records.schedules
          : records.sessions;
  const items = useMemo(
    () =>
      [...source.data].sort((a, b) => {
        if (kind === 'sesi')
          return (a as PracticumSession).tanggal.localeCompare((b as PracticumSession).tanggal);
        const label = (value: PracticumRecord) =>
          'kode' in value
            ? value.kode
            : 'nama' in value
              ? value.nama
              : 'hari' in value
                ? `${DAYS.indexOf(value.hari)}${value.mulai}`
                : value.id;
        return label(a).localeCompare(label(b), 'id');
      }),
    [source.data, kind],
  );
  const retryData = () => setRetry((value) => value + 1);
  const run = async (operation: () => Promise<unknown>, message: string) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMutationError(null);
    setSuccess(null);
    try {
      await operation();
      setEditor(null);
      setConfirmation(null);
      setSuccess(message);
    } catch (error) {
      setMutationError(errorMessage(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  function openEditor(targetKind: Kind, record: PracticumRecord | null) {
    setMutationError(null);
    setSuccess(null);
    setEditor({ kind: targetKind, record, classId });
  }
  function confirmDelete(record: PracticumRecord) {
    setMutationError(null);
    setSuccess(null);
    setConfirmation({
      title: `Hapus ${LABELS[kind].toLowerCase()}?`,
      message:
        kind === 'kelas'
          ? 'Kelas hanya dapat dihapus setelah seluruh peserta, sesi, dan jadwalnya dihapus.'
          : kind === 'sesi'
            ? 'Sesi akan dihapus permanen. Hanya sesi yang belum dibuka yang dapat dihapus.'
            : 'Data akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.',
      run: async () => {
        await deleteRecord(kind, classId, record.id);
      },
    });
  }
  function confirmStatus(session: PracticumSession) {
    const next = session.status === 'belum_dibuka' ? 'dibuka' : 'ditutup';
    const capturedClassId = classId!;
    setMutationError(null);
    setSuccess(null);
    setConfirmation({
      title: next === 'dibuka' ? 'Buka sesi?' : 'Tutup sesi?',
      message:
        next === 'dibuka'
          ? 'Praktikan dapat melakukan presensi setelah sesi dibuka.'
          : 'Sesi yang ditutup tidak dapat dibuka kembali.',
      run: () => changeSessionStatus(capturedClassId, session.id, next),
    });
  }
  function renderRecord({ item }: { item: PracticumRecord }) {
    const schedule =
      kind === 'sesi'
        ? records.schedules.data.find((value) => value.id === (item as PracticumSession).scheduleId)
        : null;
    return (
      <View style={styles.card}>
        {kind === 'kelas' ? (
          <>
            <Text style={styles.cardTitle}>{(item as PracticumClass).kode}</Text>
            <Text style={styles.body}>{(item as PracticumClass).namaPraktikum}</Text>
            <Text style={styles.muted}>
              {(item as PracticumClass).participantCount} peserta ·{' '}
              {(item as PracticumClass).scheduleCount} jadwal ·{' '}
              {(item as PracticumClass).sessionCount} sesi
            </Text>
          </>
        ) : kind === 'peserta' ? (
          <>
            <Text style={styles.cardTitle}>{(item as Participant).nama}</Text>
            <Text style={styles.body}>NIM: {(item as Participant).nim}</Text>
            <Text selectable style={styles.muted}>
              UID: {(item as Participant).uid}
            </Text>
          </>
        ) : kind === 'jadwal' ? (
          <>
            <Text style={styles.cardTitle}>
              {(item as Schedule).hari}, {(item as Schedule).mulai}–{(item as Schedule).selesai} WIB
            </Text>
            <Text style={styles.body}>{(item as Schedule).ruangan}</Text>
          </>
        ) : (
          <>
            <StatusBadge status={(item as PracticumSession).status} />
            <Text style={styles.cardTitle}>{(item as PracticumSession).modul}</Text>
            <Text style={styles.body}>
              {(item as PracticumSession).tanggal}
              {schedule ? ` · ${schedule.mulai}–${schedule.selesai} WIB` : ''}
            </Text>
            {schedule && <Text style={styles.muted}>{schedule.ruangan}</Text>}
            {!!(item as PracticumSession).keterangan && (
              <Text style={styles.body}>{(item as PracticumSession).keterangan}</Text>
            )}
          </>
        )}
        {assistant && (
          <View style={styles.row}>
            {kind === 'kelas' && (
              <Button
                secondary
                onPress={() => {
                  setChosenClassId(item.id);
                  setKind('peserta');
                }}
              >
                Kelola kelas
              </Button>
            )}
            {(kind !== 'sesi' || (item as PracticumSession).status === 'belum_dibuka') && (
              <>
                <Button secondary disabled={busy} onPress={() => openEditor(kind, item)}>
                  Ubah
                </Button>
                <Button danger disabled={busy} onPress={() => confirmDelete(item)}>
                  Hapus
                </Button>
              </>
            )}
            {kind === 'sesi' && (item as PracticumSession).status !== 'ditutup' && (
              <Button disabled={busy} onPress={() => confirmStatus(item as PracticumSession)}>
                {(item as PracticumSession).status === 'belum_dibuka' ? 'Buka sesi' : 'Tutup sesi'}
              </Button>
            )}
          </View>
        )}
      </View>
    );
  }
  const header = (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>PRAKTI · {assistant ? 'ASISTEN' : 'PRAKTIKAN'}</Text>
      <Text style={styles.title}>Data Praktikum</Text>
      <Text style={styles.muted}>
        {assistant
          ? 'Kelola kelas, peserta, jadwal, dan sesi praktikum.'
          : 'Jadwal dan sesi dari kelas yang Anda ikuti.'}
      </Text>
      <View style={styles.row}>
        {(assistant
          ? (['kelas', 'peserta', 'jadwal', 'sesi'] as const)
          : (['jadwal', 'sesi'] as const)
        ).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: kind === value }}
            disabled={busy}
            onPress={() => {
              setKind(value);
              setMutationError(null);
              setSuccess(null);
            }}
            style={[styles.chip, kind === value && styles.chipSelected]}
          >
            <Text style={[styles.chipText, kind === value && styles.selectedText]}>
              {LABELS[value]}
            </Text>
          </Pressable>
        ))}
      </View>
      {kind !== 'kelas' && classes.data.length > 0 && (
        <>
          <Text style={styles.label}>Pilih kelas</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.classOptions}
          >
            {classes.data.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: item.id === classId }}
                disabled={busy}
                onPress={() => {
                  setChosenClassId(item.id);
                  setMutationError(null);
                  setSuccess(null);
                }}
                style={[styles.chip, item.id === classId && styles.chipSelected]}
              >
                <Text style={[styles.chipText, item.id === classId && styles.selectedText]}>
                  {item.kode}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.body}>{activeClass?.namaPraktikum}</Text>
        </>
      )}
      {success && (
        <Text accessibilityLiveRegion="polite" style={styles.success}>
          {success}
        </Text>
      )}
      {kind === 'sesi' && classId && records.schedules.error && (
        <Notice
          title="Gagal memuat jadwal sesi"
          message={records.schedules.error}
          onRetry={retryData}
        />
      )}
      {mutationError && !editor && !confirmation && (
        <Text accessibilityRole="alert" style={styles.error}>
          {mutationError}
        </Text>
      )}
      {assistant && !classes.loading && !classes.error && (kind === 'kelas' || classId) && (
        <Button
          disabled={
            busy ||
            !!source.error ||
            source.loading ||
            (kind === 'sesi' &&
              (!records.schedules.data.length ||
                records.schedules.loading ||
                !!records.schedules.error))
          }
          onPress={() => openEditor(kind, null)}
        >
          Tambah {LABELS[kind].toLowerCase()}
        </Button>
      )}
      {assistant &&
        kind === 'sesi' &&
        classId &&
        !records.schedules.loading &&
        !records.schedules.error &&
        !records.schedules.data.length && (
          <Text style={styles.muted}>Tambahkan jadwal terlebih dahulu sebelum membuat sesi.</Text>
        )}
    </View>
  );
  return (
    <View style={styles.screen}>
      <FlatList<PracticumRecord>
        data={classes.error || classes.loading || source.error || source.loading ? [] : items}
        keyExtractor={(item) => item.id}
        renderItem={renderRecord}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          classes.loading || source.loading ? (
            <Notice title="Memuat data…" loading />
          ) : classes.error || source.error ? (
            <Notice
              title="Gagal memuat data"
              message={classes.error ?? source.error!}
              onRetry={retryData}
            />
          ) : (
            <Notice
              title={
                !classId && kind !== 'kelas'
                  ? assistant
                    ? 'Belum ada kelas'
                    : 'Anda belum terdaftar di kelas'
                  : `Belum ada ${LABELS[kind].toLowerCase()}`
              }
              message={
                !classId && kind !== 'kelas'
                  ? assistant
                    ? 'Buka tab Kelas untuk menambahkan kelas praktikum.'
                    : 'Hubungi asisten untuk mendaftarkan akun Anda ke kelas.'
                  : assistant
                    ? `Gunakan tombol Tambah ${LABELS[kind].toLowerCase()} untuk memulai.`
                    : 'Data akan tampil setelah ditambahkan oleh asisten.'
              }
            />
          )
        }
      />
      {editor && (
        <RecordEditor
          editor={editor}
          schedules={records.schedules.data}
          busy={busy}
          error={mutationError}
          onClose={() => {
            if (!busy) {
              setEditor(null);
              setMutationError(null);
            }
          }}
          onSave={(values) => {
            void run(async () => {
              const id = await saveRecord(
                editor.kind,
                editor.classId,
                editor.record?.id ?? null,
                values,
              );
              if (editor.kind === 'kelas' && !editor.record) setChosenClassId(id);
            }, 'Data berhasil disimpan.');
          }}
        />
      )}
      <Modal
        visible={!!confirmation}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busy) {
            setConfirmation(null);
            setMutationError(null);
          }
        }}
      >
        <View style={styles.backdrop}>
          <View style={styles.dialog} accessibilityViewIsModal>
            <Text style={styles.heading}>{confirmation?.title}</Text>
            <Text style={styles.body}>{confirmation?.message}</Text>
            {mutationError && (
              <Text accessibilityRole="alert" style={styles.error}>
                {mutationError}
              </Text>
            )}
            {busy && <ActivityIndicator accessibilityLabel="Menyimpan perubahan" />}
            <View style={styles.row}>
              <Button
                secondary
                disabled={busy}
                onPress={() => {
                  setConfirmation(null);
                  setMutationError(null);
                }}
              >
                Batal
              </Button>
              <Button
                disabled={busy}
                onPress={() => {
                  if (confirmation) void run(confirmation.run, 'Perubahan berhasil disimpan.');
                }}
              >
                {busy ? 'Memproses…' : 'Konfirmasi'}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function RecordEditor({
  editor,
  schedules,
  busy,
  error,
  onClose,
  onSave,
}: {
  editor: Editor;
  schedules: Schedule[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (values: FormValues) => void;
}) {
  const [values, setValues] = useState<FormValues>(() => {
    const initial: FormValues = {};
    if (editor.record)
      for (const [key, value] of Object.entries(editor.record))
        if (typeof value === 'string') initial[key] = value;
    if (editor.kind === 'jadwal' && !initial.hari) initial.hari = 'Senin';
    if (editor.kind === 'sesi' && !initial.scheduleId) initial.scheduleId = schedules[0]?.id ?? '';
    return initial;
  });
  const update = (field: string, value: string) =>
    setValues((previous) => ({ ...previous, [field]: value }));
  function field(
    name: string,
    label: string,
    placeholder: string,
    maxLength: number,
    multiline = false,
  ) {
    return (
      <View key={name} style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          accessibilityLabel={label}
          style={[styles.input, multiline && styles.multiline]}
          value={values[name] ?? ''}
          onChangeText={(value) => update(name, value)}
          placeholder={placeholder}
          placeholderTextColor="#64748B"
          maxLength={maxLength}
          multiline={multiline}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy && !(name === 'uid' && !!editor.record)}
          keyboardType={name === 'nim' ? 'number-pad' : 'default'}
        />
      </View>
    );
  }
  function options(name: string, label: string, entries: { value: string; label: string }[]) {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.row}>
          {entries.map((entry) => (
            <Pressable
              key={entry.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: values[name] === entry.value }}
              disabled={busy}
              onPress={() => update(name, entry.value)}
              style={[styles.chip, values[name] === entry.value && styles.chipSelected]}
            >
              <Text style={[styles.chipText, values[name] === entry.value && styles.selectedText]}>
                {entry.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            <Text style={styles.title}>
              {editor.record ? 'Ubah' : 'Tambah'} {LABELS[editor.kind].toLowerCase()}
            </Text>
            {editor.kind === 'kelas' && (
              <>
                {field('kode', 'Kode kelas', 'IF-2A', 40)}
                {field('namaPraktikum', 'Nama praktikum', 'Basis Data', 120)}
              </>
            )}
            {editor.kind === 'peserta' && (
              <>
                {field(
                  'uid',
                  'UID akun praktikan',
                  'UID dari akun praktikan yang sudah terdaftar',
                  128,
                )}
                {field('nama', 'Nama peserta', 'Nama lengkap', 120)}
                {field('nim', 'NIM', 'Nomor induk mahasiswa', 40)}
                <Text style={styles.muted}>
                  Akun praktikan harus sudah terdaftar. UID menghubungkan peserta dengan akun yang
                  benar.
                </Text>
              </>
            )}
            {editor.kind === 'jadwal' && (
              <>
                {options(
                  'hari',
                  'Hari',
                  DAYS.map((hari) => ({ value: hari, label: hari })),
                )}
                {field('mulai', 'Jam mulai (WIB)', '08:00', 5)}
                {field('selesai', 'Jam selesai (WIB)', '10:00', 5)}
                {field('ruangan', 'Ruangan', 'Lab Komputer 1', 120)}
              </>
            )}
            {editor.kind === 'sesi' && (
              <>
                {options(
                  'scheduleId',
                  'Jadwal',
                  schedules.map((schedule) => ({
                    value: schedule.id,
                    label: `${schedule.hari} ${schedule.mulai}–${schedule.selesai} · ${schedule.ruangan}`,
                  })),
                )}
                {field('tanggal', 'Tanggal (YYYY-MM-DD)', '2026-11-12', 10)}
                {field('modul', 'Materi / modul', 'Modul 1: Pengenalan', 160)}
                {field(
                  'keterangan',
                  'Keterangan (opsional)',
                  'Persiapan atau catatan tambahan',
                  1000,
                  true,
                )}
                <Text style={styles.muted}>
                  Tanggal harus sesuai hari jadwal. Sesi baru berstatus Belum Dibuka.
                </Text>
              </>
            )}
            {error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            {busy && <ActivityIndicator accessibilityLabel="Menyimpan data" />}
            <View style={styles.row}>
              <Button secondary disabled={busy} onPress={onClose}>
                Batal
              </Button>
              <Button disabled={busy} onPress={() => onSave(values)}>
                {busy ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  list: {
    padding: 16,
    paddingBottom: 110,
    gap: 12,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
    flexGrow: 1,
  },
  header: { gap: 14, paddingVertical: 12 },
  eyebrow: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: { color: '#0F172A', fontSize: 26, fontWeight: '700' },
  heading: { color: '#0F172A', fontSize: 18, fontWeight: '700' },
  cardTitle: { color: '#0F172A', fontSize: 16, fontWeight: '700' },
  body: { color: '#334155', fontSize: 15, lineHeight: 23 },
  muted: { color: '#64748B', fontSize: 14, lineHeight: 21 },
  label: { color: '#334155', fontSize: 14, fontWeight: '600' },
  card: {
    padding: 18,
    gap: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  classOptions: { gap: 8, paddingVertical: 4 },
  chip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  chipSelected: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  chipText: { color: '#334155', fontSize: 14, fontWeight: '600' },
  selectedText: { color: '#FFFFFF' },
  button: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1D4ED8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  secondary: { backgroundColor: '#E2E8F0' },
  secondaryText: { color: '#1E293B' },
  danger: { backgroundColor: '#B91C1C' },
  dim: { opacity: 0.5 },
  notice: {
    padding: 24,
    gap: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  error: { color: '#B91C1C', fontSize: 14, lineHeight: 21 },
  success: { color: '#166534', fontSize: 14, lineHeight: 21 },
  backdrop: {
    flex: 1,
    backgroundColor: '#0F172A88',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  form: {
    padding: 24,
    gap: 20,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingBottom: 48,
  },
  field: { gap: 8 },
  input: {
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    minHeight: 48,
  },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
});
