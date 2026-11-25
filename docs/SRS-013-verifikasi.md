# Presensi lokasi — bukti Sprint 3

Melanjutkan PR #14 (Yasmin), dengan main `f761c5e` termasuk pengelolaan lab #15.

QR dan kode manual masuk melalui fungsi `kirim` yang memeriksa lokasi lagi sebelum `catatPresensi`. Repository membaca sesi, jadwal, dan lab dalam transaksi; `labId` berasal dari jadwal sesuai kontrak main, bukan salinan pada sesi. Rules menghitung jarak koordinat terhadap lab yang sama. Kehadiran hanya boleh dibuat satu kali dengan ID sesi + UID, tidak boleh diperbarui/dihapus praktikan.

## Tes yang dijalankan

- `node --test tests/*.test.cjs`: 38/38 lulus (termasuk radius, koordinat invalid, izin lokasi ditolak, GPS mati, dan regresi praktikum/izin).
- `npx --yes firebase-tools@13.35.1 emulators:exec --only firestore --project demo-prakti-srs008-tests 'node --test tests/firestore-rules.test.mjs'`: 11/11 lulus, tidak ada skip.
- `npx tsc --noEmit`: lulus, menggunakan Node 26.13.0.
- `npx expo lint`: dijalankan; gagal pada 9 error bawaan main: Toast (3 refs), OpenSessionSheet, IdentityPickerSheet, laboratorium/hooks, PemeriksaanIzinScreen, AjukanIzinScreen, StatusIzinScreen (set-state-in-effect). File tersebut tidak diubah oleh perbaikan lokasi.
- `npx eslint src/features/presensi src/features/data-praktikum/attendance.ts src/context/PraktiContext.tsx src/screens/praktikan/PresensiScreen.tsx`: lulus.

## Bukti penyimpanan (Firestore Emulator)

Dua kasus terpisah memanggil `saveAttendance` produksi dengan Firebase SDK nyata. QR memakai hasil parser payload PRAKTI; manual memakai kode teks. Keduanya menggunakan koordinat fixture, bukan GPS fisik.

| Percobaan, masing-masing QR/manual | Hasil data |
| --- | --- |
| Di luar radius 50 m (sekitar 111 m) | Ditolak; `getDoc(...).exists() === false` |
| Flag klien dipalsukan sebagai dalam radius | Repository menolak; tidak ada dokumen |
| Menulis langsung koordinat luar radius | Rules menolak; tidak ada dokumen |
| Lab tidak cocok, akurasi >100 m, atau tanpa lokasi | Rules menolak |
| Sesi ditutup | Repository/rules menolak; tidak ada dokumen |
| Lab jadwal berubah sesudah pemeriksaan | Repository menolak; tidak ada dokumen |
| Di dalam radius | Berhasil; dokumen berisi koordinat, labId, dan waktu server |
| Duplikat | Repository/rules menolak; dokumen asli tidak berubah |

## Verifikasi perangkat yang masih diperlukan

`adb devices` tidak menemukan perangkat. Kamera QR, dialog izin lokasi, GPS sebenarnya, pengaturan izin permanen, dan perpindahan fisik melewati radius belum diuji. Gunakan development build di perangkat, akun praktikan terdaftar di kelas, sesi dibuka, dan jadwal dengan labId valid. Coba QR/manual masing-masing di dalam dan luar radius, lalu periksa dokumen kehadiran melalui akun asisten. Tutup sesi ketika proses GPS berlangsung dan ulangi presensi untuk memeriksa penolakan.

Rules wajib dideploy bersamaan dengan aplikasi setelah review; belum dideploy dalam pekerjaan ini. Jadwal lama tanpa labId tidak dapat melakukan presensi sampai asisten mengaturnya. Koordinat dilaporkan perangkat; validasi radius bukan perlindungan dari GPS spoofing. Mode demo memakai lab bayangan dan tidak menulis Firestore.
