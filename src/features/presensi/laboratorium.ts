import { doc, getDocFromServer } from 'firebase/firestore';

import { db } from '../../services/firebase';
import { errorMessage } from '../data-praktikum/errors';
import { bacaLaboratorium, type HasilLokasi, type Laboratorium } from './lokasi';

export type HasilMuatLab =
  | { ok: true; lab: Laboratorium }
  | { ok: false; hasil: Extract<HasilLokasi, { jenis: 'lab_belum_diatur' | 'lab_gagal_dimuat' }> };

/**
 * Membaca laboratorium dari server sesuai kontrak SRS-014 di main.
 * Kontrak: `laboratories/{labId}` berisi `{ nama, lat, lng, radiusMeter }`,
 * dan `labId` berasal dari jadwal sesi.
 */
export async function muatLaboratorium(labId: string | null | undefined): Promise<HasilMuatLab> {
  if (!labId) return { ok: false, hasil: { jenis: 'lab_belum_diatur' } };
  try {
    const snapshot = await getDocFromServer(doc(db, 'laboratories', labId));
    const lab = bacaLaboratorium(snapshot.id, snapshot.data());
    return lab ? { ok: true, lab } : { ok: false, hasil: { jenis: 'lab_belum_diatur' } };
  } catch (err) {
    console.warn('Gagal memuat data laboratorium:', err);
    const code = (err as { code?: string })?.code;
    return {
      ok: false,
      hasil: {
        jenis: 'lab_gagal_dimuat',
        pesan: code === 'permission-denied'
          ? 'Data laboratorium belum bisa dibaca. Hubungi asisten atau pengelola aplikasi.'
          : errorMessage(err),
      },
    };
  }
}
