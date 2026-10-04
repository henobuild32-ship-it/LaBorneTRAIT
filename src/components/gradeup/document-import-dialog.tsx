'use client';

import { useRef, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, FileText, Loader2, Smartphone, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CsvObject } from '@/lib/csv';

export interface DocumentImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Colonnes attendues dans le document (1re ligne du tableau). */
  expectedColumns: string[];
  /** Exemple de contenu attendu, affiché dans le dialogue. */
  sampleRows?: (string | number)[][];
  columnHints?: { header: string; hint: string }[];
  /** Reçoit les lignes du document sélectionné ; peut lancer une erreur affichée dans le dialogue. */
  onImport: (rows: CsvObject[]) => Promise<void>;
}

interface ParsedResponse {
  fileName: string;
  kind: 'pdf' | 'docx' | 'image' | 'text';
  pages?: number;
  tables: string[][][];
  text: string;
}

function buildRows(table: string[][]): { headers: string[]; rows: CsvObject[] } {
  if (table.length === 0) return { headers: [], rows: [] };
  const headers = table[0].map((cell, index) => (cell || '').trim() || `Colonne ${index + 1}`);
  const rows = table.slice(1).map((cells) => {
    const row: CsvObject = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? '').trim();
    });
    return row;
  });
  return { headers, rows };
}

function pickTable(tables: string[][][]): string[][] {
  const valid = (tables || []).filter((table) => table.length >= 2);
  if (valid.length === 0) return [];
  return valid.reduce((best, table) => (table.length > best.length ? table : best), valid[0]);
}

export function DocumentImportDialog({
  open,
  onOpenChange,
  title,
  description,
  expectedColumns,
  sampleRows,
  columnHints,
  onImport,
}: DocumentImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<CsvObject[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);

  const reset = () => {
    setFileName('');
    setRows([]);
    setHeaders([]);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleClose = (next: boolean) => {
    if (importing || reading) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    setError('');
    setRows([]);
    setHeaders([]);
    setReading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/imports/parse', { method: 'POST', body: form });
      const data = (await res.json()) as ParsedResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Impossible de lire ce document.');

      const table = pickTable(data.tables);
      if (table.length < 2) {
        throw new Error(
          'Aucun tableau détecté dans ce document. Ajoutez un tableau dont la 1re ligne contient les en-têtes de colonnes.'
        );
      }
      const parsed = buildRows(table);
      if (parsed.rows.length === 0) throw new Error('Le tableau est vide : aucune ligne de données trouvée.');

      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setFileName(data.fileName || file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de lire ce document.');
      setFileName('');
    } finally {
      setReading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    setError('');
    try {
      await onImport(rows);
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "L'import a échoué.");
    } finally {
      setImporting(false);
    }
  };

  const preview = rows.slice(0, 5);
  const busy = reading || importing;
  // Tolère un échantillon fourni sous forme d'objet ({ colonne: valeur }).
  const sample = (sampleRows || []).map((row) =>
    Array.isArray(row) ? row : Object.values(row as Record<string, unknown>).map((value) => String(value ?? ''))
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="w-5 h-5 text-emerald-600" />
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
            <p className="text-sm font-semibold text-emerald-800">1. Structure attendue</p>
            <p className="text-xs text-emerald-900/80">
              Un tableau (Word, PDF ou photo) dont la <strong>1re ligne</strong> contient les colonnes :
            </p>
            <div className="flex flex-wrap gap-1.5">
              {expectedColumns.map((column) => (
                <span key={column} className="rounded-md border border-emerald-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  {column}
                </span>
              ))}
            </div>
            {sample.length > 0 && (
              <div className="overflow-x-auto rounded-md border border-emerald-200 bg-white/70">
                <table className="w-full text-[11px]">
                  <thead className="bg-emerald-100/70 text-emerald-900">
                    <tr>
                      {expectedColumns.map((column) => (
                        <th key={column} className="px-2 py-1 text-left font-semibold whitespace-nowrap">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sample.map((row, index) => (
                      <tr key={index} className="border-t border-emerald-100">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-2 py-1 whitespace-nowrap">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {columnHints && columnHints.length > 0 && (
              <ul className="text-xs text-emerald-900/80 space-y-0.5 pt-1">
                {columnHints.map((hint) => (
                  <li key={hint.header}>
                    <span className="font-semibold">{hint.header}</span> — {hint.hint}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-blue-800">2. Sélectionnez le document</p>
            <p className="text-xs text-blue-900/80">
              PDF, Word (.docx) ou photo — depuis l&apos;ordinateur, les fichiers ou la galerie du téléphone.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {reading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Smartphone className="w-4 h-4 mr-1.5" />}
                Fichier ou galerie
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
                disabled={busy}
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="w-4 h-4 mr-1.5" />
                Prendre une photo
              </Button>
              {fileName && !reading && (
                <span className="text-xs text-blue-900 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  {fileName} · {rows.length} ligne{rows.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {rows.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">
                3. Aperçu ({rows.length} ligne{rows.length > 1 ? 's' : ''}{rows.length > 5 ? ', 5 premières affichées' : ''})
              </p>
              <div className="rounded-xl border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      {headers.map((header) => (
                        <th key={header} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, index) => (
                      <tr key={index} className="border-t">
                        {headers.map((header) => (
                          <td key={header} className="px-3 py-1.5 whitespace-nowrap max-w-[220px] truncate">
                            {row[header]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={busy}>
            Annuler
          </Button>
          <Button
            onClick={handleImport}
            disabled={rows.length === 0 || busy}
            className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600"
          >
            {importing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Import en cours...</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" />Importer {rows.length > 0 ? `${rows.length} ligne${rows.length > 1 ? 's' : ''}` : ''}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DocumentImportDialog;
