export type CsvObject = Record<string, string>;

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function sampleLines(text: string): string[] {
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0).slice(0, 10);
}

export function detectDelimiter(text: string): string {
  const candidates = [';', ',', '\t', '|'];
  const lines = sampleLines(stripBom(text));
  let best = ',';
  let bestScore = -1;
  for (const candidate of candidates) {
    const counts = lines.map((line) => line.split(candidate).length - 1);
    if (counts.length === 0) continue;
    const avg = counts.reduce((sum, n) => sum + n, 0) / counts.length;
    const first = counts[0];
    // Le meilleur délimiteur donne un nombre de colonnes stable et > 1
    const score = first > 1 && counts.every((n) => n === first) ? 100 + first : avg;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export function parseCsv(text: string, delimiter?: string): ParsedCsv {
  const clean = stripBom(text);
  const sep = delimiter || detectDelimiter(clean);
  const lines = clean.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = splitLine(lines[0], sep).map((header) => header.replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line) => splitLine(line, sep));
  return { headers, rows };
}

export function toObjects(parsed: ParsedCsv): CsvObject[] {
  return parsed.rows.map((row) => {
    const object: CsvObject = {};
    parsed.headers.forEach((header, index) => {
      object[header] = row[index] ?? '';
    });
    return object;
  });
}

export function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Recherche insensible à la casse et aux accents, sur plusieurs alias possibles. */
export function pickValue(row: CsvObject, aliases: string[]): string {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeKey(key)] = value;
  }
  for (const alias of aliases) {
    const value = normalized[normalizeKey(alias)];
    if (value !== undefined && value !== '') return value;
  }
  return '';
}

export function buildCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (value: string | number): string => {
    const text = String(value ?? '');
    return /[";\n,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.map(escape).join(';'), ...rows.map((row) => row.map(escape).join(';'))].join('\r\n');
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const blob = new Blob(['\uFEFF' + buildCsv(headers, rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Accepte AAAA-MM-JJ, JJ/MM/AAAA, JJ-MM-AAAA, AAAA/MM/JJ. */
export function toIsoDate(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const fr = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (fr) return `${fr[3]}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}`;
  return null;
}

/** Lundi=1 ... Samedi=6 (convention dayOfWeek de l'application). */
export function toDayOfWeek(value: string): number | null {
  const text = value.trim().toLowerCase();
  if (!text) return null;
  const labels: Record<string, number> = {
    lundi: 1, monday: 1,
    mardi: 2, tuesday: 2,
    mercredi: 3, wednesday: 3,
    jeudi: 4, thursday: 4,
    vendredi: 5, friday: 5,
    samedi: 6, saturday: 6,
    dimanche: 0, sunday: 0,
  };
  const direct = labels[text];
  if (direct !== undefined) return direct;
  const short = text.slice(0, 3);
  if (labels[short] !== undefined) return labels[short];
  const num = parseInt(text, 10);
  if (!Number.isNaN(num) && num >= 0 && num <= 7) return num === 7 ? 0 : num;
  return null;
}

/** Normalise une heure HH:MM (accepte "7h30", "07:30", "7.30"). */
export function toTime(value: string): string | null {
  const text = value.trim().toLowerCase();
  if (!text) return null;
  const match = text.match(/^(\d{1,2})[:h.\-](\d{2})/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function toNumber(value: string): number | null {
  const text = value.trim().replace(',', '.').replace(/[^\d.\-]/g, '');
  if (!text) return null;
  const num = parseFloat(text);
  return Number.isNaN(num) ? null : num;
}
