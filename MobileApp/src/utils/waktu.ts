const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const dua = (n: number) => String(n).padStart(2, '0');

/** '2026-10-13' -> 'Selasa, 13 Okt 2026' */
export function formatTanggal(tanggal: string) {
  const [y, m, d] = tanggal.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${HARI[date.getDay()]}, ${d} ${BULAN[m - 1]} ${y}`;
}

/** '2026-10-13T13:07:00' -> '13:07' */
export function formatJam(waktu: string) {
  const date = new Date(waktu);
  return `${dua(date.getHours())}:${dua(date.getMinutes())}`;
}
