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
import type { Identity, Participant, PracticumClass, PracticumSession, Schedule } from './models';

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
};

const EMPTY_TREE: Record<string, ClassRecords> = {};

function useClassRecords(
  classKey: string,
  uid: string | undefined,
  student: boolean,
  retry: number,
): LiveData<Record<string, ClassRecords>> {
  const [result, setResult] = useState<{
    classKey: string; uid: typeof uid; student: boolean; retry: number; state: LiveData<Record<string, ClassRecords>>;
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
        data[id].schedules && data[id].sessions && (!student || 'klass' in data[id]),
      );
      setResult({
        classKey, uid, student, retry,
        state: live(ready && !error ? { ...data } as Record<string, ClassRecords> : EMPTY_TREE, !ready && !error, error),
      });
    };
    const stops = classIds.flatMap((id) => {
      const entry: Partial<ClassRecords> = { ...(student ? {} : { klass: null }) };
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
        ...(student ? [watch('klass', (next, fail) => watchClass(id, next, fail))] : []),
        watch('schedules', (next, fail) => watchCollection(collection(db, 'classes', id, 'schedules'), next, fail)),
        watch('sessions', (next, fail) => watchCollection(collection(db, 'classes', id, 'sessions'), next, fail)),
      ];
    });
    return () => {
      active = false;
      stops.forEach((stop) => stop());
    };
  }, [classKey, uid, student, retry]);

  if (!uid || !classKey) return live(EMPTY_TREE);
  return result?.classKey === classKey && result.uid === uid && result.student === student && result.retry === retry
    ? result.state
    : live(EMPTY_TREE, true);
}

type CodeRecord = { id: string; kode: string };
type AttendanceRecord = { id: string; sesiId: string; praktikanId: string; waktuHadir: Timestamp };

export function usePracticumData(identity: Identity | null, retry: number) {
  const uid = identity?.uid;
  const student = identity?.role === 'praktikan';
  const assistant = identity?.role === 'asisten';
  const sources = useMemo(() => {
    if (!uid) return { classes: null, participants: null, codes: null, attendance: null };
    const participants = collection(db, 'participants');
    const attendance = collection(db, 'attendance');
    return {
      classes: assistant ? collection(db, 'classes') : null,
      participants: student ? query(participants, where('uid', '==', uid)) : participants,
      codes: assistant ? collection(db, 'sessionCodes') : null,
      attendance: student ? query(attendance, where('praktikanId', '==', uid)) : attendance,
    };
  }, [assistant, student, uid]);

  const allClasses = useLiveCollection<PracticumClass>(sources.classes, retry);
  const participants = useLiveCollection<Participant>(sources.participants, retry);
  const codes = useLiveCollection<CodeRecord>(sources.codes, retry);
  const attendance = useLiveCollection<AttendanceRecord>(sources.attendance, retry);
  const classIds = student ? participants.data.map((p) => p.classId) : allClasses.data.map((c) => c.id);
  const classKey = [...new Set(classIds)].sort().join(',');
  const tree = useClassRecords(classKey, uid, student, retry);
  const classes = useMemo(
    () => student
      ? Object.values(tree.data).flatMap(({ klass }) => klass ? [klass] : [])
      : allClasses.data,
    [student, tree.data, allClasses.data],
  );
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
          praktikum: klass.namaPraktikum,
          kelas: klass.kode,
          tanggal: session.tanggal,
          mulai: schedule.mulai,
          selesai: schedule.selesai,
          ruang: schedule.ruangan,
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

  const classLoading = allClasses.loading || (student && participants.loading);
  const classError = allClasses.error ?? (student ? participants.error : null);
  return {
    classes: live(classes, classLoading || (student && tree.loading), classError ?? (student ? tree.error : null)),
    participants,
    tree,
    sesi,
    presensi,
    attendance,
    loading: classLoading || tree.loading,
    error: classError ?? tree.error,
  };
}
