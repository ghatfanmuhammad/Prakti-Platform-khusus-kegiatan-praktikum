import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { serializeCsv } from './csv';

export interface CsvTemplateSpec {
  id: 'lab' | 'praktikan' | 'asprak';
  filename: string;
  dialogTitle: string;
  headers: string[];
  sampleRows: string[][];
}

export const TEMPLATE_LAB: CsvTemplateSpec = {
  id: 'lab',
  filename: 'template_lab_prakti.csv',
  dialogTitle: 'Unduh Template Lab CSV',
  headers: [
    'kode',
    'nama_lab',
    'lokasi',
    'latitude',
    'longitude',
    'radius_meter',
    'toleransi_menit',
    'nominal_denda',
  ],
  sampleRows: [
    ['BD-A', 'Lab A', 'Lab Komputer 1', '-7.050000', '110.440000', '50', '15', '10000'],
    ['BD-B', 'Lab B', 'Lab Komputer 2', '-7.050200', '110.440300', '50', '10', '10000'],
  ],
};

export const TEMPLATE_PRAKTIKAN: CsvTemplateSpec = {
  id: 'praktikan',
  filename: 'template_praktikan_prakti.csv',
  dialogTitle: 'Unduh Template Praktikan CSV',
  headers: ['nim', 'email', 'nama'],
  sampleRows: [
    ['24060122120001', 'praktikan1@students.undip.ac.id', 'Budi Santoso'],
    ['24060122120002', '', 'Siti Rahma'],
  ],
};

export const TEMPLATE_ASPRAK: CsvTemplateSpec = {
  id: 'asprak',
  filename: 'template_asprak_prakti.csv',
  dialogTitle: 'Unduh Template Asprak CSV',
  headers: ['email', 'kode_asprak', 'nama'],
  sampleRows: [
    ['asprak1@staff.undip.ac.id', 'ASP-01', 'Andi Pratama'],
    ['', 'ASP-02', 'Dewi Lestari'],
  ],
};

/** Menghasilkan isi string CSV untuk suatu spesifikasi template. */
export function buatKontenTemplate(template: CsvTemplateSpec): string {
  return serializeCsv(template.headers, template.sampleRows);
}

/** Menghasilkan file CSV template lalu membagikannya / mengunduhnya ke perangkat pengguna. */
export async function unduhTemplateCsv(template: CsvTemplateSpec): Promise<void> {
  const content = buatKontenTemplate(template);

  if (Platform.OS === 'web') {
    const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', template.filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  const file = new File(Paths.cache, template.filename);
  file.create({ overwrite: true });
  await file.write(content);

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Fitur berbagi/simpan file tidak tersedia di perangkat ini.');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: template.dialogTitle,
    UTI: 'public.comma-separated-values-text',
  });
}

export interface FileCsvTerpilih {
  name: string;
  content: string;
}

/** Membuka pemilih dokumen untuk mengambil file CSV lalu membaca isi teksnya. */
export async function pilihFileCsv(): Promise<FileCsvTerpilih | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'application/csv', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  let content: string;
  if (Platform.OS === 'web' && asset.file) {
    content = await asset.file.text();
  } else if (Platform.OS === 'web') {
    const res = await fetch(asset.uri);
    content = await res.text();
  } else {
    content = await new File(asset.uri).text();
  }

  return {
    name: asset.name,
    content,
  };
}
