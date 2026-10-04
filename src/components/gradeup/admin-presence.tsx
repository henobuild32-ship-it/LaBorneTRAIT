'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
} from 'recharts';
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Users,
  UserCheck,
  UserX,
  RefreshCw,
  Download,
  Filter,
  MapPin,
  Calendar,
  FileText,
  FileDown,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { DocumentImportDialog } from '@/components/gradeup/document-import-dialog';
import type { CsvObject } from '@/lib/csv';

interface PresenceRecord {
  id: string;
  date: string;
  heureArrivee: string;
  statut: 'PRESENT' | 'RETARD' | 'JUSTIFIE' | 'ABSENT';
  justification?: string;
  latitude?: number;
  longitude?: number;
  user: {
    id: string;
    fullName: string;
    role: string;
    photoUrl?: string;
    classEnrollments?: { class: { name: string } }[];
  };
}

interface DailyChart {
  date: string;
  present: number;
  retard: number;
  justifie: number;
  absent: number;
}

interface TodayStats {
  total: number;
  totalStudents: number;
  totalTeachers: number;
  presents: number;
  retards: number;
  justifies: number;
  absents: number;
  tauxPresence: number;
  date: string;
}

const statutConfig = {
  PRESENT:  { label: 'Présent',  color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2, dot: 'bg-emerald-500' },
  RETARD:   { label: 'Retard',   color: 'bg-amber-100 text-amber-700',     icon: Clock,         dot: 'bg-amber-500'  },
  JUSTIFIE: { label: 'Justifié', color: 'bg-blue-100 text-blue-700',       icon: AlertCircle,   dot: 'bg-blue-500'   },
  ABSENT:   { label: 'Absent',   color: 'bg-red-100 text-red-700',         icon: XCircle,       dot: 'bg-red-500'    },
};

