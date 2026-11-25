import { useCallback, useEffect, useRef, useState } from 'react';

import { usePrakti } from '../../context/PraktiContext';
import type { Sesi } from '../../types';
import { muatLaboratorium } from './laboratorium';
import { periksaRadius, type HasilLokasi, type Laboratorium } from './lokasi';
import { ambilPosisi } from './perangkatLokasi';

export interface ValidasiLokasi {
  /** Hasil pemeriksaan terakhir; null sebelum pemeriksaan pertama selesai. */
  hasil: HasilLokasi | null;
  memeriksa: boolean;
  /** Memeriksa ulang data lab dan posisi perangkat, lalu mengembalikan hasil terbarunya. */
  periksa: () => Promise<HasilLokasi>;
}

/** Radius lab bayangan pada mode demo (hanya development, tanpa Firestore). */
const RADIUS_DEMO_M = 50;

/**
 * [SRS-013] Memeriksa apakah praktikan berada dalam radius laboratorium sesi.
 * Pemeriksaan berjalan otomatis saat `aktif` (sesi dibuka dan belum presensi), dan bisa diulang.
 *
 * Mode demo tidak punya data laboratorium, jadi lab bayangan diletakkan di posisi pertama
 * perangkat. Dengan begitu alur presensi tetap bisa dicoba tanpa Firestore.
 */
export function useValidasiLokasi(sesi: Sesi | undefined, aktif: boolean): ValidasiLokasi {
  const { practicum } = usePrakti();
  const demo = practicum === null;
  const [hasil, setHasil] = useState<HasilLokasi | null>(null);
  const [memeriksa, setMemeriksa] = useState(false);
  const berjalan = useRef<Promise<HasilLokasi> | null>(null);
  const labDemo = useRef<Laboratorium | null>(null);
  const terpasang = useRef(true);
  const labId = sesi?.labId;

  useEffect(() => {
    terpasang.current = true;
    return () => {
      terpasang.current = false;
    };
  }, []);

  const jalankan = useCallback(async (): Promise<HasilLokasi> => {
    let lab: Laboratorium | null = null;
    if (!demo) {
      // Data lab dimuat lebih dulu supaya izin lokasi tidak diminta bila lab belum diatur.
      const muat = await muatLaboratorium(labId);
      if (!muat.ok) return muat.hasil;
      lab = muat.lab;
    }

    const posisi = await ambilPosisi();
    if (!posisi.ok) return posisi.hasil;

    if (demo) {
      labDemo.current ??= {
        id: 'demo',
        nama: 'Lab Demo',
        lat: posisi.posisi.lat,
        lng: posisi.posisi.lng,
        radiusMeter: RADIUS_DEMO_M,
      };
      lab = labDemo.current;
    }
    return periksaRadius(posisi.posisi, lab as Laboratorium);
  }, [demo, labId]);

  const periksa = useCallback(() => {
    if (berjalan.current) return berjalan.current;
    setMemeriksa(true);
    const janji = jalankan()
      .catch((err): HasilLokasi => {
        console.warn('Gagal memeriksa lokasi:', err);
        return { jenis: 'koordinat_tidak_tersedia' };
      })
      .then((baru) => {
        if (terpasang.current) {
          setHasil(baru);
          setMemeriksa(false);
        }
        return baru;
      })
      .finally(() => {
        berjalan.current = null;
      });
    berjalan.current = janji;
    return janji;
  }, [jalankan]);

  useEffect(() => {
    if (aktif) void periksa();
  }, [aktif, periksa]);

  return { hasil, memeriksa, periksa };
}
