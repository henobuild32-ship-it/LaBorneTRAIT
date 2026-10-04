import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';
import mammoth from 'mammoth';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_SIZE = 15 * 1024 * 1024;

export type ParsedTable = string[][];

const ALLOWED: Record<string, 'pdf' | 'docx' | 'image' | 'text'> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
  'text/plain': 'text',
};

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
      .replace(/<[^>]+>/g, '')
  ).replace(/\s+/g, ' ').trim();
}

function htmlToTables(html: string): ParsedTable[] {
  const tables: ParsedTable[] = [];
  const tableMatches = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || [];
  for (const tableHtml of tableMatches) {
    const rows: string[][] = [];
    const trMatches = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    for (const trHtml of trMatches) {
      const cells: string[] = [];
      const tdMatches = trHtml.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
      for (const tdHtml of tdMatches) {
        const inner = tdHtml.replace(/^<t[dh][^>]*>/i, '').replace(/<\/t[dh]>$/i, '');
        cells.push(htmlToText(inner));
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length > 0) tables.push(rows);
  }
  return tables;
}

/**
 * À défaut de tableau structuré, on découpe le texte en cellules
 * (tabulation ou 2+ espaces consécutifs) pour récupérer un tableau exploitable.
 */
function textToTables(text: string): ParsedTable[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const rows = lines.map((line) => line.split(/\t|\s{2,}/).map((cell) => cell.trim()));
  const widths = rows.map((row) => row.length);
  const multiColumn = widths.filter((w) => w >= 2).length;

  if (multiColumn >= 2 && multiColumn >= Math.ceil(rows.length / 2)) {
    return [rows];
  }
  return [];
}

interface PdfItem {
  str: string;
  x: number;
  y: number;
  w: number;
}

/** Écart horizontal (en points) à partir duquel deux blocs de texte deviennent des cellules distinctes. */
const CELL_GAP = 6;
/** Tolérance (en points) pour regrouper les débuts de colonnes. */
const COLUMN_TOLERANCE = 14;

function buildLineCells(items: PdfItem[]): { cells: string[]; starts: number[] } {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const cells: string[] = [];
  const starts: number[] = [];
  let current = '';
  let currentStart = 0;
  let lastEnd = -Infinity;
  let gap = 0;

  const flush = () => {
    const value = current.trim();
    if (value) {
      cells.push(value);
      starts.push(currentStart);
    }
    current = '';
    gap = 0;
  };

  for (const item of sorted) {
    const text = (item.str || '').trim();
    if (!text) {
      gap += item.w || 0;
      continue;
    }
    const distance = item.x - lastEnd;
    if (current && (gap > CELL_GAP || distance > CELL_GAP)) flush();
    if (!current) currentStart = item.x;
    current += (current && gap <= CELL_GAP ? ' ' : '') + text;
    gap = 0;
    lastEnd = item.x + item.w;
  }
  flush();
  return { cells, starts };
}

function clusterColumns(starts: number[]): number[] {
  const sorted = [...starts].sort((a, b) => a - b);
  const columns: number[] = [];
  let group: number[] = [];
  const closeGroup = () => {
    if (group.length > 0) {
      columns.push(group.reduce((sum, value) => sum + value, 0) / group.length);
      group = [];
    }
  };
  for (const value of sorted) {
    if (group.length === 0 || value - group[group.length - 1] <= COLUMN_TOLERANCE) group.push(value);
    else closeGroup();
  }
  closeGroup();
  return columns;
}

function alignRow(cells: string[], starts: number[], columns: number[]): string[] {
  const dense = columns.map(() => '');
  cells.forEach((cell, index) => {
    const start = starts[index];
    let best = 0;
    let bestDistance = Infinity;
    columns.forEach((column, columnIndex) => {
      const distance = Math.abs(column - start);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = columnIndex;
      }
    });
    if (bestDistance <= COLUMN_TOLERANCE * 3) dense[best] = cell;
  });
  return dense;
}

