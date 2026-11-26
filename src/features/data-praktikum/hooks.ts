import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type QuerySnapshot,
  type Query,
  type Timestamp,
} from 'firebase/firestore';

import { db } from '../../services/firebase';
import type { Presensi, Sesi } from '../../types';
import { errorMessage } from './errors';
import type {
  Identity,
  Participant,
  Pengampu,
  PracticumClass,
  PracticumSession,
  Schedule,
} from './models';

const TIMEOUT = 12000;
const CONNECTION_ERROR = 'Tidak dapat terhubung. Periksa koneksi internet lalu coba lagi.';

export interface LiveData<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

function live<T>(data: T, loading = false, error: string | null = null): LiveData<T> {
  return { data, loading, error };
}

export function useLiveCollection<T extends { id: string }>(
  source: Query<DocumentData> | null,
  retry: number,
): LiveData<T[]> {
  const [result, setResult] = useState<{ source: typeof source; retry: number; state: LiveData<T[]> }>();
  useEffect(() => {
    if (!source) return;
    const publish = (state: LiveData<T[]>) => setResult({ source, retry, state });
    return watchCollection<T>(source, (data) => publish(live(data)), (error) => publish(live([], false, error)));
  }, [source, retry]);

  if (!source) return live([]);
  return result?.source === source && result.retry === retry ? result.state : live([], true);
}

function watchCollection<T extends { id: string }>(
  source: Query<DocumentData>,
  onData: (value: T[]) => void,
  onError: (error: string) => void,
) {
  return watchServer<QuerySnapshot<DocumentData>>(
    (receive, fail) => onSnapshot(source, { includeMetadataChanges: true }, receive, fail),
    (snapshot) => onData(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as T)),
    onError,
  );
}

function watchServer<T extends { metadata: { fromCache: boolean; hasPendingWrites: boolean } }>(
  subscribe: (receive: (snapshot: T) => void, fail: (error: unknown) => void) => () => void,
  onData: (snapshot: T) => void,
  onError: (error: string) => void,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const awaitServer = () => {
    timer ??= setTimeout(() => onError(CONNECTION_ERROR), TIMEOUT);
  };
  awaitServer();
  const stop = subscribe(
    (snapshot) => {
      if (snapshot.metadata.fromCache) {
        awaitServer();
      } else if (!snapshot.metadata.hasPendingWrites) {
        clearTimeout(timer);
        timer = undefined;
        onData(snapshot);
      }
    },
    (error) => {
      clearTimeout(timer);
      onError(errorMessage(error));
    },
  );
  return () => {
    clearTimeout(timer);
    stop();
  };
}

function watchClass(
  classId: string,
  onData: (value: PracticumClass | null) => void,
  onError: (error: string) => void,
) {
  return watchServer<DocumentSnapshot<DocumentData>>(
    (receive, fail) => onSnapshot(doc(db, 'classes', classId), { includeMetadataChanges: true }, receive, fail),
    (snapshot) => onData(snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as PracticumClass : null),
    onError,
  );
}

type ClassRecords = {
  klass: PracticumClass | null;
  schedules: Schedule[];
  sessions: PracticumSession[];
  participants: Participant[];
};

const EMPTY_TREE: Record<string, ClassRecords> = {};

function useClassRecords(
  classKey: string,
  uid: string | undefined,
  watchKlassDoc: boolean,
  watchParticipantsByClass: boolean,
  retry: number,
): LiveData<Record<string, ClassRecords>> {
  const [result, setResult] = useState<{
    classKey: string;
    uid: typeof uid;
    watchKlassDoc: boolean;
    watchParticipantsByClass: boolean;
    retry: number;
    state: LiveData<Record<string, ClassRecords>>;
  }>();

  useEffect(() => {
    if (!uid || !classKey) return;
    const classIds = classKey.split(',');
    const data: Record<string, Partial<ClassRecords>> = Object.create(null);
    const errors = new Map<string, string>();
    let active = true;
    const publish = () => {
      if (!active) return;
      const error = errors.values().next().value ?? null;
      const ready = classIds.every((id) =>
        data[id].schedules &&
        data[id].sessions &&
        (!watchParticipantsByClass || data[id].participants) &&
        (!watchKlassDoc || 'klass' in data[id]),
      );
      setResult({
        classKey,
        uid,
        watchKlassDoc,
        watchParticipantsByClass,
        retry,
        state: live(
          ready && !error ? ({ ...data } as Record<string, ClassRecords>) : EMPTY_TREE,
          !ready && !error,
          error,
        ),
      });
    };
    const stops = classIds.flatMap((id) => {
      const entry: Partial<ClassRecords> = {
        ...(watchKlassDoc ? {} : { klass: null }),
        ...(watchParticipantsByClass ? {} : { participants: [] }),
      };
      data[id] = entry;
      const watch = <K extends keyof ClassRecords>(
        key: K,
        start: (onData: (value: ClassRecords[K]) => void, onError: (error: string) => void) => () => void,
      ) => {
        const slot = `${id}:${key}`;
        return start(
          (value) => {
            data[id] = { ...data[id], [key]: value };
            errors.delete(slot);
            publish();
          },
          (error) => {
            errors.set(slot, error);
            publish();
          },
        );
      };
      return [
        ...(watchKlassDoc ? [watch('klass', (next, fail) => watchClass(id, next, fail))] : []),
        watch('schedules', (next, fail) => watchCollection(collection(db, 'classes', id, 'schedules'), next, fail)),
        watch('sessions', (next, fail) => watchCollection(collection(db, 'classes', id, 'sessions'), next, fail)),
        ...(watchParticipantsByClass
          ? [
              watch('participants', (next, fail) =>
                watchCollection(query(collection(db, 'participants'), where('classId', '==', id)), next, fail),
              ),
            ]
          : []),
      ];
    });
    return () => {
      active = false;
      stops.forEach((stop) => stop());
    };
  }, [classKey, uid, watchKlassDoc, watchParticipantsByClass, retry]);

  if (!uid || !classKey) return live(EMPTY_TREE);
  return result?.classKey === classKey &&
    result.uid === uid &&
    result.watchKlassDoc === watchKlassDoc &&
    result.watchParticipantsByClass === watchParticipantsByClass &&
    result.retry === retry
    ? result.state
    : live(EMPTY_TREE, true);
}

