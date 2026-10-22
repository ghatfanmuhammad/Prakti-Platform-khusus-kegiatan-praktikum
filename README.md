# PRAKTI

> **Platform Khusus Kegiatan Praktikum**  
> Solusi mobile cerdas dan responsif untuk mengelola presensi serta sesi praktikum secara efisien dari dua sudut pandang: **Asisten Laboratorium** dan **Praktikan**.

---

## 📌 Ringkasan Proyek

**PRAKTI** adalah aplikasi mobile berbasis React Native (Expo) yang dirancang untuk memfasilitasi pencatatan dan pemantauan kehadiran kegiatan praktikum. Aplikasi ini mengakomodasi dua jenis pengguna dengan kebutuhan berbeda:

- **Asisten:** Melihat jadwal praktikum, membuka sesi saat praktikum dimulai, memantau kehadiran praktikan secara *real-time*, dan menutup sesi setelah kegiatan selesai.
- **Praktikan:** Melihat jadwal dan detail sesi praktikum, melakukan presensi digital saat sesi dibuka, serta memantau riwayat kehadirannya secara mandiri.

### Cakupan Sprint 1
Pada **Sprint 1**, seluruh data (identitas pengguna, jadwal, sesi, dan presensi) dikelola menggunakan data *dummy* lokal dan state aplikasi (*React State / Context*). Fokus utama sprint ini adalah:
- Antarmuka pengguna (UI) yang rapi, adaptif, dan responsif dengan tata letak **Flexbox**.
- Alur kerja (*user flow*) yang tepat, konsisten, dan interaktif sesuai spesifikasi kebutuhan (SRS).

> [!NOTE]  
> Karena belum terintegrasi dengan basis data (*database*), sinkronisasi data presensi antara peran asisten dan praktikan tidak wajib selaras secara terpusat. Penilaian difokuskan pada keakuratan alur kerja dan responsivitas antarmuka.

---

## 🎯 User Story

- **Sebagai Asisten**, saya ingin melihat jadwal praktikum, membuka dan menutup sesi, serta melihat siapa saja yang sudah hadir, sehingga saya dapat mengelola kehadiran praktikum dengan mudah.
- **Sebagai Praktikan**, saya ingin melihat jadwal dan detail sesi, melakukan presensi saat sesi dibuka, dan melihat catatan kehadiran saya, sehingga saya tahu kehadiran saya sudah tercatat.

---

## 🔄 Alur Demo Aplikasi

Alur utama skenario demonstrasi aplikasi:

```mermaid
flowchart LR
    A[Asisten Membuka Sesi] --> B[Praktikan Melakukan Presensi]
    B --> C[Asisten Melihat Rekap Kehadiran]
    C --> D[Asisten Menutup Sesi]
```

1. **Buka Sesi:** Asisten memilih jadwal dan membuka sesi praktikum melalui modal konfirmasi.
2. **Presensi:** Praktikan memilih jadwal yang sedang dibuka, mengonfirmasi presensi, dan sistem mencatat waktu kehadiran.
3. **Pantau Rekap:** Asisten membuka halaman rekap untuk memverifikasi daftar praktikan yang telah hadir.
4. **Tutup Sesi:** Asisten menutup sesi praktikum; sesi yang telah ditutup tidak dapat dibuka kembali dan praktikan tidak dapat melakukan presensi lagi.

---

## 📋 Daftar Software Requirement Specification (SRS)

