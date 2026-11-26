/** Baris hasil parsing CSV dengan nomor baris asli (1-indexed). */
export interface CsvRow {
  lineNumber: number;
  raw: Record<string, string>;
  cells: string[];
}

export interface CsvParseResult {
  delimiter: ',' | ';';
  headers: string[];
  rows: CsvRow[];
}

/** Normalisasi nama kolom header agar toleran terhadap spasi, huruf kapital, dan garis bawah. */
export function normalisasiHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function deteksiDelimiter(firstLine: string): ',' | ';' {
  let comma = 0;
  let semi = 0;
  let inQuotes = false;
  for (let i = 0; i < firstLine.length; i += 1) {
    const ch = firstLine[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === ',') comma += 1;
      else if (ch === ';') semi += 1;
    }
  }
  return semi > comma ? ';' : ',';
}

function parseRecords(text: string, delimiter: ',' | ';'): { lineNumber: number; cells: string[] }[] {
  const clean = text.replace(/^\uFEFF/, '');
  const records: { lineNumber: number; cells: string[] }[] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        if (ch === '\n') line += 1;
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(cell);
      records.push({ lineNumber: rowStartLine, cells: row });
      row = [];
      cell = '';
      i += 1;
      line += 1;
      rowStartLine = line;
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell);
      records.push({ lineNumber: rowStartLine, cells: row });
      row = [];
      cell = '';
      line += 1;
      rowStartLine = line;
    } else {
      cell += ch;
    }
  }

  if (inQuotes) {
    throw new Error(`Tanda kutip tidak tertutup pada baris ${rowStartLine}.`);
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    records.push({ lineNumber: rowStartLine, cells: row });
  }

  return records.filter((r) => r.cells.some((value) => value.trim() !== ''));
}

/** Mem-parsing teks CSV (mendukung BOM UTF-8, kutip ganda RFC 4180, dan pemisah koma/titik koma). */
export function parseCsv(text: string): CsvParseResult {
  const normalizedInput = text.replace(/^\uFEFF/, '');
  const firstBreak = normalizedInput.search(/\r?\n/);
  const firstLine = firstBreak === -1 ? normalizedInput : normalizedInput.slice(0, firstBreak);
  const delimiter = deteksiDelimiter(firstLine);
  const records = parseRecords(normalizedInput, delimiter);

  if (records.length === 0) {
    throw new Error('File CSV kosong.');
  }

  const headers = records[0].cells.map(normalisasiHeader);
  if (headers.every((h) => !h)) {
    throw new Error('Header kolom CSV tidak ditemukan.');
  }

  const rows: CsvRow[] = records.slice(1).map((record) => {
    const raw: Record<string, string> = {};
    headers.forEach((header, idx) => {
      if (!header) return;
      raw[header] = (record.cells[idx] ?? '').trim();
    });
    return {
      lineNumber: record.lineNumber,
      raw,
      cells: record.cells.map((c) => c.trim()),
    };
  });

  return { delimiter, headers, rows };
}

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Menghasilkan string CSV standar dengan pemisah koma. */
export function serializeCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map((cell) => escapeCsvCell(String(cell ?? ''))).join(','));
  return `${lines.join('\r\n')}\r\n`;
}
