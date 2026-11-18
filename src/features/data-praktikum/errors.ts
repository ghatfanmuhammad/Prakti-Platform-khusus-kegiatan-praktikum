export function errorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  switch (code?.replace('firestore/', '')) {
    case 'permission-denied':
      return 'Akses ditolak. Pastikan peran dan keanggotaan kelas Anda sudah sesuai.';
    case 'unavailable':
    case 'deadline-exceeded':
      return 'Tidak dapat terhubung. Periksa koneksi internet lalu coba lagi.';
    case 'unauthenticated':
      return 'Sesi login berakhir. Silakan masuk kembali.';
    case 'failed-precondition':
      return 'Data belum dapat diproses. Muat ulang lalu coba lagi.';
    case 'resource-exhausted':
      return 'Layanan sedang sibuk. Coba lagi beberapa saat.';
  }
  if (error instanceof Error && !code && error.message !== 'firebase/not-configured')
    return error.message;
  return 'Layanan data belum tersedia. Hubungi pengelola atau coba lagi nanti.';
}