| Kode SRS | Deskripsi Fitur | Kriteria Penerimaan (*Acceptance Criteria*) |
| :--- | :--- | :--- |
| **SRS-001** | **Pemilihan Peran & Identitas** | • Halaman awal menampilkan formulir pilihan peran (*Asisten* atau *Praktikan*).<br>• Setelah memilih peran, pengguna memilih identitas dari daftar data dummy (Nama & NIM / Kode Asisten).<br>• Tombol lanjut dalam kondisi dinonaktifkan (*disabled*) sebelum peran dan identitas dipilih.<br>• Setelah konfirmasi, pengguna diarahkan ke halaman utama sesuai perannya.<br>• Tersedia opsi untuk keluar (*logout*) dan kembali ke halaman pemilihan peran. |
| **SRS-002** | **Navigasi & Tata Letak** | • Menggunakan React Navigation untuk perpindahan antar halaman.<br>• Asisten dan praktikan memiliki alur navigasi masing-masing (misal: Tab Jadwal & Rekap/Riwayat).<br>• Seluruh tata letak disusun menggunakan **Flexbox** dan responsif di berbagai ukuran layar.<br>• Data dummy (pengguna, jadwal, sesi) dan state bersama (*Context*) disiapkan terpusat. |
| **SRS-003** | **Jadwal & Detail Sesi** | • Menampilkan daftar seluruh jadwal praktikum.<br>• Setiap item menampilkan nama praktikum, kelas, waktu pelaksanaan, dan status sesi (*Belum Dibuka*, *Dibuka*, *Ditutup*).<br>• Status sesi ditandai dengan badge indikator visual yang jelas.<br>• Menekan item jadwal akan membuka halaman detail sesi dengan informasi komprehensif.<br>• Menampilkan *empty state* informatif jika daftar jadwal kosong. |
| **SRS-004** | **Pengelolaan Sesi (Asisten)** | • Asisten dapat membuka sesi yang berstatus *Belum Dibuka*.<br>• Asisten dapat menutup sesi yang berstatus *Dibuka*.<br>• Setiap aksi buka/tutup memicu Modal atau Bottom Sheet konfirmasi.<br>• Perubahan status langsung ter-update di daftar jadwal dan halaman detail sesi.<br>• Sesi yang sudah ditutup tidak dapat dibuka kembali (*immutable*). |
| **SRS-005** | **Pencatatan Presensi (Praktikan)** | • Praktikan hanya dapat melakukan presensi ketika status sesi adalah *Dibuka*.<br>• Jika sesi belum dibuka atau sudah ditutup, tombol presensi nonaktif disertai keterangan status.<br>• Menampilkan Modal atau Bottom Sheet konfirmasi sebelum presensi tercatat.<br>• Mencatat timestamp waktu kehadiran secara akurat saat presensi disubmit.<br>• Memberikan umpan balik visual (*feedback/toast/modal*) bahwa presensi berhasil.<br>• Mencegah presensi ganda: tampilan berubah menjadi *"Presensi sudah tercatat"* beserta catatan waktunya. |
| **SRS-006** | **Rekap Kehadiran** | • **Asisten:** Melihat daftar praktikan yang sudah hadir pada suatu sesi beserta waktu kehadirannya.<br>• **Praktikan:** Melihat riwayat kehadiran pribadi (nama praktikum, tanggal, dan waktu hadir).<br>• Menekan item rekap/riwayat dapat memunculkan informasi pendukung melalui Modal / Bottom Sheet.<br>• Menampilkan tampilan khusus (*empty state*) ketika belum ada praktikan yang hadir atau riwayat masih kosong. |

---

## 👥 Pembagian Tugas & Tim

Struktur tim terdiri dari **1 Project Manager** dan **3 Programmer**. Seluruh pengerjaan fitur dilakukan secara terisolasi pada branch masing-masing yang dibuat dari `main`.

```
                              ┌── feature/pilih-peran & riwayat-praktikan (Felicia)
                              ├── feature/jadwal-sesi & kelola-sesi (Raihan)
main ── chore/setup-project (Ghatfan) 
                              └── feature/presensi & rekap-asisten (Reva Yasmin)
```

| Anggota Tim | Peran | Tanggung Jawab & Fitur | Target SRS | Branch Kerja |
| :--- | :--- | :--- | :--- | :--- |
| **Ghatfan** | **Project Manager** | • Inisialisasi proyek React Native (Expo) & struktur navigasi.<br>• Setup state terpusat (*Context API*) dan data dummy.<br>• Manajemen alur Git, code review, penyelesaian konflik, & merge ke `main`.<br>• Monitoring dan pelaporan status akhir proyek. | **SRS-002** | `chore/setup-project` |
| **Felicia** | **Programmer 1** | • Halaman pemilihan peran dan form identitas pengguna.<br>• Halaman riwayat kehadiran praktikan beserta tampilan saat kosong (*empty state*). | **SRS-001**<br>**SRS-006** | `feature/pilih-peran`<br>`feature/riwayat-praktikan` |
| **Raihan** | **Programmer 2** | • Halaman daftar jadwal dan detail sesi (termasuk badge status & *empty state*).<br>• Fitur pembukaan dan penutupan sesi oleh asisten dengan modal konfirmasi. | **SRS-003**<br>**SRS-004** | `feature/jadwal-sesi`<br>`feature/kelola-sesi` |
| **Reva Yasmin** | **Programmer 3** | • Fitur presensi praktikan (validasi status, konfirmasi, pencatatan waktu, & pencegahan duplikasi).<br>• Halaman rekap kehadiran untuk asisten beserta tampilan saat belum ada praktikan hadir. | **SRS-005**<br>**SRS-006** | `feature/presensi`<br>`feature/rekap-asisten` |