async function parsePdf(buffer: Buffer): Promise<{ tables: ParsedTable[]; text: string; pages: number }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  try {
    const pageRows: { cells: string[]; starts: number[] }[][] = [];
    const columnStarts: number[] = [];
    const textLines: string[] = [];

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const items: PdfItem[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const transform = item.transform as number[] | undefined;
        items.push({
          str: item.str,
          x: transform?.[4] ?? 0,
          y: transform?.[5] ?? 0,
          w: Number(item.width) || 0,
        });
      }
      items.sort((a, b) => b.y - a.y || a.x - b.x);

      const lines: PdfItem[][] = [];
      for (const item of items) {
        const lastLine = lines[lines.length - 1];
        if (lastLine && Math.abs(lastLine[0].y - item.y) <= 3) lastLine.push(item);
        else lines.push([item]);
      }

      const rows = lines.map(buildLineCells).filter((row) => row.cells.length > 0);
      pageRows.push(rows);
      for (const row of rows) {
        textLines.push(row.cells.join(' '));
        columnStarts.push(...row.starts);
      }
    }

    const columns = clusterColumns(columnStarts);
    let tables: ParsedTable[] = [];
    for (const rows of pageRows) {
      const dense = rows
        .filter((row) => row.cells.length >= 2)
        .map((row) => alignRow(row.cells, row.starts, columns));
      if (dense.length >= 2) tables.push(dense);
    }
    if (tables.length === 0) tables = textToTables(textLines.join('\n'));

    return { tables, text: textLines.join('\n').trim(), pages: doc.numPages };
  } finally {
    await doc.destroy();
  }
}

async function parseDocx(buffer: Buffer): Promise<{ tables: ParsedTable[]; text: string }> {
  const htmlResult = await mammoth.convertToHtml({ buffer });
  const html = htmlResult.value || '';
  const tables = htmlToTables(html);

  const textResult = await mammoth.extractRawText({ buffer });
  const text = (textResult.value || '').trim();
  const finalTables = tables.length > 0 ? tables : textToTables(text);
  return { tables: finalTables, text };
}

async function parseImage(buffer: Buffer): Promise<{ tables: ParsedTable[]; text: string }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Tesseract = require('tesseract.js');
  const result = await Tesseract.recognize(buffer, 'fra');
  const text = (result?.data?.text || '').trim();
  return { tables: textToTables(text), text };
}

// POST /api/imports/parse - lecture d'un document (PDF, Word, photo) en tableau de lignes
export async function POST(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (!['ADMIN', 'TEACHER'].includes(auth.role)) {
      return NextResponse.json({ error: 'Action réservée aux administrateurs et professeurs.' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Fichier requis.' }, { status: 400 });
    }

    const kind = ALLOWED[file.type] || (file.name.toLowerCase().endsWith('.docx') ? 'docx' : undefined);
    if (!kind) {
      return NextResponse.json(
        { error: 'Format non supporté. Utilisez un PDF, un document Word (.docx) ou une photo.' },
        { status: 415 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Fichier trop volumineux (15 Mo maximum).' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let tables: ParsedTable[] = [];
    let text = '';
    let pages = 1;

    if (kind === 'pdf') {
      const parsed = await parsePdf(buffer);
      tables = parsed.tables;
      text = parsed.text;
      pages = parsed.pages;
    } else if (kind === 'docx') {
      const parsed = await parseDocx(buffer);
      tables = parsed.tables;
      text = parsed.text;
    } else if (kind === 'image') {
      const parsed = await parseImage(buffer);
      tables = parsed.tables;
      text = parsed.text;
    } else {
      text = buffer.toString('utf-8');
      tables = textToTables(text);
    }

    if (!text && tables.length === 0) {
      return NextResponse.json(
        { error: 'Aucun contenu lisible dans ce document (essayez une photo plus nette ou un autre fichier).' },
        { status: 422 }
      );
    }

    return NextResponse.json({ fileName: file.name, kind, pages, tables, text });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[POST /api/imports/parse]', err);
    return NextResponse.json(
      { error: 'Impossible de lire ce document. Vérifiez le fichier puis réessayez.' },
      { status: 500 }
    );
  }
}
