'use client';

/**
 * BulletinPrint
 * ─────────────────────────────────────────────────────────────────────────────
 * Bulletin scolaire officiel conforme aux normes du Ministère de l'EPST (RDC).
 * Affiche :
 * - Maxima réels par matière (TJ, Examen, Total, % par matière)
 * - Somme des points obtenus et des points maximums
 * - Pourcentage global officiel (sans moyenne naïve sur 20)
 * - Place dans la classe avec gestion des ex-aequo (ex: "1er ex-aequo / 42")
 * - Décision administrative conforme aux règles configurées (PASSE, REPÊCHAGE, DOUBLE)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, FileText } from 'lucide-react';

interface BulletinPrintProps {
  report: {
    reportNumber: string;
    trimester: string;
    academicYear: string;
    studentName: string;
    studentGender?: string;
    studentBirthDate?: string;
    permanentNumber?: string;
    class?: { name: string; level: string } | null;
    averageGrade: number;
    mention: string;
    classRank?: number | null;
    totalPointsObtained: number;
    totalPointsPossible: number;
    overallPercentage: number;
    gradesData?: Record<string, unknown> | null;
  };
  schoolName?: string;
}

type RawRow = {
  id?: string;
  name?: string;
  courseName?: string;
  maxTJ1?: number;
  maxTJ2?: number;
  maxExam1?: number;
  maxTJ3?: number;
  maxTJ4?: number;
  maxExam2?: number;
  tj1?: string | number;
  tj2?: string | number;
  exam1?: string | number;
  tj3?: string | number;
  tj4?: string | number;
  exam2?: string | number;
  totalS1?: number;
  maxS1?: number;
  totalS2?: number;
  maxS2?: number;
  totalAnnual?: number;
  maxAnnual?: number;
  percentageAnnual?: number;
  score?: string | number;
  maxScore?: string | number;
  normalizedScore?: string | number;
  coefficient?: string | number;
};

export default function BulletinPrint({ report, schoolName }: BulletinPrintProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const gd = report.gradesData as Record<string, any> | undefined;
  const metadata = (gd?.metadata as Record<string, any>) || {};
  const rawRows: RawRow[] = Array.isArray(gd?.rawRows) ? gd.rawRows : [];
  const serialized: RawRow[] = Array.isArray(gd?.serializedGrades) ? gd.serializedGrades : [];

  const trimesterLabel =
    metadata.trimesterText ||
    (report.trimester === '1'
      ? '1er TRIMESTRE / SEMESTRE 1'
      : report.trimester === '2'
      ? '2e TRIMESTRE / SEMESTRE 2'
      : report.trimester === '3'
      ? '3e TRIMESTRE / BILAN ANNUEL'
      : `TRIMESTRE ${report.trimester}`);

  const displayRows: RawRow[] =
    rawRows.length > 0
      ? rawRows
      : serialized.map((s) => ({
          name: s.courseName || s.name || '—',
          maxTJ1: 10,
          maxTJ2: 10,
          maxExam1: 20,
          tj1: s.score,
          tj2: undefined,
          exam1: undefined,
          totalAnnual: Number(s.score) || 0,
          maxAnnual: Number(s.maxScore) || 40,
          percentageAnnual: s.normalizedScore ? Number(s.normalizedScore) * 5 : 0,
          coefficient: s.coefficient,
        }));

  const rankDisplay =
    metadata.placeInClass ||
    (report.classRank && report.classRank > 0
      ? `${report.classRank}${report.classRank === 1 ? 'er' : 'e'} / ${metadata.effectif || '—'}`
      : '—');

  const decisionText = metadata.decisionText || (report.overallPercentage >= 50 ? 'PASSE' : 'DOUBLE');

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bulletin RDC - ${(report.studentName || 'Eleve').replace(/\s+/g, '_')}</title>
          <meta charset="utf-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: white !important; font-family: 'Times New Roman', Times, serif, sans-serif; }
            @page { size: A4 landscape; margin: 6mm 8mm; }
            .bulletin-paper {
              width: 100% !important;
              padding: 4mm 6mm !important;
              border: 2px solid #000000 !important;
              background: white !important;
              color: #000000 !important;
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              page-break-inside: avoid !important;
            }
            .b-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 2mm; margin-bottom: 2mm; }
            .b-header h2 { font-size: 13px; letter-spacing: 1px; text-transform: uppercase; margin: 1mm 0; }
            .b-header p { font-size: 10px; margin: 0.5mm 0; }
            .b-school { display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin: 1.5mm 0; }
            .b-info { display: flex; justify-content: space-between; flex-wrap: wrap; font-size: 10px; border: 1px solid #000; padding: 1.5mm; margin-bottom: 2mm; }
            .b-info div { width: 32%; margin: 0.5mm 0; }
            table { width: 100%; border-collapse: collapse; }
            table th, table td { border: 1px solid #000; padding: 2px; font-size: 9px; text-align: center; height: 16px; }
            table th { text-transform: uppercase; font-weight: bold; background: #f0f0f0; }
            td.branch { text-align: left; padding-left: 5px; font-weight: bold; }
            .b-summary { display: flex; justify-content: space-between; flex-wrap: wrap; border: 1px solid #000; border-top: none; padding: 2mm; font-size: 10px; background: #fafafa; }
            .b-summary div { width: 24%; margin: 0.5mm 0; font-weight: bold; }
            .b-decision { border: 2px solid #000; padding: 2mm; margin-top: 2mm; text-align: center; font-size: 11px; font-weight: bold; }
            .b-sign { display: flex; justify-content: space-between; margin-top: 4mm; font-size: 10px; text-align: center; }
            .b-sign .sig { width: 30%; }
            .sig-name { margin-top: 10mm; font-weight: bold; text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="bulletin-paper">${printContent.innerHTML}</div>
          <script>
            window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 300); };
          </script>
        </body>
      </html>
    `);

    Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).forEach((el) => {
      printWindow.document.head.appendChild(el.cloneNode(true));
    });
    printWindow.document.close();
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="no-print flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-semibold">Bulletin Scolaire RDC · {report.reportNumber}</span>
        </div>
        <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 font-bold shadow-md">
          <Printer className="h-4 w-4" />
          Imprimer le Bulletin (A4)
        </Button>
      </div>

      {/* Printable sheet */}
      <div className="overflow-x-auto bg-neutral-200/60 p-4 md:p-8 flex justify-center rounded-2xl">
        <div ref={printRef} className="bulletin-paper w-full bg-white text-black p-6 border-2 border-black rounded-lg shadow-xl" style={{ maxWidth: '280mm' }}>
          {/* Header RDC */}
          <div className="text-center border-b-2 border-black pb-3 mb-3">
            <h2 className="text-sm font-bold tracking-wider uppercase">République Démocratique du Congo</h2>
            <p className="text-xs uppercase font-medium text-neutral-800">Ministère de l'Enseignement Primaire, Secondaire et Technique (EPST)</p>
            <div className="flex justify-between items-center text-xs font-bold mt-2 pt-1 border-t border-neutral-300">
              <span>Établissement : {metadata.schoolName || schoolName || 'École Conventionnée RDC'}</span>
              <span>Province : {metadata.province || 'KINSHASA'}</span>
              <span>Année Scolaire : {report.academicYear}</span>
            </div>
            <p className="text-xs font-extrabold mt-1 uppercase tracking-wider text-blue-900">BULLETIN SCOLAIRE OFFICIEL — {trimesterLabel}</p>
          </div>

          {/* Student info */}
          <div className="grid grid-cols-3 gap-2 text-xs border border-black p-3 mb-3 bg-neutral-50/50">
            <div><strong>Nom de l'élève :</strong> {report.studentName}</div>
            <div><strong>Sexe :</strong> {report.studentGender || metadata.studentGender || 'M'}</div>
            <div><strong>Classe :</strong> {report.class?.name || metadata.studentClass || '—'}</div>
            <div><strong>N° Permanent / Matricule :</strong> {report.permanentNumber || metadata.permanentNumber || '—'}</div>
            <div><strong>N° Bulletin :</strong> {report.reportNumber}</div>
            <div><strong>Date de Naissance :</strong> {report.studentBirthDate || metadata.studentBirthDate || '—'}</div>
          </div>

          {/* Grades Table with Congolese Variable Maxima */}
          <table className="w-full border-collapse border border-black text-xs mb-3">
            <thead>
              <tr className="bg-neutral-100 uppercase text-[10px]">
                <th className="border border-black p-1 w-8">N°</th>
                <th className="border border-black p-1 text-left">Désignation des Branches</th>
                <th className="border border-black p-1 w-14">TJ 1</th>
                <th className="border border-black p-1 w-14">TJ 2</th>
                <th className="border border-black p-1 w-14">Examen 1</th>
                <th className="border border-black p-1 w-16 bg-blue-50/60 font-bold">Total S1</th>
                <th className="border border-black p-1 w-14">TJ 3</th>
                <th className="border border-black p-1 w-14">TJ 4</th>
                <th className="border border-black p-1 w-14">Examen 2</th>
                <th className="border border-black p-1 w-16 bg-blue-50/60 font-bold">Total S2</th>
                <th className="border border-black p-1 w-16 bg-neutral-200 font-extrabold">Total Annuel</th>
                <th className="border border-black p-1 w-16 font-bold">%</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-6 border border-black text-muted-foreground">
                    Aucune note encodée pour cet élève.
                  </td>
                </tr>
              ) : (
                displayRows.map((row, idx) => {
                  const maxS1 = (row.maxTJ1 || 10) + (row.maxTJ2 || 10) + (row.maxExam1 || 20);
                  const maxS2 = (row.maxTJ3 || 10) + (row.maxTJ4 || 10) + (row.maxExam2 || 20);
                  const maxAnnual = row.maxAnnual || maxS1 + maxS2;

                  const s1Score = row.totalS1 !== undefined ? row.totalS1 : ((Number(row.tj1) || 0) + (Number(row.tj2) || 0) + (Number(row.exam1) || 0));
                  const s2Score = row.totalS2 !== undefined ? row.totalS2 : ((Number(row.tj3) || 0) + (Number(row.tj4) || 0) + (Number(row.exam2) || 0));
                  const annualScore = row.totalAnnual !== undefined ? row.totalAnnual : s1Score + s2Score;
                  const pct = maxAnnual > 0 ? Math.round((annualScore / maxAnnual) * 10000) / 100 : 0;

                  return (
                    <tr key={row.id || idx} className="hover:bg-neutral-50 text-center">
                      <td className="border border-black p-1 font-bold">{idx + 1}</td>
                      <td className="border border-black p-1 text-left font-semibold pl-2">{row.name || 'Matière'}</td>
                      <td className="border border-black p-1">
                        {row.tj1 !== undefined && row.tj1 !== '' ? row.tj1 : '—'}
                        <span className="text-[9px] text-neutral-500 ml-0.5">/{row.maxTJ1 || 10}</span>
                      </td>
                      <td className="border border-black p-1">
                        {row.tj2 !== undefined && row.tj2 !== '' ? row.tj2 : '—'}
                        <span className="text-[9px] text-neutral-500 ml-0.5">/{row.maxTJ2 || 10}</span>
                      </td>
                      <td className="border border-black p-1">
                        {row.exam1 !== undefined && row.exam1 !== '' ? row.exam1 : '—'}
                        <span className="text-[9px] text-neutral-500 ml-0.5">/{row.maxExam1 || 20}</span>
                      </td>
                      <td className="border border-black p-1 bg-blue-50/40 font-bold">
                        {s1Score > 0 ? s1Score : '—'}
                        <span className="text-[9px] text-neutral-500 ml-0.5">/{maxS1}</span>
                      </td>
                      <td className="border border-black p-1">
                        {row.tj3 !== undefined && row.tj3 !== '' ? row.tj3 : '—'}
                        <span className="text-[9px] text-neutral-500 ml-0.5">/{row.maxTJ3 || 10}</span>
                      </td>
                      <td className="border border-black p-1">
                        {row.tj4 !== undefined && row.tj4 !== '' ? row.tj4 : '—'}
                        <span className="text-[9px] text-neutral-500 ml-0.5">/{row.maxTJ4 || 10}</span>
                      </td>
                      <td className="border border-black p-1">
                        {row.exam2 !== undefined && row.exam2 !== '' ? row.exam2 : '—'}
                        <span className="text-[9px] text-neutral-500 ml-0.5">/{row.maxExam2 || 20}</span>
                      </td>
                      <td className="border border-black p-1 bg-blue-50/40 font-bold">
                        {s2Score > 0 ? s2Score : '—'}
                        <span className="text-[9px] text-neutral-500 ml-0.5">/{maxS2}</span>
                      </td>
                      <td className="border border-black p-1 bg-neutral-100 font-extrabold text-blue-900">
                        {annualScore > 0 ? annualScore : '—'}
                        <span className="text-[9px] text-neutral-500 ml-0.5">/{maxAnnual}</span>
                      </td>
                      <td className={`border border-black p-1 font-bold ${pct < 50 ? 'text-red-700 bg-red-50/50' : 'text-emerald-700'}`}>
                        {annualScore > 0 ? `${pct}%` : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Totaux & Synthèse RDC */}
          <div className="grid grid-cols-4 gap-2 border border-black p-3 text-xs bg-neutral-50 font-semibold mb-3">
            <div>
              <span className="text-neutral-500 text-[10px] block">TOTAL GÉNÉRAL OBTENU</span>
              <span className="text-base font-extrabold text-blue-900">{report.totalPointsObtained} pts</span>
            </div>
            <div>
              <span className="text-neutral-500 text-[10px] block">MAXIMA GÉNÉRAL TOTAL</span>
              <span className="text-base font-extrabold">{report.totalPointsPossible} pts</span>
            </div>
            <div>
              <span className="text-neutral-500 text-[10px] block">POURCENTAGE RÉEL RDC</span>
              <span className="text-base font-extrabold text-emerald-700">{report.overallPercentage}%</span>
            </div>
            <div>
              <span className="text-neutral-500 text-[10px] block">PLACE / EFFECTIF</span>
              <span className="text-base font-extrabold text-indigo-700">{rankDisplay}</span>
            </div>
          </div>

          {/* Décision du Conseil de Délibération */}
          <div className="border-2 border-black p-2.5 text-center text-xs font-bold uppercase tracking-wider bg-neutral-100 mb-4 flex items-center justify-between px-6">
            <span>MENTION : <strong className="text-blue-900">{report.mention || 'Satisfaction'}</strong></span>
            <span>DÉCISION FINALE DU JURY : <strong className={`text-sm px-3 py-0.5 rounded ${decisionText.includes('PASSE') ? 'bg-emerald-200 text-emerald-900' : decisionText.includes('REPÊCHAGE') ? 'bg-amber-200 text-amber-900' : 'bg-red-200 text-red-900'}`}>{decisionText}</strong></span>
          </div>

          {/* Signatures officielles */}
          <div className="flex justify-between items-center text-center text-xs pt-3 mt-4">
            <div className="w-1/3">
              <p className="font-bold">L'Élève & Parents</p>
              <div className="h-12 border-b border-dotted border-neutral-400 mt-2" />
            </div>
            <div className="w-1/3">
              <p className="font-bold">Le Professeur Titulaire</p>
              <div className="h-12 border-b border-dotted border-neutral-400 mt-2" />
            </div>
            <div className="w-1/3">
              <p className="font-bold">Le Chef d'Établissement (Sceau)</p>
              <div className="h-12 border-b border-dotted border-neutral-400 mt-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