---

## 📜 Aturan Tim & Standar Kerja

1. **Alur Branching:**
   - Seluruh programmer melakukan `git pull` dari branch `main` setelah PM melakukan merge kerangka awal proyek.
   - Buat branch baru dari `main` sesuai penamaan fitur masing-masing.
   - **Dilarang keras langsung melakukan push ke branch `main`**. Selalu push ke branch fitur masing-masing.
2. **Format Pesan Commit:**
   - Commit wajib memiliki **Header** dan **Body** yang menjelaskan perubahan serta SRS yang diimplementasikan.
   - Format:
     ```text
     feat(<scope>): <ringkasan singkat>

     <deskripsi detail perubahan yang dilakukan>
     Sesuai dengan kriteria penerimaan SRS-xxx.
     ```
   - Contoh:
     ```text
     feat(presensi): tambah konfirmasi presensi praktikan

     Menambahkan BottomSheet konfirmasi sebelum presensi dikirim dan
     mencatat waktu presensi secara otomatis saat tombol ditekan.
     Mengimplementasikan kriteria penerimaan SRS-005.
     ```
3. **Integritas Penulis Commit:**
   - Commit harus murni dari masing-masing programmer, **tanpa co-author**.
4. **Fokus Pengerjaan:**
   - Bekerja secara terfokus pada cakupan SRS yang telah dialokasikan (tidak lebih dan tidak kurang) guna meminimalkan *merge conflict*.
5. **Kewenangan Merge:**
   - **Hanya Project Manager (Ghatfan)** yang memiliki otorisasi untuk melakukan merge branch fitur ke branch `main`.

---

## 🛠️ Tech Stack & Teknologi

- **Framework:** [React Native](https://reactnative.dev/) dengan [Expo](https://expo.dev/)
- **Bahasa:** [TypeScript](https://www.typescriptlang.org/)
- **Navigasi:** [React Navigation](https://reactnavigation.org/) / [Expo Router](https://docs.expo.dev/router/introduction/)
- **State Management:** React Local State (`useState`) & React Context API
- **Tata Letak & Styling:** React Native Flexbox & StyleSheet API

---

## 🚀 Panduan Memulai (*Getting Started*)

### Prasyarat
- Pastikan telah menginstal [Node.js](https://nodejs.org/) (versi LTS disarankan, Node 18+ atau 20+).
- Aplikasi [Expo Go](https://expo.dev/go) pada perangkat fisik (Android/iOS) atau emulator Android/iOS.

### Langkah Instalasi & Menjalankan

1. **Buka Terminal pada direktori `MobileApp`:**
   ```bash
   cd MobileApp
   ```

2. **Instal Dependensi:**
   ```bash
   npm install
   ```

3. **Menjalankan Server Pengembangan Expo:**
   ```bash
   npx expo start
   ```

4. **Membuka Aplikasi:**
   - Pindai QR Code yang muncul di terminal menggunakan aplikasi **Expo Go** pada perangkat Android, atau kamera pada iOS.
   - Tekan `a` untuk membuka Android Emulator.
   - Tekan `i` untuk membuka iOS Simulator.
   - Tekan `w` untuk menjalankan di Web Browser.

---

## 📂 Struktur Direktori

```text
MobileApp/
├── assets/                     # Gambar, ikon, font, dan aset statis
├── src/
│   ├── app/                    # Routing, tata letak (_layout.tsx), dan layar aplikasi
│   ├── components/             # Komponen UI modular, tombol, dialog modal
│   │   └── ui/                 # Komponen dasar visual
│   ├── constants/              # Tema, palet warna, dan konfigurasi konstan
│   └── hooks/                  # Custom React hooks
├── app.json                    # Konfigurasi aplikasi Expo
├── package.json                # Dependensi modul & script npm
├── tsconfig.json               # Konfigurasi compiler TypeScript
└── README.md                   # Dokumentasi resmi proyek PRAKTI
```