type CodeRecord = { id: string; kode: string };
type AttendanceRecord = { id: string; sesiId: string; praktikanId: string; waktuHadir: Timestamp };

function useScopedCollection<T extends { id: string }>(name: string, key: string, enabled: boolean, retry: number): LiveData<T[]> {
  const [result, setResult] = useState<{ key: string; retry: number; state: LiveData<T[]> }>();
  useEffect(() => {
    if (!enabled || !key) return;
    const rows = new Map<string, T[]>();
    const failures = new Map<string, string>();
    let active = true;
    const ids = key.split(',');
    const publish = () => {
      if (!active) return;
      const error = failures.values().next().value ?? null;
      setResult({ key, retry, state: live(error ? [] : [...rows.values()].flat(), !error && rows.size !== ids.length, error) });
    };
    const stops = ids.map((classId) => watchCollection<T>(query(collection(db, name), where('classId', '==', classId)),
      (data) => { rows.set(classId, data); failures.delete(classId); publish(); },
      (error) => { failures.set(classId, error); rows.delete(classId); publish(); }));
    return () => { active = false; stops.forEach((stop) => stop()); };
  }, [name, key, enabled, retry]);
  if (!enabled || !key) return live([]);
  return result?.key === key && result.retry === retry ? result.state : live([], true);
}