// ─── PDF Export (jsPDF) ────────────────────────────────────────────────────────
async function exportPDF(
  presences: PresenceRecord[],
  stats: TodayStats | null,
  schoolName: string
) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const today   = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const dateStr = new Date().toISOString().split('T')[0];
  const W = 210; // A4 width mm

  // ── Header band ──────────────────────────────────────────────────────────────
  doc.setFillColor(37, 99, 235); // blue-600
  doc.rect(0, 0, W, 40, 'F');

  doc.setFillColor(79, 70, 229); // indigo accent strip
  doc.rect(0, 36, W, 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('RAPPORT DE PRÉSENCE', W / 2, 16, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(schoolName.toUpperCase(), W / 2, 25, { align: 'center' });
  doc.text(today.charAt(0).toUpperCase() + today.slice(1), W / 2, 33, { align: 'center' });

  // ── Stats summary boxes ────────────────────────────────────────────────────
  let y = 52;
  if (stats) {
    const boxes = [
      { label: 'Taux présence', value: `${stats.tauxPresence}%`, r: 16, g: 185, b: 129 },
      { label: 'Présents',       value: String(stats.presents),  r: 34,  g: 197, b: 94  },
      { label: 'Retards',        value: String(stats.retards),   r: 245, g: 158, b: 11  },
      { label: 'Absents',        value: String(stats.absents),   r: 239, g: 68,  b: 68  },
    ];
    const bW = 42, bH = 22, gap = 4;
    const startX = (W - (boxes.length * bW + (boxes.length - 1) * gap)) / 2;

    boxes.forEach((b, i) => {
      const bx = startX + i * (bW + gap);
      doc.setFillColor(b.r, b.g, b.b);
      doc.roundedRect(bx, y, bW, bH, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(b.value, bx + bW / 2, y + 11, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(b.label, bx + bW / 2, y + 18, { align: 'center' });
    });

    doc.setTextColor(107, 114, 128);
    doc.setFontSize(8);
    doc.text(
      `${stats.totalStudents} élève(s) • ${stats.totalTeachers} professeur(s) • Total: ${stats.total}`,
      W / 2, y + 28, { align: 'center' }
    );
    y += 34;
  }

  // ── Divider ───────────────────────────────────────────────────────────────
  doc.setDrawColor(229, 231, 235);
  doc.line(14, y, W - 14, y);
  y += 6;

  // ── Table header ─────────────────────────────────────────────────────────
  const cols = { nom: 14, role: 75, classe: 100, heure: 130, statut: 155, justif: 175 };

  doc.setFillColor(37, 99, 235);
  doc.rect(14, y, W - 28, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('NOM COMPLET',   cols.nom + 1,    y + 5.5);
  doc.text('RÔLE',          cols.role + 1,   y + 5.5);
  doc.text('CLASSE',        cols.classe + 1, y + 5.5);
  doc.text('HEURE',         cols.heure + 1,  y + 5.5);
  doc.text('STATUT',        cols.statut + 1, y + 5.5);
  doc.text('JUSTIFICATION', cols.justif + 1, y + 5.5);
  y += 10;

  // ── Table rows ────────────────────────────────────────────────────────────
  const statutColors: Record<string, [number, number, number]> = {
    PRESENT:  [16,  185, 129],
    RETARD:   [245, 158, 11],
    JUSTIFIE: [59,  130, 246],
    ABSENT:   [239, 68,  68],
  };

  presences.forEach((p, idx) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    const isEven = idx % 2 === 0;
    if (isEven) {
      doc.setFillColor(249, 250, 251);
      doc.rect(14, y - 1, W - 28, 8, 'F');
    }

    const classe = p.user.classEnrollments?.[0]?.class?.name || '-';
    const heure  = p.heureArrivee ? new Date(p.heureArrivee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-';
    const role   = p.user.role === 'STUDENT' ? 'Élève' : 'Professeur';
    const justif = p.justification ? p.justification.slice(0, 25) : '-';
    const sc     = statutColors[p.statut] || [107, 114, 128];

    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(p.user.fullName.slice(0, 28), cols.nom + 1,    y + 5);
    doc.text(role,                          cols.role + 1,   y + 5);
    doc.text(classe.slice(0, 16),           cols.classe + 1, y + 5);
    doc.text(heure,                         cols.heure + 1,  y + 5);

    // Statut badge
    doc.setFillColor(...sc);
    doc.roundedRect(cols.statut, y + 1, 18, 5, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text((statutConfig[p.statut]?.label || p.statut).toUpperCase(), cols.statut + 9, y + 4.5, { align: 'center' });

    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(justif, cols.justif + 1, y + 5);

    y += 8;
  });

  // ── Footer ────────────────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 285, W, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`LaBorneTRAIT — Rapport généré le ${today} • Page ${i}/${pages}`, W / 2, 292, { align: 'center' });
  }

  doc.save(`rapport_presence_${dateStr}.pdf`);
  toast.success('📄 Rapport PDF téléchargé');
}

// ─── WORD Export (docx) ───────────────────────────────────────────────────────
async function exportWORD(
  presences: PresenceRecord[],
  stats: TodayStats | null,
  schoolName: string
) {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, AlignmentType, WidthType, ShadingType,
    BorderStyle, HeightRule,
  } = await import('docx');

  const today   = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const dateStr = new Date().toISOString().split('T')[0];

  const BLUE  = '2563EB';
  const INDIGO = '4F46E5';
  const WHITE  = 'FFFFFF';
  const GREY   = 'F9FAFB';
  const DARK   = '1F2937';

  const headerCell = (text: string) =>
    new TableCell({
      shading: { fill: BLUE, type: ShadingType.SOLID, color: BLUE },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: text.toUpperCase(), bold: true, color: WHITE, size: 16 })],
      })],
    });

  const dataCell = (text: string, bold = false, shade = false) =>
    new TableCell({
      shading: shade ? { fill: GREY, type: ShadingType.SOLID, color: GREY } : undefined,
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({
        children: [new TextRun({ text, bold, color: DARK, size: 18 })],
      })],
    });

  const statutCell = (statut: string, shade: boolean) => {
    const labelMap: Record<string, string> = { PRESENT: 'Présent', RETARD: 'Retard', JUSTIFIE: 'Justifié', ABSENT: 'Absent' };
    const colorMap: Record<string, string> = { PRESENT: '10B981', RETARD: 'F59E0B', JUSTIFIE: '3B82F6', ABSENT: 'EF4444' };
    const fill = colorMap[statut] || '6B7280';
    return new TableCell({
      shading: shade ? { fill: GREY, type: ShadingType.SOLID, color: GREY } : undefined,
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: labelMap[statut] || statut, bold: true, color: fill, size: 17 })],
      })],
    });
  };

  const tableRows = [
    new TableRow({
      tableHeader: true,
      height: { value: 500, rule: HeightRule.EXACT },
      children: [
        headerCell('Nom complet'),
        headerCell('Rôle'),
        headerCell('Classe'),
        headerCell('Heure'),
        headerCell('Statut'),
        headerCell('Justification'),
      ],
    }),
    ...presences.map((p, i) => {
      const shade = i % 2 === 0;
      const classe = p.user.classEnrollments?.[0]?.class?.name || '-';
      const heure  = new Date(p.heureArrivee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      return new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          dataCell(p.user.fullName, true, shade),
          dataCell(p.user.role === 'STUDENT' ? 'Élève' : 'Professeur', false, shade),
          dataCell(classe, false, shade),
          dataCell(heure, false, shade),
          statutCell(p.statut, shade),
          dataCell(p.justification || '-', false, shade),
        ],
      });
    }),
  ];

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Calibri' } } },
    },
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
      children: [
        // ── Title ──
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: 'RAPPORT DE PRÉSENCE', bold: true, size: 36, color: BLUE, font: 'Calibri' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [new TextRun({ text: schoolName.toUpperCase(), bold: true, size: 24, color: INDIGO })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: today.charAt(0).toUpperCase() + today.slice(1), size: 20, color: '6B7280' })],
        }),

        // ── Stats summary ──
        ...(stats ? [
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({ text: '📊  Résumé du jour  ', bold: true, size: 22, color: DARK }),
              new TextRun({ text: `Taux de présence : ${stats.tauxPresence}%`, size: 20, color: '10B981', bold: true }),
              new TextRun({ text: `   •   ✅ Présents : ${stats.presents}`, size: 20, color: DARK }),
              new TextRun({ text: `   •   ⚠️ Retards : ${stats.retards}`, size: 20, color: DARK }),
              new TextRun({ text: `   •   ❌ Absents : ${stats.absents}`, size: 20, color: DARK }),
              new TextRun({ text: `   •   📝 Justifiés : ${stats.justifies}`, size: 20, color: DARK }),
            ],
          }),
          new Paragraph({
            spacing: { after: 300 },
            children: [
              new TextRun({ text: `Total : ${stats.total} personnes (${stats.totalStudents} élèves · ${stats.totalTeachers} professeurs)`, size: 18, color: '6B7280' }),
            ],
          }),
        ] : []),

        // ── Table ──
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows,
        }),

        // ── Footer ──
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
          children: [new TextRun({ text: `Document généré par LaBorneTRAIT • ${today}`, size: 16, color: '9CA3AF', italics: true })],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rapport_presence_${dateStr}.docx`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('📝 Rapport WORD téléchargé');
}

export default function AdminPresence() {
  const user = useAppStore((s) => s.user);
  const schoolName = useAppStore((s) => s.user?.school?.name || 'Mon École');
  const [todayPresences, setTodayPresences] = useState<PresenceRecord[]>([]);
  const [chartData, setChartData] = useState<DailyChart[]>([]);
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statutFilter, setStatutFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingWORD, setExportingWORD] = useState(false);
  const [schoolCoords, setSchoolCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [coordsInput, setCoordsInput] = useState({ latitude: '', longitude: '' });
  const [savingCoords, setSavingCoords] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.schoolId) return;
    try {
      setRefreshing(true);
      const [todayRes, histRes, configRes] = await Promise.all([
        fetch(`/api/presence/aujourdhui?schoolId=${user.schoolId}`).then((r) => r.json()),
        fetch(`/api/presence/historique?schoolId=${user.schoolId}&days=30`).then((r) => r.json()),
        fetch(`/api/config?schoolId=${user.schoolId}`).then((r) => r.json()),
      ]);
      setTodayPresences(todayRes.presences || []);
      setStats(todayRes.stats || null);
      setChartData(histRes.chartData || []);
      const cfg = configRes.config;
      if (cfg) {
        setSchoolCoords({ lat: cfg.latitude, lng: cfg.longitude });
        if (cfg.latitude) setCoordsInput({ latitude: String(cfg.latitude), longitude: String(cfg.longitude) });
      }
    } catch {
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.schoolId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const saveCoords = async () => {
    if (!user?.schoolId) return;
    setSavingCoords(true);
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: user.schoolId, latitude: coordsInput.latitude, longitude: coordsInput.longitude }),
      });
      if (res.ok) {
        toast.success('Coordonnées GPS enregistrées ✅');
        setSchoolCoords({ lat: parseFloat(coordsInput.latitude), lng: parseFloat(coordsInput.longitude) });
      } else {
        toast.error('Erreur lors de la sauvegarde');
      }
    } catch { toast.error('Erreur réseau'); }
    finally { setSavingCoords(false); }
  };

  const validateJustification = async (presenceId: string) => {
    if (!user?.id) return;
    try {
      const res = await fetch('/api/presence/historique', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presenceId, adminId: user.id, statut: 'JUSTIFIE' }),
      });
      if (res.ok) { toast.success('Justification validée'); fetchData(); }
    } catch { toast.error('Erreur lors de la validation'); }
  };

  const handleImportPresences = async (rows: CsvObject[]) => {
    if (!user?.schoolId) return;
    setImporting(true);
    try {
      const res = await fetch('/api/presence/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: user.schoolId, rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "L'import a échoué");
      (data.errors || []).forEach((message: string) => toast.warning(message));
      const summary =
        `${data.created} présence(s) importée(s)` +
        (data.updated ? `, ${data.updated} mise(s) à jour` : '');
      if (data.created > 0 || data.updated > 0) {
        toast.success(summary);
        fetchData();
      } else {
        toast.error('Aucune ligne importée');
      }
      if (!data.errors || data.errors.length === 0) setShowImport(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'import");
      throw error;
    } finally {
      setImporting(false);
    }
  };

  const exportCSV = () => {
    const rows = [
      ['Nom', 'Rôle', 'Classe', 'Date', 'Heure', 'Statut', 'Justification'],
      ...filteredPresences.map((p) => [
        p.user.fullName,
        p.user.role,
        p.user.classEnrollments?.[0]?.class?.name || '-',
        new Date(p.date).toLocaleDateString('fr-FR'),
        new Date(p.heureArrivee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        p.statut,
        p.justification || '',
      ]),
    ];
    const csv = rows.map((r) => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presences_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export CSV téléchargé');
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try { await exportPDF(filteredPresences, stats, schoolName); }
    catch { toast.error('Erreur lors de la génération du PDF'); }
    finally { setExportingPDF(false); }
  };

  const handleExportWORD = async () => {
    setExportingWORD(true);
    try { await exportWORD(filteredPresences, stats, schoolName); }
    catch { toast.error('Erreur lors de la génération du WORD'); }
    finally { setExportingWORD(false); }
  };

  const filteredPresences = todayPresences.filter((p) => {
    if (roleFilter !== 'ALL' && p.user.role !== roleFilter) return false;
    if (statutFilter !== 'ALL' && p.statut !== statutFilter) return false;
    if (searchQuery && !p.user.fullName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const formattedChartData = chartData.slice(-14).map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
  }));

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Module de Présence</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suivi en temps réel • {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)} disabled={importing}>
            <Upload className="w-4 h-4 mr-2" />
            {importing ? 'Import...' : 'Importer'}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button
            size="sm"
            onClick={handleExportPDF}
            disabled={exportingPDF}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            <FileText className="w-4 h-4 mr-2" />
            {exportingPDF ? 'PDF...' : 'PDF'}
          </Button>
          <Button
            size="sm"
            onClick={handleExportWORD}
            disabled={exportingWORD}
            className="bg-blue-700 hover:bg-blue-800 text-white"
          >
            <FileDown className="w-4 h-4 mr-2" />
            {exportingWORD ? 'WORD...' : 'WORD'}
          </Button>
        </div>
      </div>

      {/* GPS Configuration */}
      <Card className="border-2 border-blue-100 dark:border-blue-900/30 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            Géolocalisation de l'École
            {schoolCoords.lat !== null ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-0 ml-2">✅ Configuré</Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-700 border-0 ml-2">⚠️ Non configuré</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Définissez les coordonnées GPS de l'école pour valider le périmètre de pointage (rayon 300m).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Latitude</label>
              <Input placeholder="ex: -4.322447" value={coordsInput.latitude}
                onChange={(e) => setCoordsInput((c) => ({ ...c, latitude: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Longitude</label>
              <Input placeholder="ex: 15.322136" value={coordsInput.longitude}
                onChange={(e) => setCoordsInput((c) => ({ ...c, longitude: e.target.value }))} className="h-9 text-sm" />
            </div>
            <Button onClick={saveCoords} disabled={savingCoords || !coordsInput.latitude || !coordsInput.longitude}
              size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-9">
              {savingCoords ? 'Sauvegarde...' : 'Enregistrer GPS'}
            </Button>
            {schoolCoords.lat !== null && (
              <p className="text-xs text-muted-foreground w-full">
                📍 Position actuelle : {schoolCoords.lat?.toFixed(6)}, {schoolCoords.lng?.toFixed(6)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Taux de présence', value: `${stats.tauxPresence}%`,  sub: `${stats.presents + stats.retards + stats.justifies} / ${stats.total}`, icon: UserCheck,   color: 'from-emerald-500 to-teal-500'  },
            { label: 'Présents',         value: stats.presents,             sub: 'À l\'heure',  icon: CheckCircle2, color: 'from-green-500 to-emerald-500'  },
            { label: 'Retards',          value: stats.retards,              sub: 'Après 8h00',  icon: Clock,        color: 'from-amber-500 to-orange-500'   },
            { label: 'Absents',          value: stats.absents,              sub: 'Non pointés', icon: UserX,        color: 'from-red-500 to-rose-500'       },
          ].map((stat) => (
            <Card key={stat.label} className="relative overflow-hidden border-0 shadow-md">
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-10`} />
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
                  </div>
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.color} text-white shadow-sm`}>
                    <stat.icon className="w-4 h-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Chart */}
      {formattedChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Évolution sur 14 jours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={formattedChartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <ReTooltip />
                <Legend />
                <Bar dataKey="present"  name="Présents"  fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="retard"   name="Retards"   fill="#f59e0b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="justifie" name="Justifiés" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Today's List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              Pointages d'aujourd'hui
              <Badge variant="secondary">{filteredPresences.length}</Badge>
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 w-40 text-sm" />
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-8 w-32 text-sm">
                  <Filter className="w-3 h-3 mr-1" /><SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous rôles</SelectItem>
                  <SelectItem value="STUDENT">Élèves</SelectItem>
                  <SelectItem value="TEACHER">Professeurs</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statutFilter} onValueChange={setStatutFilter}>
                <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous statuts</SelectItem>
                  <SelectItem value="PRESENT">Présent</SelectItem>
                  <SelectItem value="RETARD">Retard</SelectItem>
                  <SelectItem value="JUSTIFIE">Justifié</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredPresences.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserX className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucun pointage enregistré pour le moment</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredPresences.map((p) => {
                  const cfg = statutConfig[p.statut] || statutConfig.ABSENT;
                  const classe = p.user.classEnrollments?.[0]?.class?.name;
                  const initials = p.user.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors">
                      <Avatar className="h-9 w-9 shrink-0">
                        {p.user.photoUrl && <AvatarImage src={p.user.photoUrl} alt={p.user.fullName} />}
                        <AvatarFallback className="text-xs font-bold">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.user.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.user.role === 'STUDENT' ? `Élève${classe ? ` • ${classe}` : ''}` : 'Professeur'}
                        </p>
                        {p.justification && <p className="text-xs text-blue-600 mt-0.5 truncate">💬 {p.justification}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {new Date(p.heureArrivee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <Badge className={`${cfg.color} border-0 text-xs`}>{cfg.label}</Badge>
                        {p.justification && p.statut !== 'JUSTIFIE' && (
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => validateJustification(p.id)}>
                            Valider
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <DocumentImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        title="Importer des présences"
        description="Préparez un document Word ou PDF avec un tableau (ou photographiez-le) : chaque ligne devient une présence enregistrée."
        expectedColumns={['Date', 'Élève', 'Statut', 'Heure', 'Justification']}
        sampleRows={[
          ['02/10/2026', 'Moussa Traoré', 'Présent', '07:55', ''],
          ['02/10/2026', 'Awa Diallo', 'Retard', '08:20', 'Embouteillage'],
        ]}
        columnHints={[
          { header: 'Date', hint: 'JJ/MM/AAAA ou AAAA-MM-JJ' },
          { header: 'Élève', hint: "Nom complet ou matricule de l'élève" },
          { header: 'Statut', hint: 'Présent, Absent, Retard ou Justifié' },
          { header: 'Heure', hint: 'HH:MM (facultatif)' },
          { header: 'Justification', hint: "Motif en cas d'absence/retard (facultatif)" },
        ]}
        onImport={handleImportPresences}
      />
    </div>
  );
}
