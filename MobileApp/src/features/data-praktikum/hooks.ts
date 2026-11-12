import { useEffect, useMemo, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type Query,
} from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';
import { errorMessage } from './errors';
import type { Identity, Participant, PracticumClass, PracticumSession, Schedule } from './models';

const CONNECTION_TIMEOUT = 12000;
const CONNECTION_ERROR = 'Tidak dapat terhubung. Periksa koneksi internet lalu coba lagi.';
type IdentityState =
  | { phase: 'loading'; identity?: never; error?: never }
  | { phase: 'signed-out'; identity?: never; error?: never }
  | { phase: 'error'; error: string; identity?: never }
  | { phase: 'ready'; identity: Identity; error?: never };
export function useDataIdentity(retry: number): IdentityState {
  const [state, setState] = useState<IdentityState>({ phase: 'loading' });
  useEffect(() => {
    setState({ phase: 'loading' });
    let active = true;
    let stopProfile = () => {};
    let stopAuth = () => {};
    let timer: ReturnType<typeof setTimeout>;
    try {
      const { app, db } = getFirebaseServices();
      stopAuth = onAuthStateChanged(
        getAuth(app),
        (user) => {
          stopProfile();
          clearTimeout(timer);
          if (!active) return;
          if (!user) {
            setState({ phase: 'signed-out' });
            return;
          }
          setState({ phase: 'loading' });
          timer = setTimeout(
            () => active && setState({ phase: 'error', error: CONNECTION_ERROR }),
            CONNECTION_TIMEOUT,
          );
          stopProfile = onSnapshot(
            doc(db, 'users', user.uid),
            { includeMetadataChanges: true },
            (snapshot) => {
              if (!active || snapshot.metadata.fromCache) return;
              clearTimeout(timer);
              const role = snapshot.data()?.role;
              if (role !== 'asisten' && role !== 'praktikan') {
                setState({
                  phase: 'error',
                  error: 'Peran akun belum terdaftar. Hubungi pengelola untuk mengaktifkan akses.',
                });
              } else setState({ phase: 'ready', identity: { uid: user.uid, role } });
            },
            (error) => {
              clearTimeout(timer);
              if (active) setState({ phase: 'error', error: errorMessage(error) });
            },
          );
        },
        (error) => active && setState({ phase: 'error', error: errorMessage(error) }),
      );
    } catch (error) {
      setState({ phase: 'error', error: errorMessage(error) });
    }
    return () => {
      active = false;
      clearTimeout(timer);
      stopProfile();
      stopAuth();
    };
  }, [retry]);
  return state;
}

interface LiveData<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}
function empty<T>(): LiveData<T> {
  return { data: [], loading: true, error: null };
}
export function useLiveCollection<T extends { id: string }>(
  source: Query<DocumentData> | null,
  retry: number,
): LiveData<T> {
  const [state, setState] = useState<LiveData<T> & { source: typeof source }>({
    ...empty<T>(),
    source: null,
  });
  useEffect(() => {
    if (!source) {
      setState({ source, data: [], loading: false, error: null });
      return;
    }
    let active = true;
    setState({ ...empty<T>(), source });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const waitForServer = () => {
      if (timer) return;
      timer = setTimeout(() => {
        if (active) setState({ source, data: [], loading: false, error: CONNECTION_ERROR });
      }, CONNECTION_TIMEOUT);
    };
    waitForServer();
    const stop = onSnapshot(
      source,
      { includeMetadataChanges: true },
      (snapshot) => {
        // Do not mistake an unconfirmed cache miss for an empty server collection.
        if (!active) return;
        if (snapshot.metadata.fromCache) {
          waitForServer();
          return;
        }
        clearTimeout(timer);
        timer = undefined;
        const data = snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as T);
        setState({ source, data, loading: false, error: null });
      },
      (error) => {
        clearTimeout(timer);
        if (active)
          setState({
            source,
            data: [],
            loading: false,
            error: errorMessage(error),
          });
      },
    );
    return () => {
      active = false;
      clearTimeout(timer);
      stop();
    };
  }, [source, retry]);
  return state.source === source ? state : empty<T>();
}

/** Students query only their memberships, then individually read allowed classes. */
export function usePracticumClasses(identity: Identity, retry: number): LiveData<PracticumClass> {
  const source = useMemo(() => {
    const { db } = getFirebaseServices();
    return identity.role === 'asisten'
      ? collection(db, 'classes')
      : query(collection(db, 'participants'), where('uid', '==', identity.uid));
  }, [identity.role, identity.uid]);
  const records = useLiveCollection<PracticumClass | Participant>(source, retry);
  const [classes, setClasses] = useState<
    LiveData<PracticumClass> & { source: typeof records.data }
  >({ ...empty<PracticumClass>(), source: records.data });
  useEffect(() => {
    if (identity.role !== 'praktikan' || records.loading || records.error) return;
    const memberships = records.data as Participant[];
    if (!memberships.length) {
      setClasses({
        source: records.data,
        data: [],
        loading: false,
        error: null,
      });
      return;
    }
    let active = true;
    let failed = false;
    const result = new Map<string, PracticumClass>();
    const pending = new Set(memberships.map((record) => record.classId));
    setClasses({ ...empty<PracticumClass>(), source: records.data });
    const timer = setTimeout(() => {
      if (active) {
        failed = true;
        setClasses({
          source: records.data,
          data: [],
          loading: false,
          error: CONNECTION_ERROR,
        });
      }
    }, CONNECTION_TIMEOUT);
    const stops = [...pending].map((classId) =>
      onSnapshot(
        doc(getFirebaseServices().db, 'classes', classId),
        { includeMetadataChanges: true },
        (snapshot) => {
          if (!active || snapshot.metadata.fromCache) return;
          if (snapshot.exists())
            result.set(classId, {
              ...snapshot.data(),
              id: classId,
            } as PracticumClass);
          else result.delete(classId);
          pending.delete(classId);
          if (!pending.size && !failed) {
            clearTimeout(timer);
            setClasses({
              source: records.data,
              data: [...result.values()],
              loading: false,
              error: null,
            });
          }
        },
        (error) => {
          failed = true;
          clearTimeout(timer);
          if (active)
            setClasses({
              source: records.data,
              data: [],
              loading: false,
              error: errorMessage(error),
            });
        },
      ),
    );
    return () => {
      active = false;
      clearTimeout(timer);
      stops.forEach((stop) => stop());
    };
  }, [identity.role, records.data, records.loading, records.error, retry]);
  if (identity.role === 'asisten') return records as LiveData<PracticumClass>;
  if (records.loading || records.error) return { ...records, data: [] };
  return classes.source === records.data ? classes : empty<PracticumClass>();
}

export function useClassRecords(identity: Identity, classId: string | null, retry: number) {
  const sources = useMemo(() => {
    if (!classId) return { participants: null, schedules: null, sessions: null };
    const { db } = getFirebaseServices();
    return {
      participants:
        identity.role === 'asisten'
          ? query(collection(db, 'participants'), where('classId', '==', classId))
          : null,
      schedules: collection(db, 'classes', classId, 'schedules'),
      sessions: collection(db, 'classes', classId, 'sessions'),
    };
  }, [classId, identity.role]);
  return {
    participants: useLiveCollection<Participant>(sources.participants, retry),
    schedules: useLiveCollection<Schedule>(sources.schedules, retry),
    sessions: useLiveCollection<PracticumSession>(sources.sessions, retry),
  };
}