export function usePracticumData(identity: Identity | null, retry: number) {
  const uid = identity?.uid;
  const student = identity?.role === 'praktikan';
<<<<<<< HEAD
  const aslab = identity?.role === 'aslab';
  const asprak = identity?.role === 'asprak';
  const legacyAssistant = identity?.role === 'asisten';

  const sources = useMemo(() => {
    if (!uid) {
      return { classes: null, participants: null, pengampu: null, codes: null, attendance: null };
    }
    const participants = collection(db, 'participants');
    const attendance = collection(db, 'attendance');
    return {
      classes: aslab
        ? query(collection(db, 'classes'), where('aslabUid', '==', uid))
        : legacyAssistant
          ? collection(db, 'classes')
          : null,
      participants: student
        ? query(participants, where('uid', '==', uid))
        : legacyAssistant
          ? participants
          : null,
      pengampu: asprak ? query(collection(db, 'pengampu'), where('uid', '==', uid)) : null,
      codes: legacyAssistant || asprak ? collection(db, 'sessionCodes') : null,
      attendance: student ? query(attendance, where('praktikanId', '==', uid)) : attendance,
    };
  }, [aslab, asprak, legacyAssistant, student, uid]);

  const allClasses = useLiveCollection<PracticumClass>(sources.classes, retry);
  const directParticipants = useLiveCollection<Participant>(sources.participants, retry);
  const pengampu = useLiveCollection<Pengampu>(sources.pengampu, retry);
  const codes = useLiveCollection<CodeRecord>(sources.codes, retry);
  const attendance = useLiveCollection<AttendanceRecord>(sources.attendance, retry);

  const classIds = student
    ? directParticipants.data.map((p) => p.classId)
    : asprak
      ? pengampu.data.map((p) => p.classId)
      : allClasses.data.map((c) => c.id);
  const classKey = [...new Set(classIds)].sort().join(',');
  const watchKlassDoc = student || asprak;
  const watchParticipantsByClass = aslab || asprak;
  const tree = useClassRecords(classKey, uid, watchKlassDoc, watchParticipantsByClass, retry);

  const classes = useMemo(
    () =>
      watchKlassDoc
        ? Object.values(tree.data).flatMap(({ klass }) => (klass ? [klass] : []))
        : allClasses.data,
    [watchKlassDoc, tree.data, allClasses.data],
  );

  const participants = useMemo<LiveData<Participant[]>>(() => {
    if (!watchParticipantsByClass) return directParticipants;
    const merged = Object.values(tree.data).flatMap((entry) => entry.participants);
    return live(merged, allClasses.loading || pengampu.loading || tree.loading, tree.error);
  }, [
    watchParticipantsByClass,
    directParticipants,
    tree.data,
    tree.loading,
    tree.error,
    allClasses.loading,
    pengampu.loading,
  ]);

=======
  const owner = identity?.role === 'aslab';
  const assistant = identity?.role === 'asprak';
  const sources = useMemo(() => ({
    classes: uid && owner ? query(collection(db, 'classes'), where('aslabUid', '==', uid)) : null,
    memberships: uid && !owner ? query(collection(db, student ? 'participants' : 'pengampu'), where('uid', '==', uid)) : null,
    attendance: uid && student ? query(collection(db, 'attendance'), where('praktikanId', '==', uid)) : null,
  }), [uid, owner, student]);
  const allClasses = useLiveCollection<PracticumClass>(sources.classes, retry);
  const memberships = useLiveCollection<Participant>(sources.memberships, retry);
  const classIds = owner ? allClasses.data.map((c) => c.id) : memberships.data.map((p) => p.classId);
  const classKey = [...new Set(classIds)].sort().join(',');
  const tree = useClassRecords(classKey, uid, !owner, retry);
  const roster = useScopedCollection<Participant>('participants', classKey, !!uid && !student, retry);
  const participants = student ? memberships : roster;
  const codes = useScopedCollection<CodeRecord>('sessionCodes', classKey, assistant, retry);
  const ownAttendance = useLiveCollection<AttendanceRecord>(sources.attendance, retry);
  const classAttendance = useScopedCollection<AttendanceRecord>('attendance', classKey, !!uid && !student, retry);
  const attendance = student ? ownAttendance : classAttendance;
  const classes = useMemo(() => owner ? allClasses.data : Object.values(tree.data).flatMap(({ klass }) => klass ? [klass] : []), [owner, allClasses.data, tree.data]);
>>>>>>> origin/main
  const sesi = useMemo<Sesi[]>(() => {
    const codeById = new Map(codes.data.map((code) => [code.id, code.kode]));
    return classes.flatMap((klass) => {
      const records = tree.data[klass.id];
      if (!records) return [];
      const schedules = new Map(records.schedules.map((schedule) => [schedule.id, schedule]));
      return records.sessions.flatMap((session) => {
        const schedule = schedules.get(session.scheduleId);
        if (!schedule) return [];
        const id = `${klass.id}~${session.id}`;
        return [{
          id,
          classId: klass.id,
          sessionId: session.id,
          namaLab: klass.namaLab,
          toleransiMenit: klass.toleransiMenit,
          nominalDenda: klass.nominalDenda,
          praktikum: klass.namaPraktikum,
          kelas: klass.kode,
          tanggal: session.tanggal,
          mulai: schedule.mulai,
          selesai: schedule.selesai,
          ruang: schedule.ruangan,
          labId: schedule.labId ?? klass.labId,
          asistenId: session.asistenId,
          status: session.status,
          modul: session.modul,
          keterangan: session.keterangan,
          topik: session.topik,
          kode: codeById.get(id) ?? null,
        }];
      });
    });
  }, [classes, codes.data, tree.data]);

  const presensi = useMemo<Presensi[]>(
    () => attendance.data.map(({ sesiId, praktikanId, waktuHadir }) =>
      ({ sesiId, praktikanId, waktuHadir: waktuHadir.toDate().toISOString() })),
    [attendance.data],
  );

<<<<<<< HEAD
  const classLoading =
    allClasses.loading ||
    (student && directParticipants.loading) ||
    (asprak && pengampu.loading);
  const classError =
    allClasses.error ??
    (student ? directParticipants.error : null) ??
    (asprak ? pengampu.error : null);

  return {
    classes: live(
      classes,
      classLoading || (watchKlassDoc && tree.loading),
      classError ?? (watchKlassDoc ? tree.error : null),
    ),
=======
  const classLoading = allClasses.loading || (!owner && memberships.loading);
  const classError = allClasses.error ?? (!owner ? memberships.error : null);
  return {
    classes: live(classes, classLoading || (!owner && tree.loading), classError ?? (!owner ? tree.error : null)),
>>>>>>> origin/main
    participants,
    pengampu,
    tree,
    sesi,
    presensi,
    attendance,
    loading: classLoading || tree.loading,
    error: classError ?? tree.error,
  };
}
