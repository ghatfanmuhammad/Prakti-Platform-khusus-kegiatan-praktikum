import { useEffect, useMemo, useState } from 'react';
import type { DocumentData } from 'firebase/firestore';

import {
  NOMINAL_DENDA_DEFAULT,
  TOLERANSI_DEFAULT,
  type Laboratorium,
  type LabPraktikum,
} from './models';
import {
  formatLabError,
  subscribeLabMilikAslab,
  subscribeLaboratorium,
} from './repository';

const DEMO_ROOMS: Laboratorium[] = [
  { id: 'demo-room-1', nama: 'Lab Komputer 1', lat: -7.05012, lng: 110.44021, radiusMeter: 50 },
  { id: 'demo-room-2', nama: 'Lab Jaringan', lat: -7.05045, lng: 110.44085, radiusMeter: 75 },
];

const DEMO_LABS: LabPraktikum[] = [
  {
    id: 'demo-lab-a',
    kode: 'BD-A',
    namaLab: 'Lab A',
    namaPraktikum: 'Basis Data',
    aslabUid: 'A1',
    labId: 'demo-room-1',
    lokasi: 'Lab Komputer 1',
    lat: -7.05012,
    lng: 110.44021,
    radiusMeter: 50,
    toleransiMenit: 15,
    nominalDenda: 10000,
    participantCount: 2,
    scheduleCount: 1,
    sessionCount: 1,
  },
  {
    id: 'demo-lab-b',
    kode: 'BD-B',
    namaLab: 'Lab B',
    namaPraktikum: 'Basis Data',
    aslabUid: 'A1',
    labId: 'demo-room-2',
    lokasi: 'Lab Jaringan',
    lat: -7.05045,
    lng: 110.44085,
    radiusMeter: 75,
    toleransiMenit: 10,
    nominalDenda: 15000,
    participantCount: 0,
    scheduleCount: 0,
    sessionCount: 0,
  },
];

export interface LabState {
  data: Laboratorium[];
  loading: boolean;
  error: string | null;
  /** Panggil untuk memasang ulang listener setelah gagal. */
  retry: () => void;
}

export interface LabPraktikumState {
  data: LabPraktikum[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/** Daftar ruang fisik laboratorium real-time (dipakai Maps, form jadwal, dan Kelola Lab). */
export function useLaboratorium(isDemo = false): LabState {
  const [percobaan, setPercobaan] = useState(0);
  const [result, setResult] = useState<{
    percobaan: number;
    data: Laboratorium[];
    error: string | null;
  }>();

  useEffect(() => {
    if (isDemo) return;
    const unsubscribe = subscribeLaboratorium(
      (daftar) => setResult({ percobaan, data: daftar, error: null }),
      (err) => {
        console.warn('Gagal memuat laboratorium:', err);
        setResult({ percobaan, data: [], error: formatLabError(err) });
      },
    );
    return unsubscribe;
  }, [percobaan, isDemo]);

  if (isDemo) {
    return {
      data: DEMO_ROOMS,
      loading: false,
      error: null,
      retry: () => setPercobaan((n) => n + 1),
    };
  }

  const current = result?.percobaan === percobaan ? result : null;
  return {
    data: current?.data ?? [],
    loading: !current,
    error: current?.error ?? null,
    retry: () => setPercobaan((n) => n + 1),
  };
}

/**
 * Daftar Lab praktikum (`classes`) milik Aslab digabungkan dengan ruang fisiknya (`laboratories`)
 * secara real-time (SRS-020).
 */
export function useLabPraktikum(aslabUid: string | null, isDemo = false): LabPraktikumState {
  const labs = useLaboratorium(isDemo);
  const [percobaan, setPercobaan] = useState(0);
  const [result, setResult] = useState<{
    aslabUid: string;
    percobaan: number;
    classes: (DocumentData & { id: string })[];
    error: string | null;
  }>();

  useEffect(() => {
    if (!aslabUid || isDemo) return;
    const unsubscribe = subscribeLabMilikAslab(
      aslabUid,
      (daftar) => setResult({ aslabUid, percobaan, classes: daftar, error: null }),
      (err) => {
        console.warn('Gagal memuat daftar Lab Aslab:', err);
        setResult({ aslabUid, percobaan, classes: [], error: formatLabError(err) });
      },
    );
    return unsubscribe;
  }, [aslabUid, percobaan, isDemo]);

  const current =
    aslabUid && !isDemo && result?.aslabUid === aslabUid && result.percobaan === percobaan
      ? result
      : null;

  const data = useMemo<LabPraktikum[]>(() => {
    if (isDemo) return DEMO_LABS;
    if (!aslabUid || !current) return [];
    const labById = new Map(labs.data.map((item) => [item.id, item]));
    return current.classes
      .map((klass) => {
        const room = typeof klass.labId === 'string' ? labById.get(klass.labId) : undefined;
        return {
          id: klass.id,
          kode: String(klass.kode ?? ''),
          namaLab: String(klass.namaLab ?? klass.kode ?? ''),
          namaPraktikum: String(klass.namaPraktikum ?? ''),
          aslabUid: String(klass.aslabUid ?? aslabUid),
          labId: String(klass.labId ?? ''),
          lokasi: room?.nama ?? '-',
          lat: room ? room.lat : null,
          lng: room ? room.lng : null,
          radiusMeter: room ? room.radiusMeter : null,
          toleransiMenit:
            typeof klass.toleransiMenit === 'number' ? klass.toleransiMenit : TOLERANSI_DEFAULT,
          nominalDenda:
            typeof klass.nominalDenda === 'number' ? klass.nominalDenda : NOMINAL_DENDA_DEFAULT,
          participantCount: Number(klass.participantCount ?? 0),
          scheduleCount: Number(klass.scheduleCount ?? 0),
          sessionCount: Number(klass.sessionCount ?? 0),
          createdAt: klass.createdAt,
          updatedAt: klass.updatedAt,
        };
      })
      .sort((a, b) =>
        `${a.namaPraktikum} ${a.namaLab}`.localeCompare(`${b.namaPraktikum} ${b.namaLab}`, 'id'),
      );
  }, [aslabUid, current, labs.data, isDemo]);

  if (isDemo) {
    return {
      data: DEMO_LABS,
      loading: false,
      error: null,
      retry: () => setPercobaan((n) => n + 1),
    };
  }

  return {
    data,
    loading: Boolean(aslabUid) && (!current || labs.loading),
    error: current?.error ?? labs.error,
    retry: () => {
      setPercobaan((n) => n + 1);
      labs.retry();
    },
  };
}
