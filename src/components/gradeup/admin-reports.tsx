'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart3,
  FileText,
  GraduationCap,
  Users,
  TrendingUp,
  Loader2,
  BookOpen,
  Printer,
  Plus,
  Pencil,
  Trash2,
  Stamp,
  Flag,
  RotateCcw,
  Sparkles,
  Save,
  Archive,
  Folder,
  FolderOpen,
  ChevronRight,
  File,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { DocumentImportDialog } from '@/components/gradeup/document-import-dialog';
import type { CsvObject } from '@/lib/csv';

// ==========================================
// TYPES & INTERFACES
// ==========================================
interface ClassItem {
  id: string;
  name: string;
  level: string;
}

interface CourseWithPoints {
  id: string;
  name: string;
  points: number;
  maxScore: number;
  trimester1Weight: number;
  trimester2Weight: number;
}

interface DetailedGradeData {
  id: string;
  courseId: string;
  courseName: string;
  points: number;
  firstSemester: {
    dailyWork: number;
    exam: number;
    total: number;
  };
  secondSemester: {
    dailyWork: number;
    exam: number;
    total: number;
  };
  overallTotal: number;
  weightedScore: number;
  percentage: number;
}

interface ReportCardData {
  reportNumber: string;
  studentName: string;
  studentGender: string;
  studentBirthDate: string;
  studentPhotoUrl: string;
  permanentNumber: string;
  className: string;
  academicYear: string;
  trimester: string;
  grades: DetailedGradeData[];
  totalPointsObtained: number;
  totalPointsPossible: number;
  overallPercentage: number;
  averageGrade: number;
  classRank: number;
  mention: string;
  schoolInfo: {
    name: string;
    logo: string;
    province: string;
    city: string;
    commune: string;
    schoolCode: string;
  };
}

interface ReportStats {
  totalGenerated: number;
  globalGenerated: number;
  maxLimit: number;
  remaining: number;
  percentageUsed: number;
  bySchool: Record<string, number>;
  byClass: Record<string, number>;
  byYear: Record<string, number>;
}

interface InteractiveCourseRow {
  id: string;
  name: string;
  maxTJ1: number;
  maxTJ2: number;
  maxExam1: number;
  maxTJ3: number;
  maxTJ4: number;
  maxExam2: number;
  tj1: string;
  tj2: string;
  exam1: string;
  tj3: string;
  tj4: string;
  exam2: string;
  repechagePercent: string;
  repechageSign: string;
}

// ==========================================
// HIGH RESOLUTION SVGS (DRC FLAG) & WATERMARKS
// ==========================================
const RDCFlagSVG = () => (
  <svg width="90" height="65" viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="border border-neutral-300 shadow-sm rounded-sm">
    <rect width="400" height="300" fill="#007FFF" />
    <line x1="-50" y1="350" x2="450" y2="-50" stroke="#FFC72C" strokeWidth="60" />
    <line x1="-50" y1="350" x2="450" y2="-50" stroke="#D22630" strokeWidth="36" />
    <polygon points="60,35 66,53 84,53 70,64 75,82 60,71 45,82 50,64 36,53 54,53" fill="#FFC72C" />
  </svg>
);

const RDCWatermark = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.055] z-0">
    <img src="/rdc-coat-of-arms.png" alt="Armoiries RDC Filigrane" className="w-[320px] h-[320px] object-contain" />
  </div>
);

// Barcode rendering
const CSSBarcode = ({ value }: { value: string }) => {
  const chars = value.split('');
  const barWidths = chars.map((char) => {
    const code = char.charCodeAt(0);
    return [(code % 3) + 1, ((code + 2) % 3) + 1, ((code + 4) % 2) + 1];
  }).flat().slice(0, 45);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="flex items-end h-6 gap-[1px]">
        {barWidths.map((w, idx) => (
          <div
            key={idx}
            className="bg-black h-6"
            style={{ width: `${w}px` }}
          />
        ))}
      </div>
      <span className="text-[8px] font-mono tracking-[3px] mt-0.5 text-black">{value}</span>
    </div>
  );
};

// Boxed display for ID numbers
const BoxedDisplay = ({ value = "", length }: { value: string; length: number }) => {
  const padded = value.padEnd(length, " ");
  return (
    <div className="flex gap-[1px] inline-flex">
      {padded.split("").map((char, idx) => (
        <div key={idx} className="w-[12px] h-[17px] border border-black flex items-center justify-center font-mono font-bold text-[10px] bg-white text-black">
          {char === " " ? "" : char}
        </div>
      ))}
    </div>
  );
};

// ==========================================
// PRE-DEFINED RDC OFFICIAL CURRICULUM DATA
// ==========================================
const RDC_OFFICIAL_CURRICULUM = [
  // Groupe 1: Sciences Humaines / Culture
  { name: "Religion (1)", maxTJ1: 10, maxTJ2: 10, maxExam1: 20, maxTJ3: 10, maxTJ4: 10, maxExam2: 20 },
  { name: "Éducation à la Vie", maxTJ1: 10, maxTJ2: 10, maxExam1: 20, maxTJ3: 10, maxTJ4: 10, maxExam2: 20 },
  { name: "Ed. civ. & morale", maxTJ1: 10, maxTJ2: 10, maxExam1: 20, maxTJ3: 10, maxTJ4: 10, maxExam2: 20 },
  // Groupe 2: Arts, Langues et Sciences Sociales
  { name: "Biologie", maxTJ1: 20, maxTJ2: 20, maxExam1: 40, maxTJ3: 20, maxTJ4: 20, maxExam2: 40 },
  { name: "Dessin", maxTJ1: 20, maxTJ2: 20, maxExam1: 40, maxTJ3: 20, maxTJ4: 20, maxExam2: 40 },
  { name: "Éducation music. / Théâtrale", maxTJ1: 20, maxTJ2: 20, maxExam1: 40, maxTJ3: 20, maxTJ4: 20, maxExam2: 40 },
  { name: "Éducation phys. & sportive", maxTJ1: 20, maxTJ2: 20, maxExam1: 40, maxTJ3: 20, maxTJ4: 20, maxExam2: 40 },
  { name: "Géographie", maxTJ1: 20, maxTJ2: 20, maxExam1: 40, maxTJ3: 20, maxTJ4: 20, maxExam2: 40 },
  { name: "Histoire", maxTJ1: 20, maxTJ2: 20, maxExam1: 40, maxTJ3: 20, maxTJ4: 20, maxExam2: 40 },
  { name: "Informatique", maxTJ1: 20, maxTJ2: 20, maxExam1: 40, maxTJ3: 20, maxTJ4: 20, maxExam2: 40 },
  { name: "Langues nationales", maxTJ1: 20, maxTJ2: 20, maxExam1: 40, maxTJ3: 20, maxTJ4: 20, maxExam2: 40 },
  { name: "Sociologie", maxTJ1: 20, maxTJ2: 20, maxExam1: 40, maxTJ3: 20, maxTJ4: 20, maxExam2: 40 },
  { name: "Travaux manuels / Ecriture", maxTJ1: 20, maxTJ2: 20, maxExam1: 40, maxTJ3: 20, maxTJ4: 20, maxExam2: 40 },
  // Groupe 3: Sciences Dures & Pédagogie
  { name: "Chimie", maxTJ1: 40, maxTJ2: 40, maxExam1: 80, maxTJ3: 40, maxTJ4: 40, maxExam2: 80 },
  { name: "Français", maxTJ1: 40, maxTJ2: 40, maxExam1: 80, maxTJ3: 40, maxTJ4: 40, maxExam2: 80 },
  { name: "Mathématiques", maxTJ1: 40, maxTJ2: 40, maxExam1: 80, maxTJ3: 40, maxTJ4: 40, maxExam2: 80 },
  { name: "Pédagogie", maxTJ1: 40, maxTJ2: 40, maxExam1: 80, maxTJ3: 40, maxTJ4: 40, maxExam2: 80 },
  { name: "Physique", maxTJ1: 40, maxTJ2: 40, maxExam1: 80, maxTJ3: 40, maxTJ4: 40, maxExam2: 80 },
  { name: "Psychologie", maxTJ1: 40, maxTJ2: 40, maxExam1: 80, maxTJ3: 40, maxTJ4: 40, maxExam2: 80 },
  // Groupe 4: Langues Modernes et Philosophie
  { name: "Anglais", maxTJ1: 50, maxTJ2: 50, maxExam1: 100, maxTJ3: 50, maxTJ4: 50, maxExam2: 100 },
  { name: "Philosophie", maxTJ1: 50, maxTJ2: 50, maxExam1: 100, maxTJ3: 50, maxTJ4: 50, maxExam2: 100 },
];

export default function AdminReports() {
  const { user } = useAppStore();
  const printRef = useRef<HTMLDivElement>(null);

  // Database states
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTrimester, setSelectedTrimester] = useState('1');
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [courses, setCourses] = useState<CourseWithPoints[]>([]);
  const [reportStats, setReportStats] = useState<ReportStats | null>(null);
  const [canGenerateMore, setCanGenerateMore] = useState(true);
  
  // UI Tab Navigation
  const [activeTab, setActiveTab] = useState('generate');
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Dialog states for Course Management
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseWithPoints | null>(null);
  const [courseForm, setCourseForm] = useState({
    name: '',
    points: 1,
    maxScore: 20,
    trimester1Weight: 0.5,
    trimester2Weight: 0.5,
  });

  // ==========================================
  // BULLETINS DYNAMICS STATE (HIGH-FIDELITY PREVIEW)
  // ==========================================
  const [showRDCBulletin, setShowRDCBulletin] = useState(false);
  const [generationMode, setGenerationMode] = useState<'db' | 'manual'>('manual');
  const [manualRowsCount, setManualRowsCount] = useState(15);
  const [manualTemplateType, setManualTemplateType] = useState<'empty' | 'official'>('official');

  // Bulletin editable fields
  const [bulletinMetadata, setBulletinMetadata] = useState({
    schoolName: '',
    province: 'KINSHASA',
    city: 'KINSHASA',
    commune: 'GOMBE',
    schoolCode: '12049382',
    studentName: '',
    studentGender: 'M',
    studentBirthDate: '',
    studentBirthPlace: '',
    permanentNumber: '8362683380029',
    studentClass: '1ère ANNEE HUMANITES / PEDAGOGIE GENERALE',
    academicYear: '2024 - 2025',
    idNumber: '2026110902837493012903847283', // 28 chars
    trimesterText: 'PREMIER TRIMESTRE',
    placeInClass: '',
    effectif: '',
    application: '',
    conduite: '',
    decisionText: '',
    faitA: 'Kinshasa',
    faitLe: '02/07/2025',
  });

  const [bulletinCourses, setBulletinCourses] = useState<InteractiveCourseRow[]>([]);

  // ==========================================
  // API DATA LOADING
  // ==========================================
  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch(`/api/classes?schoolId=${user?.schoolId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setClasses(Array.isArray(data.classes) ? data.classes : []);
    } catch {
      // silencieux
    }
  }, [user?.schoolId]);

  const fetchStudents = useCallback(async () => {
    if (!selectedClass) return;
    try {
      const res = await fetch(`/api/users?schoolId=${user?.schoolId}&role=STUDENT&classId=${selectedClass}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStudents(data.users || []);
    } catch {
      // silencieux
    }
  }, [selectedClass, user?.schoolId]);

  const fetchCourses = useCallback(async () => {
    if (!selectedClass) return;
    try {
      const res = await fetch(`/api/courses-with-points?classId=${selectedClass}&schoolId=${user?.schoolId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCourses(data.courses || []);
    } catch {
      // silencieux
    }
  }, [selectedClass, user?.schoolId]);

  const fetchReportStats = useCallback(async () => {
    if (!user?.schoolId) return;
    try {
      const res = await fetch(`/api/report-cards/stats?schoolId=${user.schoolId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReportStats(data);
      setCanGenerateMore(data?.remaining > 0);
    } catch {
      // silencieux
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId]);

  // Archive state variables
  const [archiveReports, setArchiveReports] = useState<any[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [selectedArchiveClass, setSelectedArchiveClass] = useState<string | null>(null);
  const [selectedArchiveStudent, setSelectedArchiveStudent] = useState<string | null>(null);

  const fetchArchive = useCallback(async () => {
    if (!user?.schoolId) return;
    setArchiveLoading(true);
    try {
      const res = await fetch(`/api/report-cards/archive?schoolId=${user.schoolId}`);
      if (!res.ok) throw new Error("Failed to fetch archive");
      const data = await res.json();
      setArchiveReports(data.reportCards || []);
    } catch {
      toast.error("Impossible de charger les bulletins archivés");
    } finally {
      setArchiveLoading(false);
    }
  }, [user?.schoolId]);

  const [showImportReports, setShowImportReports] = useState(false);

  const handleImportReports = async (rows: CsvObject[]) => {
    if (!user?.schoolId) return;
    const res = await fetch('/api/report-cards/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId: user.schoolId, rows }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "L'import a échoué");
    if (data.errors?.length) data.errors.forEach((message: string) => toast.warning(message));
    toast.success(
      `${data.created} bulletin${data.created > 1 ? 's' : ''} importé${data.created > 1 ? 's' : ''}` +
        (data.skipped ? ` · ${data.skipped} déjà existant${data.skipped > 1 ? 's' : ''}` : '')
    );
    if (data.created > 0) fetchArchive();
  };

  useEffect(() => {
    if (activeTab === 'archive') {
      fetchArchive();
    }
  }, [activeTab, fetchArchive]);

  const handleLoadArchivedBulletin = (report: any) => {
    try {
      const gData = report.gradesData;
      if (!gData) {
        toast.error("Données du bulletin corrompues");
        return;
      }

      // Switch to database mode
      setGenerationMode('db');
      setSelectedClass(report.classId);
      setSelectedStudent(report.studentId);
      setSelectedTrimester(report.trimester);
      setShowRDCBulletin(true);

      // Restore metadata
      if (gData.metadata) {
        setBulletinMetadata((prev) => ({
          ...prev,
          schoolName: gData.metadata.schoolName || '',
          province: gData.metadata.province || '',
          city: gData.metadata.city || '',
          commune: gData.metadata.commune || '',
          schoolCode: gData.metadata.schoolCode || '',
          studentName: gData.metadata.studentName || report.studentName,
          studentGender: gData.metadata.studentGender || report.studentGender,
          studentBirthDate: gData.metadata.studentBirthDate || report.studentBirthDate,
          permanentNumber: gData.metadata.permanentNumber || report.permanentNumber,
          academicYear: gData.metadata.academicYear || report.academicYear,
          effectif: gData.metadata.effectif || '',
          placeInClass: gData.metadata.placeInClass || String(report.classRank),
          conduite: gData.metadata.conduite || 'A',
          application: gData.metadata.application || 'A',
          decisionText: gData.metadata.decisionText || 'PASSE',
        }));
      } else {
        // Fallback for simple saved reports
        setBulletinMetadata((prev) => ({
          ...prev,
          schoolName: '',
          province: 'KINSHASA',
          city: 'KINSHASA',
          commune: 'GOMBE',
          schoolCode: '00000000',
          studentName: report.studentName,
          studentGender: report.studentGender,
          studentBirthDate: report.studentBirthDate,
          permanentNumber: report.permanentNumber,
          academicYear: report.academicYear,
          effectif: '',
          placeInClass: String(report.classRank),
          conduite: 'A',
          application: 'A',
          decisionText: report.mention === 'Passage' ? 'PASSE' : 'DOUBLE',
        }));
      }

      // Restore courses/grades
      if (gData.rawRows && Array.isArray(gData.rawRows)) {
        const sanitized = gData.rawRows.map((r: any) => ({
          ...r,
          repechagePercent: r.repechagePercent || '',
          repechageSign: r.repechageSign || '',
        }));
        setBulletinCourses(sanitized);
      } else if (Array.isArray(gData)) {
        // Fallback if gradesData is just the raw DetailedGradeData[]
        const reconstructed = gData.map((g: any) => ({
          id: g.id || g.courseId,
          name: g.courseName,
          maxTJ1: g.points * 10,
          maxTJ2: g.points * 10,
          maxExam1: g.points * 20,
          maxTJ3: g.points * 10,
          maxTJ4: g.points * 10,
          maxExam2: g.points * 20,
          tj1: String(Math.round(g.firstSemester.dailyWork / 2)),
          tj2: String(Math.round(g.firstSemester.dailyWork / 2)),
          exam1: String(g.firstSemester.exam),
          tj3: String(Math.round(g.secondSemester.dailyWork / 2)),
          tj4: String(Math.round(g.secondSemester.dailyWork / 2)),
          exam2: String(g.secondSemester.exam),
          repechagePercent: '',
          repechageSign: '',
        }));
        setBulletinCourses(reconstructed);
      } else if (gData.serializedGrades && Array.isArray(gData.serializedGrades)) {
        const reconstructed = gData.serializedGrades.map((g: any) => ({
          id: g.id || g.courseId,
          name: g.courseName,
          maxTJ1: g.points * 10,
          maxTJ2: g.points * 10,
          maxExam1: g.points * 20,
          maxTJ3: g.points * 10,
          maxTJ4: g.points * 10,
          maxExam2: g.points * 20,
          tj1: String(Math.round(g.firstSemester.dailyWork / 2)),
          tj2: String(Math.round(g.firstSemester.dailyWork / 2)),
          exam1: String(g.firstSemester.exam),
          tj3: String(Math.round(g.secondSemester.dailyWork / 2)),
          tj4: String(Math.round(g.secondSemester.dailyWork / 2)),
          exam2: String(g.secondSemester.exam),
          repechagePercent: '',
          repechageSign: '',
        }));
        setBulletinCourses(reconstructed);
      }

      // Switch back to generate tab so they can see it!
      setActiveTab('generate');
      toast.success("Bulletin chargé dans le dessinateur.");
    } catch {
      toast.error("Impossible de charger ce bulletin.");
    }
  };

  const handlePrintArchived = (report: any) => {
    handleLoadArchivedBulletin(report);
    setTimeout(() => {
      handlePrint();
    }, 450);
  };

  const handleDeleteArchived = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer définitivement ce bulletin archivé ?")) return;
    try {
      const res = await fetch(`/api/report-cards?id=${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Bulletin supprimé de l'archive");
      fetchArchive();
      fetchReportStats();
    } catch {
      toast.error("Erreur lors de la suppression du bulletin");
    }
  };

  useEffect(() => {
    if (user?.schoolId) {
      setLoading(true);
      fetchClasses();
      fetchReportStats();
      // Initialize manual school name with user school info if possible
      fetch(`/api/schools/${user.schoolId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((schoolData) => {
          if (schoolData) {
            setBulletinMetadata((prev) => ({
              ...prev,
              schoolName: schoolData.name || '',
              province: schoolData.province || 'KINSHASA',
              city: schoolData.city || 'KINSHASA',
              commune: schoolData.commune || 'GOMBE',
              schoolCode: schoolData.schoolCode || '00000000',
            }));
          }
        })
        .catch(() => {});
    }
  }, [fetchClasses, fetchReportStats, user?.schoolId]);

  useEffect(() => {
    if (selectedClass) {
      // Immediately clear stale data to avoid showing previous class data
      setStudents([]);
      setCourses([]);
      setSelectedStudent('');
      fetchStudents();
      fetchCourses();
    }
  }, [selectedClass, fetchStudents, fetchCourses]);


  // ==========================================
  // DB COURSE ACTIONS (PRESERVED)
  // ==========================================
  const handleAddCourse = async () => {
    if (!courseForm.name) {
      toast.error('Veuillez entrer un nom de cours');
      return;
    }
    try {
      const res = await fetch('/api/courses-with-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...courseForm,
          schoolId: user?.schoolId,
          classId: selectedClass,
        }),
      });
      if (res.ok) {
        toast.success('Cours ajouté avec succès');
        setCourseDialogOpen(false);
        setCourseForm({ name: '', points: 1, maxScore: 20, trimester1Weight: 0.5, trimester2Weight: 0.5 });
        fetchCourses();
      } else {
        toast.error("Erreur lors de l'ajout");
      }
    } catch {
      toast.error('Erreur réseau');
    }
  };

  const handleUpdateCourse = async () => {
    if (!editingCourse) return;
    try {
      const res = await fetch(`/api/courses-with-points/${editingCourse.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(courseForm),
      });
      if (res.ok) {
        toast.success('Cours modifié avec succès');
        setCourseDialogOpen(false);
        setEditingCourse(null);
        setCourseForm({ name: '', points: 1, maxScore: 20, trimester1Weight: 0.5, trimester2Weight: 0.5 });
        fetchCourses();
      } else {
        toast.error('Erreur lors de la modification');
      }
    } catch {
      toast.error('Erreur réseau');
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Voulez-vous vraiment supprimer ce cours ?')) return;
    try {
      const res = await fetch(`/api/courses-with-points/${courseId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Cours supprimé avec succès');
        fetchCourses();
      } else {
        toast.error('Erreur lors de la suppression');
      }
    } catch {
      toast.error('Erreur réseau');
    }
  };

  // ==========================================
  // BULLETINS GENERATION TRIGGER
  // ==========================================
  const triggerBulletinGeneration = async () => {
    if (generationMode === 'db') {
      if (!selectedClass) {
        toast.error('Veuillez sélectionner une classe');
        return;
      }
      if (!selectedStudent) {
        toast.error('Veuillez sélectionner un élève');
        return;
      }
      
      setGeneratingReport(true);
      try {
        const student = students.find((s) => s.id === selectedStudent);
        const classInfo = classes.find((c) => c.id === selectedClass);
        const schoolRes = await fetch(`/api/schools/${user?.schoolId}`);
        const schoolData = schoolRes.ok ? await schoolRes.json() : null;

        // Fetch student's grades from DB
        let studentGrades: any[] = [];
        try {
          const gradesRes = await fetch(`/api/grades?schoolId=${user?.schoolId}&studentId=${selectedStudent}`);
          if (gradesRes.ok) {
            const gd = await gradesRes.json();
            studentGrades = Array.isArray(gd) ? gd : (Array.isArray(gd.grades) ? gd.grades : []);
          }
        } catch {
          // silencieux
        }

        // Fetch EPST curriculum rules for student's section and class level
        let epstRules: any[] = [];
        try {
          const section = student?.section || "Scientifique";
          const levelName = classInfo?.name || "6ème";
          const epstRes = await fetch(`/api/epst/curriculum?section=${section}&level=${levelName}`);
          if (epstRes.ok) {
            epstRules = await epstRes.json();
          }
        } catch {
          // silencieux
        }

        // Set student metadata
        setBulletinMetadata((prev) => ({
          ...prev,
          schoolName: schoolData?.name || 'INSTITUT DE LA GOMBE',
          province: schoolData?.province || 'KINSHASA',
          city: schoolData?.city || 'KINSHASA',
          commune: schoolData?.commune || 'GOMBE',
          schoolCode: schoolData?.schoolCode || '00000000',
          studentName: student?.fullName || 'Inconnu',
          studentGender: student?.gender || 'M',
          studentBirthDate: student?.birthDate || '',
          studentClass: classInfo?.name || '',
          permanentNumber: student?.cardId || student?.matricule || '8362683380029',
          academicYear: student?.academicYear || '2025-2026',
          trimesterText: selectedTrimester === '1' ? '1er TRIMESTRE' : selectedTrimester === '2' ? '2e TRIMESTRE' : '3e TRIMESTRE',
        }));

        // Convert DB courses to bulletin courses
        if (courses.length > 0) {
          const mappedCourses: InteractiveCourseRow[] = courses.map((c, index) => {
            // Check if there is an EPST curriculum match
            const epstMatch = epstRules.find(
              (item: any) => item.courseName.toLowerCase() === c.name.toLowerCase()
            );

            // Use EPST maxScore if found, otherwise course.maxScore, otherwise fallback to 20
            const finalMaxScore = epstMatch ? epstMatch.maxScore : (c.maxScore || 20);

            // Find matching grades for this course
            const courseGrades = studentGrades.filter((g: any) => g.courseId === c.id);
            const t1Grade = courseGrades.find((g: any) => g.trimester === '1');
            const t2Grade = courseGrades.find((g: any) => g.trimester === '2');
            const t3Grade = courseGrades.find((g: any) => g.trimester === '3');

            return {
              id: c.id,
              name: c.name,
              maxTJ1: Math.round(finalMaxScore * 0.25), // TJ is usually 25% of exam / max score in DRC
              maxTJ2: Math.round(finalMaxScore * 0.25),
              maxExam1: finalMaxScore,
              maxTJ3: Math.round(finalMaxScore * 0.25),
              maxTJ4: Math.round(finalMaxScore * 0.25),
              maxExam2: finalMaxScore,
              tj1: t1Grade ? String(t1Grade.score) : '',
              tj2: '',
              exam1: t2Grade ? String(t2Grade.score) : '',
              tj3: t3Grade ? String(t3Grade.score) : '',
              tj4: '',
              exam2: '',
              repechagePercent: '',
              repechageSign: '',
            };
          });
          setBulletinCourses(mappedCourses);
        } else {
          // Fallback if class has no courses
          toast.warning('Cette classe ne contient aucun cours dans la base de données. Lancement en modèle vierge.');
          generateBlankCourses(12);
        }

        setShowRDCBulletin(true);
        toast.success('Le bulletin a été dessiné avec succès !');
      } catch {
        toast.error('Erreur lors de la génération du bulletin');
      } finally {
        setGeneratingReport(false);
      }
    } else {
      // Manual Generation Mode
      if (!bulletinMetadata.schoolName) {
        toast.error("Veuillez saisir le nom de l'école dans le formulaire.");
        return;
      }
      
      setGeneratingReport(true);
      try {
        if (manualTemplateType === 'official') {
          const mapped: InteractiveCourseRow[] = RDC_OFFICIAL_CURRICULUM.map((item, idx) => ({
            id: `manual-course-${idx}`,
            name: item.name,
            maxTJ1: item.maxTJ1,
            maxTJ2: item.maxTJ2,
            maxExam1: item.maxExam1,
            maxTJ3: item.maxTJ3,
            maxTJ4: item.maxTJ4,
            maxExam2: item.maxExam2,
            tj1: '',
            tj2: '',
            exam1: '',
            tj3: '',
            tj4: '',
            exam2: '',
            repechagePercent: '',
            repechageSign: '',
          }));
          setBulletinCourses(mapped);
        } else {
          generateBlankCourses(manualRowsCount);
        }
        setShowRDCBulletin(true);
        toast.success('Le bulletin a été dessiné avec succès !');
      } catch {
        toast.error('Erreur lors de la génération du bulletin');
      } finally {
        setGeneratingReport(false);
      }
    }
  };

  const generateBlankCourses = (count: number) => {
    const blankRows: InteractiveCourseRow[] = Array.from({ length: count }).map((_, idx) => ({
      id: `blank-course-${idx}`,
      name: '',
      maxTJ1: 10,
      maxTJ2: 10,
      maxExam1: 20,
      maxTJ3: 10,
      maxTJ4: 10,
      maxExam2: 20,
      tj1: '',
      tj2: '',
      exam1: '',
      tj3: '',
      tj4: '',
      exam2: '',
      repechagePercent: '',
      repechageSign: '',
    }));
    setBulletinCourses(blankRows);
  };

  // ==========================================
  // BULLETINS INTERACTIVE FORMULAS CALCULATIONS
  // ==========================================
  const updateCourseCell = (index: number, field: keyof InteractiveCourseRow, val: string) => {
    setBulletinCourses((prev) => {
      const copy = [...prev];
      const updatedRow = { ...copy[index] };

      if (field === 'name') {
        updatedRow.name = val;
      } else if (field.startsWith('max')) {
        // @ts-ignore
        updatedRow[field] = Math.max(0, parseInt(val) || 0);
      } else {
        // Validate score <= max
        let numericVal = val === '' ? '' : String(Math.max(0, parseFloat(val) || 0));
        
        // Clamp score to maximum
        if (numericVal !== '') {
          const floatVal = parseFloat(numericVal);
          if (field === 'tj1' && floatVal > updatedRow.maxTJ1) numericVal = String(updatedRow.maxTJ1);
          if (field === 'tj2' && floatVal > updatedRow.maxTJ2) numericVal = String(updatedRow.maxTJ2);
          if (field === 'exam1' && floatVal > updatedRow.maxExam1) numericVal = String(updatedRow.maxExam1);
          if (field === 'tj3' && floatVal > updatedRow.maxTJ3) numericVal = String(updatedRow.maxTJ3);
          if (field === 'tj4' && floatVal > updatedRow.maxTJ4) numericVal = String(updatedRow.maxTJ4);
          if (field === 'exam2' && floatVal > updatedRow.maxExam2) numericVal = String(updatedRow.maxExam2);
        }

        // @ts-ignore
        updatedRow[field] = numericVal;
      }

      copy[index] = updatedRow;
      return copy;
    });
  };

  // Live Math Helpers for individual courses
  const getCourseRowSums = (row: InteractiveCourseRow) => {
    const tj1 = parseFloat(row.tj1) || 0;
    const tj2 = parseFloat(row.tj2) || 0;
    const exam1 = parseFloat(row.exam1) || 0;
    const tot1 = (row.tj1 !== '' || row.tj2 !== '' || row.exam1 !== '') ? (tj1 + tj2 + exam1) : 0;
    const hasScores1 = row.tj1 !== '' || row.tj2 !== '' || row.exam1 !== '';

    const tj3 = parseFloat(row.tj3) || 0;
    const tj4 = parseFloat(row.tj4) || 0;
    const exam2 = parseFloat(row.exam2) || 0;
    const tot2 = (row.tj3 !== '' || row.tj4 !== '' || row.exam2 !== '') ? (tj3 + tj4 + exam2) : 0;
    const hasScores2 = row.tj3 !== '' || row.tj4 !== '' || row.exam2 !== '';

    const totalGeneral = (hasScores1 || hasScores2) ? (tot1 + tot2) : 0;
    const maxSem1 = row.maxTJ1 + row.maxTJ2 + row.maxExam1;
    const maxSem2 = row.maxTJ3 + row.maxTJ4 + row.maxExam2;
    const maxGeneral = maxSem1 + maxSem2;

    return {
      tot1,
      hasScores1,
      tot2,
      hasScores2,
      totalGeneral,
      maxSem1,
      maxSem2,
      maxGeneral
    };
  };

  // Overall Global Sums
  const calculateGlobalSums = () => {
    let sumMaxTJ1 = 0;
    let sumMaxTJ2 = 0;
    let sumMaxExam1 = 0;
    let sumMaxSem1 = 0;
    let sumMaxTJ3 = 0;
    let sumMaxTJ4 = 0;
    let sumMaxExam2 = 0;
    let sumMaxSem2 = 0;
    let sumMaxGeneral = 0;

    let sumTJ1 = 0;
    let sumTJ2 = 0;
    let sumExam1 = 0;
    let sumTot1 = 0;
    let sumTJ3 = 0;
    let sumTJ4 = 0;
    let sumExam2 = 0;
    let sumTot2 = 0;
    let sumTotalGeneral = 0;

    let hasAnyScores1 = false;
    let hasAnyScores2 = false;

    bulletinCourses.forEach((row) => {
      const sums = getCourseRowSums(row);
      
      sumMaxTJ1 += row.maxTJ1;
      sumMaxTJ2 += row.maxTJ2;
      sumMaxExam1 += row.maxExam1;
      sumMaxSem1 += sums.maxSem1;

      sumMaxTJ3 += row.maxTJ3;
      sumMaxTJ4 += row.maxTJ4;
      sumMaxExam2 += row.maxExam2;
      sumMaxSem2 += sums.maxSem2;

      sumMaxGeneral += sums.maxGeneral;

      if (row.tj1 !== '') { sumTJ1 += parseFloat(row.tj1) || 0; hasAnyScores1 = true; }
      if (row.tj2 !== '') { sumTJ2 += parseFloat(row.tj2) || 0; hasAnyScores1 = true; }
      if (row.exam1 !== '') { sumExam1 += parseFloat(row.exam1) || 0; hasAnyScores1 = true; }
      if (sums.hasScores1) { sumTot1 += sums.tot1; }

      if (row.tj3 !== '') { sumTJ3 += parseFloat(row.tj3) || 0; hasAnyScores2 = true; }
      if (row.tj4 !== '') { sumTJ4 += parseFloat(row.tj4) || 0; hasAnyScores2 = true; }
      if (row.exam2 !== '') { sumExam2 += parseFloat(row.exam2) || 0; hasAnyScores2 = true; }
      if (sums.hasScores2) { sumTot2 += sums.tot2; }

      if (sums.hasScores1 || sums.hasScores2) {
        sumTotalGeneral += sums.totalGeneral;
      }
    });

    const percentageSem1 = hasAnyScores1 && sumMaxSem1 > 0 ? (sumTot1 / sumMaxSem1) * 100 : 0;
    const percentageSem2 = hasAnyScores2 && sumMaxSem2 > 0 ? (sumTot2 / sumMaxSem2) * 100 : 0;
    const percentageGeneral = (hasAnyScores1 || hasAnyScores2) && sumMaxGeneral > 0 ? (sumTotalGeneral / sumMaxGeneral) * 100 : 0;

    return {
      sumMaxTJ1,
      sumMaxTJ2,
      sumMaxExam1,
      sumMaxSem1,
      sumMaxTJ3,
      sumMaxTJ4,
      sumMaxExam2,
      sumMaxSem2,
      sumMaxGeneral,
      sumTJ1: hasAnyScores1 ? sumTJ1 : 0,
      sumTJ2: hasAnyScores1 ? sumTJ2 : 0,
      sumExam1: hasAnyScores1 ? sumExam1 : 0,
      sumTot1: hasAnyScores1 ? sumTot1 : 0,
      sumTJ3: hasAnyScores2 ? sumTJ3 : 0,
      sumTJ4: hasAnyScores2 ? sumTJ4 : 0,
      sumExam2: hasAnyScores2 ? sumExam2 : 0,
      sumTot2: hasAnyScores2 ? sumTot2 : 0,
      sumTotalGeneral: (hasAnyScores1 || hasAnyScores2) ? sumTotalGeneral : 0,
      percentageSem1,
      percentageSem2,
      percentageGeneral,
      hasAnyScores1,
      hasAnyScores2,
    };
  };

  const globalSums = calculateGlobalSums();

  // Save the report card to DB (Pre-filled Mode only)
  const handleSaveToDB = async () => {
    if (generationMode !== 'db' || !selectedStudent || !selectedClass) {
      toast.error("L'enregistrement en base de données est uniquement disponible en mode Base de Données.");
      return;
    }

    try {
      const year = new Date().getFullYear();
      const counterRes = await fetch('/api/report-cards/counter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, schoolId: user?.schoolId }),
      });
      const counterData = counterRes.ok ? await counterRes.json() : { counter: 1, canGenerate: true };

      if (counterData.canGenerate === false) {
        toast.error(counterData.message || "Limite de génération annuelle de 1.000.000 bulletins atteinte.");
        return;
      }

      const reportNumber = `${year}-KIN-${String(counterData.counter).padStart(8, '0')}`;

      const mappedGrades: DetailedGradeData[] = bulletinCourses.map((c) => {
        const sums = getCourseRowSums(c);
        return {
          id: c.id,
          courseId: c.id,
          courseName: c.name || 'Cours sans nom',
          points: Math.round(sums.maxGeneral / 20),
          firstSemester: {
            dailyWork: (parseFloat(c.tj1) || 0) + (parseFloat(c.tj2) || 0),
            exam: parseFloat(c.exam1) || 0,
            total: sums.tot1,
          },
          secondSemester: {
            dailyWork: (parseFloat(c.tj3) || 0) + (parseFloat(c.tj4) || 0),
            exam: parseFloat(c.exam2) || 0,
            total: sums.tot2,
          },
          overallTotal: sums.totalGeneral,
          weightedScore: sums.totalGeneral,
          percentage: sums.maxGeneral > 0 ? (sums.totalGeneral / sums.maxGeneral) * 100 : 0,
        };
      });

      const bodyData = {
        reportNumber,
        schoolId: user?.schoolId,
        classId: selectedClass,
        studentId: selectedStudent,
        trimester: selectedTrimester,
        academicYear: bulletinMetadata.academicYear,
        studentName: bulletinMetadata.studentName,
        studentGender: bulletinMetadata.studentGender,
        studentBirthDate: bulletinMetadata.studentBirthDate,
        studentPhotoUrl: '',
        permanentNumber: bulletinMetadata.permanentNumber,
        totalPointsObtained: globalSums.sumTotalGeneral,
        totalPointsPossible: globalSums.sumMaxGeneral,
        overallPercentage: globalSums.percentageGeneral,
        averageGrade: globalSums.percentageGeneral / 5,
        classRank: parseInt(bulletinMetadata.placeInClass) || 0,
        mention: globalSums.percentageGeneral >= 50 ? 'Passage' : 'Ajourné',
        gradesData: {
          serializedGrades: mappedGrades,
          rawRows: bulletinCourses,
          metadata: {
            schoolName: bulletinMetadata.schoolName,
            province: bulletinMetadata.province,
            city: bulletinMetadata.city,
            commune: bulletinMetadata.commune,
            schoolCode: bulletinMetadata.schoolCode,
            permanentNumber: bulletinMetadata.permanentNumber,
            placeInClass: bulletinMetadata.placeInClass,
            effectif: bulletinMetadata.effectif,
            conduite: bulletinMetadata.conduite,
            application: bulletinMetadata.application,
            decisionText: bulletinMetadata.decisionText,
            totalPointsObtained: globalSums.sumTotalGeneral,
            totalPointsPossible: globalSums.sumMaxGeneral,
            overallPercentage: globalSums.percentageGeneral,
            academicYear: bulletinMetadata.academicYear,
            studentName: bulletinMetadata.studentName,
            studentGender: bulletinMetadata.studentGender,
            studentBirthDate: bulletinMetadata.studentBirthDate,
          }
        },
      };

      const saveRes = await fetch('/api/report-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      if (saveRes.ok) {
        toast.success(`Bulletin enregistré en base de données sous le N° : ${reportNumber}`);
        fetchReportStats();
      } else {
        const err = await saveRes.json();
        toast.error(err.error || "Erreur lors de la sauvegarde du bulletin");
      }
    } catch {
      toast.error("Erreur de communication avec le serveur");
    }
  };

  // Print function
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    
    const originalTitle = document.title;
    document.title = `Bulletin_Scolaire_${bulletinMetadata.studentName.replace(/\s+/g, '_') || 'RDC'}`;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Bulletin de notes - RDC</title>
            <meta charset="utf-8">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                background: white !important; 
                font-family: 'Times New Roman', Times, serif, sans-serif;
              }
              @media print {
                body { padding: 0; margin: 0; }
                .no-print { display: none !important; }
              }
              @page {
                size: A4;
                margin: 4mm 6mm;
              }
              .bulletin-paper {
                width: 210mm !important;
                height: 297mm !important;
                padding: 4mm 7mm !important;
                border: 1px solid #000000 !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                page-break-inside: avoid !important;
                page-break-after: avoid !important;
                page-break-before: avoid !important;
                box-sizing: border-box !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .bulletin-table th, 
              .bulletin-table td {
                padding: 1.5px 2px !important;
                font-size: 9px !important;
                height: 18px !important;
                border: 1px solid #000000 !important;
              }
              .underline-input, .table-input {
                font-size: 9px !important;
                border: none !important;
                background: transparent !important;
              }
              .table-input::-webkit-outer-spin-button,
              .table-input::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
              }
              .table-input {
                -moz-appearance: textfield;
              }
              .h-\[80px\] {
                height: 48px !important;
              }
            </style>
          </head>
          <body>
            <div class="bulletin-paper" style="margin: 0 auto; background: white;">
              ${printContent.innerHTML}
            </div>
            <script>
              window.onload = () => { 
                setTimeout(() => {
                  window.print(); 
                  window.close();
                }, 350);
              };
            </script>
          </body>
        </html>
      `);

      // Copy all styles from main document to guarantee layout and tailwind styling
      Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).forEach((el) => {
        printWindow.document.head.appendChild(el.cloneNode(true));
      });

      printWindow.document.close();
    }
    document.title = originalTitle;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      
      {/* Dashboard Top Banner - Featuring RDC Coat of Arms PNG */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-red-600 text-white p-6 relative overflow-hidden shadow-md">
        <div className="absolute top-0 right-0 opacity-10">
          <Flag className="w-52 h-40" />
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <img src="/rdc-coat-of-arms.png" alt="Armoiries RDC" className="w-12 h-12 object-contain" />
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Système de Bulletins RDC Haute-Fidélité</h1>
                <p className="text-xs text-blue-100 mt-0.5">
                  Conforme à 100 % au modèle officiel du Ministère de l'Éducation Nationale et Nouvelle Citoyenneté
                </p>
              </div>
            </div>
          </div>
          {reportStats && (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-right">
              <span className="block text-xs uppercase tracking-wider text-blue-200">Bulletins Générés (École / Global)</span>
              <span className="text-xl font-mono font-bold">
                {reportStats.totalGenerated.toLocaleString()} / {reportStats.globalGenerated.toLocaleString()} (Max: {reportStats.maxLimit.toLocaleString()})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 no-print">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-auto lg:inline-flex bg-neutral-100 p-1 rounded-lg">
          <TabsTrigger value="generate" className="gap-2 rounded-md">
            <FileText className="h-4 w-4" />
            Dessiner Bulletin
          </TabsTrigger>
          <TabsTrigger value="courses" className="gap-2 rounded-md">
            <BookOpen className="h-4 w-4" />
            Gérer les Cours (BDD)
          </TabsTrigger>
          <TabsTrigger value="archive" className="gap-2 rounded-md">
            <Archive className="h-4 w-4" />
            Bulletins Générés
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2 rounded-md">
            <BarChart3 className="h-4 w-4" />
            Statistiques
          </TabsTrigger>
        </TabsList>

        {/* ==========================================
            TAB 1: DESSINER / GENERATE BULLETIN
           ========================================== */}
        <TabsContent value="generate">
          {!showRDCBulletin ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Formulaire de configuration */}
              <Card className="lg:col-span-1 shadow-sm border border-neutral-200 bg-white">
                <CardHeader className="bg-neutral-50/50 border-b border-neutral-100">
                  <CardTitle className="text-base flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-blue-600" />
                    Configuration du Rendu
                  </CardTitle>
                  <CardDescription>
                    Choisissez la méthode et configurez les informations de base du bulletin RDC.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  
                  {/* Mode Selector */}
                  <div className="space-y-2">
                    <Label className="font-semibold text-neutral-700">Mode de génération</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={generationMode === 'manual' ? 'default' : 'outline'}
                        onClick={() => setGenerationMode('manual')}
                        className="w-full text-xs font-semibold py-2"
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1" />
                        Modèle Vierge
                      </Button>
                      <Button
                        type="button"
                        variant={generationMode === 'db' ? 'default' : 'outline'}
                        onClick={() => setGenerationMode('db')}
                        className="w-full text-xs font-semibold py-2"
                        disabled={classes.length === 0}
                      >
                        <Users className="w-3.5 h-3.5 mr-1" />
                        Base de Données
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Manual Settings Fields */}
                  {generationMode === 'manual' ? (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="schoolName" className="text-xs font-semibold text-neutral-600">Nom de l'École *</Label>
                        <Input
                          id="schoolName"
                          placeholder="Ex: INSTITUT DE LA GOMBE"
                          value={bulletinMetadata.schoolName}
                          onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, schoolName: e.target.value })}
                          className="text-xs"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="province" className="text-xs font-semibold text-neutral-600">Province Ed. *</Label>
                          <Input
                            id="province"
                            value={bulletinMetadata.province}
                            onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, province: e.target.value.toUpperCase() })}
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="city" className="text-xs font-semibold text-neutral-600">Ville / District *</Label>
                          <Input
                            id="city"
                            value={bulletinMetadata.city}
                            onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, city: e.target.value })}
                            className="text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="studentName" className="text-xs font-semibold text-neutral-600">Nom complet de l'Élève</Label>
                        <Input
                          id="studentName"
                          placeholder="Laisser vide pour écrire à la main"
                          value={bulletinMetadata.studentName}
                          onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, studentName: e.target.value })}
                          className="text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-neutral-600">Sexe</Label>
                          <Select
                            value={bulletinMetadata.studentGender}
                            onValueChange={(val) => setBulletinMetadata({ ...bulletinMetadata, studentGender: val })}
                          >
                            <SelectTrigger className="text-xs h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="M">Masculin (M)</SelectItem>
                              <SelectItem value="F">Féminin (F)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="class" className="text-xs font-semibold text-neutral-600">Classe</Label>
                          <Input
                            id="class"
                            value={bulletinMetadata.studentClass}
                            onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, studentClass: e.target.value })}
                            className="text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-neutral-600">Type de gabarit de cours</Label>
                        <Select
                          value={manualTemplateType}
                          onValueChange={(val: 'empty' | 'official') => setManualTemplateType(val)}
                        >
                          <SelectTrigger className="text-xs h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="official">🇨🇩 RDC Programme Officiel (21 cours pré-remplis)</SelectItem>
                            <SelectItem value="empty">🗏 Totalement Vierge (Lignes de cours vides)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {manualTemplateType === 'empty' && (
                        <div className="space-y-1.5">
                          <Label htmlFor="rowsCount" className="text-xs font-semibold text-neutral-600">Nombre de lignes vides</Label>
                          <Input
                            id="rowsCount"
                            type="number"
                            min={1}
                            max={35}
                            value={manualRowsCount}
                            onChange={(e) => setManualRowsCount(Math.min(35, Math.max(1, parseInt(e.target.value) || 10)))}
                            className="text-xs font-mono"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    // DB Mode Settings Fields
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-neutral-600">Classe *</Label>
                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                          <SelectTrigger className="text-xs h-9">
                            <SelectValue placeholder="Choisir une classe" />
                          </SelectTrigger>
                          <SelectContent>
                            {classes.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-neutral-600">Élève *</Label>
                        <Select value={selectedStudent} onValueChange={setSelectedStudent} disabled={!selectedClass}>
                          <SelectTrigger className="text-xs h-9">
                            <SelectValue placeholder="Choisir un élève" />
                          </SelectTrigger>
                          <SelectContent>
                            {students.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-neutral-600">Trimestre *</Label>
                        <Select value={selectedTrimester} onValueChange={setSelectedTrimester}>
                          <SelectTrigger className="text-xs h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1er Trimestre</SelectItem>
                            <SelectItem value="2">2ème Trimestre</SelectItem>
                            <SelectItem value="3">3ème Trimestre</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <Separator />

                  <Button
                    onClick={triggerBulletinGeneration}
                    disabled={generatingReport || (generationMode === 'db' && (!selectedClass || !selectedStudent))}
                    className="w-full font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm py-2"
                  >
                    {generatingReport ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Génération du Bulletin...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Générer le Bulletin
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Explanations & Mock-Up representation */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="shadow-sm border border-neutral-200 bg-white">
                  <CardHeader className="bg-neutral-50/50 border-b border-neutral-100">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-indigo-600" />
                      Génération Haute-Fidélité 100 % Code
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <p className="text-sm text-neutral-600 leading-relaxed">
                      Ce module génère le bulletin officiel RDC entièrement dessiné en code HTML/CSS vectoriel. Contrairement aux versions précédentes, <strong>aucune image d'arrière-plan n'est utilisée</strong>. 
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border border-neutral-100 rounded-lg p-4 bg-neutral-50/30">
                        <span className="block font-bold text-xs text-neutral-700 uppercase tracking-wider mb-2">Qualité Professionnelle</span>
                        <p className="text-xs text-neutral-600 leading-relaxed">
                          Toutes les bordures, cellules de tableaux, en-têtes et watermarks sont rendus de façon vectorielle, garantissant une netteté totale lors du zoom ou de l'impression PDF.
                        </p>
                      </div>
                      <div className="border border-neutral-100 rounded-lg p-4 bg-neutral-50/30">
                        <span className="block font-bold text-xs text-neutral-700 uppercase tracking-wider mb-2">Saisie Libre Directe</span>
                        <p className="text-xs text-neutral-600 leading-relaxed">
                          Une fois le bulletin généré, cliquez simplement sur les cases du tableau ou de l'en-tête pour inscrire le nom des cours et les notes. Les pourcentages et totaux se calculent automatiquement.
                        </p>
                      </div>
                    </div>

                    <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/20 text-amber-800 text-xs">
                      <strong className="block mb-1">💡 Armoiries Officielles RDC :</strong>
                      Le filigrane d'arrière-plan du bulletin et le logo officiel en haut à droite ont été configurés avec le visuel authentique de la RDC.
                    </div>
                  </CardContent>
                </Card>
              </div>

            </div>
          ) : (
            // ==========================================
            // HIGH-FIDELITY INTERACTIVE RDC BULLETIN RENDER
            // ==========================================
            <div className="space-y-6">
              
              {/* Controls bar */}
              <div className="no-print flex flex-wrap items-center justify-between gap-3 p-4 bg-neutral-100 border border-neutral-200 rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowRDCBulletin(false)}
                    className="text-xs font-semibold gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Retour aux paramètres
                  </Button>
                  <Badge variant="secondary" className="px-3 py-1 font-semibold text-xs border border-neutral-300">
                    Mode: {generationMode === 'manual' ? 'Modèle Vierge' : 'Base de Données'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {generationMode === 'db' && (
                    <Button
                      onClick={handleSaveToDB}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Enregistrer en Base
                    </Button>
                  )}
                  <Button
                    onClick={handlePrint}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5 shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimer / Exporter PDF (A4)
                  </Button>
                </div>
              </div>

              {/* RDC Bulletin Paper Sheet */}
              <div className="overflow-x-auto bg-neutral-300 p-2 md:p-8 flex justify-center border border-neutral-400/30 rounded-2xl shadow-inner">
                
                {/* A4 sheet dimensions simulation */}
                <div className="bulletin-paper" ref={printRef}>
                  
                  {/* Inline stylesheet for exact A4 formatting & print support */}
                  <style dangerouslySetInnerHTML={{ __html: `
                    .bulletin-paper {
                      width: 210mm;
                      height: 297mm;
                      padding: 6mm 10mm;
                      background: #ffffff;
                      color: #000000;
                      font-family: 'Times New Roman', Times, serif, Arial, sans-serif;
                      position: relative;
                      box-sizing: border-box;
                      border: 1.5px solid #000000;
                      display: flex;
                      flex-direction: column;
                      justify-content: space-between;
                      page-break-inside: avoid;
                    }

                    .bulletin-table {
                      width: 100%;
                      border-collapse: collapse;
                      margin-top: 5px;
                      z-index: 10;
                      position: relative;
                      background: transparent;
                    }

                    .bulletin-table th, 
                    .bulletin-table td {
                      border: 1.5px solid #000000;
                      padding: 1.5px 2px;
                      font-size: 9.5px;
                      text-align: center;
                      color: #000000;
                      height: 19px;
                    }

                    .bulletin-table th {
                      font-weight: bold;
                      text-transform: uppercase;
                      background: #f8f9fa;
                    }

                    .bulletin-table td.branch-name {
                      text-align: left;
                      font-weight: bold;
                      padding-left: 6px;
                    }

                    .underline-input {
                      border: none;
                      border-bottom: 1px dotted #000000;
                      background: transparent;
                      outline: none;
                      font-family: inherit;
                      font-size: 10px;
                      padding: 0px 2px;
                      color: #000000;
                      width: 100%;
                      font-weight: bold;
                    }

                    .table-input {
                      border: none;
                      background: transparent;
                      outline: none;
                      font-family: inherit;
                      font-size: 9.5px;
                      width: 100%;
                      height: 100%;
                      text-align: center;
                      color: #000000;
                      padding: 0;
                      font-weight: bold;
                    }

                    .boxed-grid-label {
                      font-size: 8px;
                      font-family: Arial, sans-serif;
                      font-weight: bold;
                    }

                    @media print {
                      body {
                        background: #ffffff !important;
                        color: #000000 !important;
                        padding: 0 !important;
                        margin: 0 !important;
                      }
                      
                      .bulletin-paper {
                        box-shadow: none !important;
                        border: 1.5px solid #000000 !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        padding: 5mm 8mm !important;
                        margin: 0 !important;
                        page-break-inside: avoid !important;
                        page-break-after: avoid !important;
                        page-break-before: avoid !important;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: space-between !important;
                        box-sizing: border-box !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                      }

                      .bulletin-table th, 
                      .bulletin-table td {
                        padding: 1.5px 2px !important;
                        font-size: 9px !important;
                        height: 17.5px !important;
                        border: 1px solid #000000 !important;
                      }

                      .underline-input {
                        border-bottom: none !important;
                      }

                      .table-input::-webkit-outer-spin-button,
                      .table-input::-webkit-inner-spin-button {
                        -webkit-appearance: none;
                        margin: 0;
                      }
                      .table-input {
                        -moz-appearance: textfield;
                      }
                      
                      .h-\[80px\] {
                        height: 45px !important;
                      }
                    }
                  ` }} />

                  {/* SVG Security Watermark behind table - Featuring Official PNG */}
                  <RDCWatermark />

                  {/* 1. Header principal */}
                  <div className="border border-black p-2.5 relative flex items-center justify-between w-full h-[80px] z-10 bg-white">
                    <div className="w-[100px] flex items-center justify-start">
                      <RDCFlagSVG />
                    </div>
                    
                    <div className="flex-1 text-center px-1 flex flex-col justify-center">
                      <h2 className="font-extrabold text-[12px] tracking-wider uppercase text-black leading-tight">
                        République Démocratique du Congo
                      </h2>
                      <h3 className="font-bold text-[10px] uppercase tracking-normal text-black mt-0.5 leading-tight">
                        Ministère de l'Éducation Nationale
                      </h3>
                      <h3 className="font-bold text-[10px] uppercase tracking-normal text-black leading-tight">
                        et Nouvelle Citoyenneté
                      </h3>
                    </div>

                    <div className="w-[100px] flex items-center justify-end">
                      <img src="/rdc-coat-of-arms.png" alt="Armoiries RDC Officiel" className="w-16 h-16 object-contain" />
                    </div>
                  </div>

                  {/* Grille N° ID unique */}
                  <div className="flex items-center justify-between border-x border-b border-black px-4 py-1 z-10 bg-white">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-[11px] text-black">N° ID. :</span>
                      <BoxedDisplay value={bulletinMetadata.idNumber} length={28} />
                    </div>
                    <div className="no-print w-44 flex items-center gap-1">
                      <span className="text-[9px] text-neutral-500 font-semibold">Modifier ID:</span>
                      <Input
                        type="text"
                        maxLength={28}
                        value={bulletinMetadata.idNumber}
                        onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, idNumber: e.target.value.replace(/[^0-9A-Z]/gi, '').toUpperCase() })}
                        className="h-5 text-[9px] py-0 font-mono w-24 bg-white border border-neutral-300"
                        placeholder="28 caractères"
                      />
                    </div>
                  </div>

                  {/* 2. Zone d'identification (Double Colonne) */}
                  <div className="border-x border-b border-black p-2.5 grid grid-cols-2 gap-x-6 gap-y-1.5 z-10 bg-white text-[11px] leading-tight">
                    
                    {/* Left Column */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1">
                        <span className="font-bold uppercase whitespace-nowrap">PROVINCE EDUC. :</span>
                        <input
                          type="text"
                          value={bulletinMetadata.province}
                          onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, province: e.target.value.toUpperCase() })}
                          className="underline-input flex-1"
                        />
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <span className="font-bold uppercase whitespace-nowrap">VILLE :</span>
                        <input
                          type="text"
                          value={bulletinMetadata.city}
                          onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, city: e.target.value })}
                          className="underline-input flex-1"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="font-bold uppercase whitespace-nowrap">COMMUNE / TER. (1) :</span>
                        <input
                          type="text"
                          value={bulletinMetadata.commune}
                          onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, commune: e.target.value })}
                          className="underline-input flex-1"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="font-bold uppercase whitespace-nowrap">ECOLE :</span>
                        <input
                          type="text"
                          value={bulletinMetadata.schoolName}
                          onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, schoolName: e.target.value.toUpperCase() })}
                          className="underline-input flex-1"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="font-bold uppercase text-[9px] whitespace-nowrap">CODE ECOLE :</span>
                        <BoxedDisplay value={bulletinMetadata.schoolCode} length={8} />
                        <div className="no-print flex items-center ml-1">
                          <input
                            type="text"
                            maxLength={8}
                            value={bulletinMetadata.schoolCode}
                            onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, schoolCode: e.target.value.replace(/\D/g, '') })}
                            className="w-14 h-4 border border-neutral-300 rounded text-[9px] font-mono text-center"
                            placeholder="8 chiffres"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1">
                        <span className="font-bold uppercase whitespace-nowrap">ELEVE :</span>
                        <input
                          type="text"
                          value={bulletinMetadata.studentName}
                          onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, studentName: e.target.value })}
                          className="underline-input flex-1"
                        />
                        <span className="font-bold uppercase whitespace-nowrap ml-1.5">SEXE :</span>
                        <input
                          type="text"
                          maxLength={2}
                          value={bulletinMetadata.studentGender}
                          onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, studentGender: e.target.value.toUpperCase() })}
                          className="underline-input w-6 text-center"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="font-bold uppercase whitespace-nowrap">NE(E) A :</span>
                        <input
                          type="text"
                          value={bulletinMetadata.studentBirthPlace}
                          onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, studentBirthPlace: e.target.value })}
                          className="underline-input flex-1"
                        />
                        <span className="font-bold uppercase whitespace-nowrap ml-1.5">LE :</span>
                        <input
                          type="text"
                          placeholder="JJ/MM/AAAA"
                          value={bulletinMetadata.studentBirthDate}
                          onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, studentBirthDate: e.target.value })}
                          className="underline-input w-20 text-center"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="font-bold uppercase whitespace-nowrap">CLASSE :</span>
                        <input
                          type="text"
                          value={bulletinMetadata.studentClass}
                          onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, studentClass: e.target.value })}
                          className="underline-input flex-1"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="font-bold uppercase text-[9px] whitespace-nowrap">N° PERM. :</span>
                        <BoxedDisplay value={bulletinMetadata.permanentNumber} length={14} />
                        <div className="no-print flex items-center ml-1">
                          <input
                            type="text"
                            maxLength={14}
                            value={bulletinMetadata.permanentNumber}
                            onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, permanentNumber: e.target.value.replace(/\D/g, '') })}
                            className="w-20 h-4 border border-neutral-300 rounded text-[9px] font-mono text-center"
                            placeholder="14 chiffres"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Titre du bulletin */}
                  <div className="border-x border-b border-black bg-neutral-900 text-white font-bold p-1.5 text-center text-[10px] tracking-wider flex items-center justify-between uppercase z-10">
                    <input
                      type="text"
                      value={bulletinMetadata.studentClass}
                      onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, studentClass: e.target.value.toUpperCase() })}
                      className="bg-transparent border-none text-white text-center font-bold outline-none flex-1 font-mono text-[10px] uppercase"
                    />
                    <div className="flex items-center gap-1.5 whitespace-nowrap ml-3">
                      <span>ANNEE SCOLAIRE :</span>
                      <input
                        type="text"
                        value={bulletinMetadata.academicYear}
                        onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, academicYear: e.target.value })}
                        className="bg-transparent border-none text-white font-bold w-20 text-center outline-none border-b border-white/30"
                      />
                    </div>
                  </div>

                  {/* 4. Grand tableau principal */}
                  <div className="flex-1 relative z-10">
                    <table className="bulletin-table">
                      <thead>
                        <tr className="bg-neutral-50">
                          <th rowSpan={3} className="text-center font-extrabold text-[10px] py-1.5 w-[35%] border-black">BRANCHES</th>
                          <th colSpan={4} className="text-center font-bold text-[9px] border-black">PREMIER SEMESTRE</th>
                          <th colSpan={4} className="text-center font-bold text-[9px] border-black">SECOND SEMESTRE</th>
                          <th rowSpan={3} className="text-center font-bold text-[8.5px] border-black w-8">T.G.<br/><span className="text-[7.5px] font-normal">/80</span></th>
                          <th colSpan={2} className="text-center font-bold text-[8.5px] border-black w-24">EXAMEN DE REPECHAGE</th>
                        </tr>
                        <tr className="bg-neutral-50">
                          <th colSpan={2} className="text-center font-bold text-[8.5px] border-black">TR. JOURNAL.</th>
                          <th rowSpan={2} className="text-center font-bold text-[8.5px] border-black w-9">EXAM<br/><span className="text-[7.5px] font-normal">/20</span></th>
                          <th rowSpan={2} className="text-center font-bold text-[8.5px] border-black w-9">TOT<br/><span className="text-[7.5px] font-normal">/40</span></th>
                          <th colSpan={2} className="text-center font-bold text-[8.5px] border-black">TR. JOURNAL.</th>
                          <th rowSpan={2} className="text-center font-bold text-[8.5px] border-black w-9">EXAM<br/><span className="text-[7.5px] font-normal">/20</span></th>
                          <th rowSpan={2} className="text-center font-bold text-[8.5px] border-black w-9">TOT<br/><span className="text-[7.5px] font-normal">/40</span></th>
                          <th rowSpan={2} className="text-center font-bold text-[8.5px] border-black w-9">%</th>
                          <th rowSpan={2} className="text-center font-bold text-[8.5px] border-black w-14">SIGN. PROF</th>
                        </tr>
                        <tr className="bg-neutral-50">
                          <th className="text-center font-medium text-[7.5px] border-black w-7">1er P.</th>
                          <th className="text-center font-medium text-[7.5px] border-black w-7">2e P.</th>
                          <th className="text-center font-medium text-[7.5px] border-black w-7">3e P.</th>
                          <th className="text-center font-medium text-[7.5px] border-black w-7">4e P.</th>
                        </tr>
                      </thead>
                      <tbody>
                        
                        {/* FIRST ROW OF MAXIMA */}
                        <tr className="bg-neutral-100 font-bold">
                          <td className="branch-name border-black uppercase text-[9.5px] text-center bg-neutral-100 font-extrabold">MAXIMA</td>
                          <td className="border-black font-mono">10</td>
                          <td className="border-black font-mono">10</td>
                          <td className="border-black font-mono">20</td>
                          <td className="border-black font-mono bg-neutral-200">40</td>
                          <td className="border-black font-mono">10</td>
                          <td className="border-black font-mono">10</td>
                          <td className="border-black font-mono">20</td>
                          <td className="border-black font-mono bg-neutral-200">40</td>
                          <td className="border-black font-mono bg-neutral-300">80</td>
                          <td className="border-black"></td>
                          <td className="border-black"></td>
                        </tr>

                        {/* RENDER DYNAMIC COURSE ROWS */}
                        {bulletinCourses.map((row, index) => {
                          const sums = getCourseRowSums(row);
                          return (
                            <tr key={row.id} className="hover:bg-neutral-50/50">
                              
                              {/* Branch Name */}
                              <td className="branch-name border-black">
                                <input
                                  type="text"
                                  placeholder="Nom de la branche..."
                                  value={row.name}
                                  onChange={(e) => updateCourseCell(index, 'name', e.target.value)}
                                  className="table-input text-left px-2 font-bold uppercase tracking-tight w-full bg-transparent text-[9.5px]"
                                />
                              </td>

                              {/* 1er Semestre */}
                              <td className="border-black">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max={row.maxTJ1}
                                  value={row.tj1}
                                  onChange={(e) => updateCourseCell(index, 'tj1', e.target.value)}
                                  className="table-input font-mono"
                                  placeholder="-"
                                />
                              </td>
                              <td className="border-black">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max={row.maxTJ2}
                                  value={row.tj2}
                                  onChange={(e) => updateCourseCell(index, 'tj2', e.target.value)}
                                  className="table-input font-mono"
                                  placeholder="-"
                                />
                              </td>
                              <td className="border-black">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max={row.maxExam1}
                                  value={row.exam1}
                                  onChange={(e) => updateCourseCell(index, 'exam1', e.target.value)}
                                  className="table-input font-mono"
                                  placeholder="-"
                                />
                              </td>
                              <td className="border-black bg-neutral-100 font-mono font-bold text-center">
                                {sums.hasScores1 ? sums.tot1 : '-'}
                              </td>

                              {/* 2e Semestre */}
                              <td className="border-black">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max={row.maxTJ3}
                                  value={row.tj3}
                                  onChange={(e) => updateCourseCell(index, 'tj3', e.target.value)}
                                  className="table-input font-mono"
                                  placeholder="-"
                                />
                              </td>
                              <td className="border-black">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max={row.maxTJ4}
                                  value={row.tj4}
                                  onChange={(e) => updateCourseCell(index, 'tj4', e.target.value)}
                                  className="table-input font-mono"
                                  placeholder="-"
                                />
                              </td>
                              <td className="border-black">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max={row.maxExam2}
                                  value={row.exam2}
                                  onChange={(e) => updateCourseCell(index, 'exam2', e.target.value)}
                                  className="table-input font-mono"
                                  placeholder="-"
                                />
                              </td>
                              <td className="border-black bg-neutral-100 font-mono font-bold text-center">
                                {sums.hasScores2 ? sums.tot2 : '-'}
                              </td>

                              {/* Total General (T.G.) */}
                              <td className="border-black bg-neutral-200 font-mono font-extrabold text-center">
                                {sums.hasScores1 || sums.hasScores2 ? sums.totalGeneral : '-'}
                              </td>

                              {/* Examen de repêchage */}
                              <td className="border-black">
                                <input
                                  type="text"
                                  value={row.repechagePercent}
                                  onChange={(e) => updateCourseCell(index, 'repechagePercent', e.target.value)}
                                  className="table-input font-mono"
                                  placeholder="-"
                                />
                              </td>
                              <td className="border-black">
                                <input
                                  type="text"
                                  value={row.repechageSign}
                                  onChange={(e) => updateCourseCell(index, 'repechageSign', e.target.value)}
                                  className="table-input font-mono text-[8px]"
                                  placeholder="-"
                                />
                              </td>
                            </tr>
                          );
                        })}

                        {/* SUMMARIES & GENERAL MAXIMA BOTTOM BLOCK */}
                        <tr className="bg-neutral-200 font-extrabold border-t-2 border-black">
                          <td className="branch-name border-black uppercase text-[9.5px] pl-6">MAXIMA GENERAUX</td>
                          <td className="border-black font-mono text-[9px]">{globalSums.sumMaxTJ1}</td>
                          <td className="border-black font-mono text-[9px]">{globalSums.sumMaxTJ2}</td>
                          <td className="border-black font-mono text-[9px]">{globalSums.sumMaxExam1}</td>
                          <td className="border-black font-mono text-[9px] bg-neutral-300">{globalSums.sumMaxSem1}</td>
                          <td className="border-black font-mono text-[9px]">{globalSums.sumMaxTJ3}</td>
                          <td className="border-black font-mono text-[9px]">{globalSums.sumMaxTJ4}</td>
                          <td className="border-black font-mono text-[9px]">{globalSums.sumMaxExam2}</td>
                          <td className="border-black font-mono text-[9px] bg-neutral-300">{globalSums.sumMaxSem2}</td>
                          <td className="border-black font-mono text-center text-[9px] bg-neutral-900 text-white">{globalSums.sumMaxGeneral}</td>
                          <td colSpan={2} className="border-black"></td>
                        </tr>

                        <tr className="bg-neutral-100 font-extrabold">
                          <td className="branch-name border-black uppercase text-[9.5px] pl-6">TOTAUX</td>
                          <td className="border-black font-mono text-[9px]">{globalSums.hasAnyScores1 ? globalSums.sumTJ1.toFixed(1) : '-'}</td>
                          <td className="border-black font-mono text-[9px]">{globalSums.hasAnyScores1 ? globalSums.sumTJ2.toFixed(1) : '-'}</td>
                          <td className="border-black font-mono text-[9px]">{globalSums.hasAnyScores1 ? globalSums.sumExam1.toFixed(1) : '-'}</td>
                          <td className="border-black font-mono text-[9px] bg-neutral-200">{globalSums.hasAnyScores1 ? globalSums.sumTot1.toFixed(1) : '-'}</td>
                          <td className="border-black font-mono text-[9px]">{globalSums.hasAnyScores2 ? globalSums.sumTJ3.toFixed(1) : '-'}</td>
                          <td className="border-black font-mono text-[9px]">{globalSums.hasAnyScores2 ? globalSums.sumTJ4.toFixed(1) : '-'}</td>
                          <td className="border-black font-mono text-[9px]">{globalSums.hasAnyScores2 ? globalSums.sumExam2.toFixed(1) : '-'}</td>
                          <td className="border-black font-mono text-[9px] bg-neutral-200">{globalSums.hasAnyScores2 ? globalSums.sumTot2.toFixed(1) : '-'}</td>
                          <td className="border-black font-mono text-center text-[9.5px] bg-neutral-800 text-white">{globalSums.hasAnyScores1 || globalSums.hasAnyScores2 ? globalSums.sumTotalGeneral.toFixed(1) : '-'}</td>
                          <td colSpan={2} className="border-black"></td>
                        </tr>

                        <tr className="font-extrabold">
                          <td className="branch-name border-black uppercase text-[9.5px] pl-6 bg-neutral-50">POURCENTAGE</td>
                          <td colSpan={3} className="border-black"></td>
                          <td className="border-black font-mono text-[9px] bg-neutral-200">
                            {globalSums.hasAnyScores1 ? `${globalSums.percentageSem1.toFixed(2)} %` : '-'}
                          </td>
                          <td colSpan={3} className="border-black"></td>
                          <td className="border-black font-mono text-[9px] bg-neutral-200">
                            {globalSums.hasAnyScores2 ? `${globalSums.percentageSem2.toFixed(2)} %` : '-'}
                          </td>
                          <td className="border-black font-mono text-center text-[9.5px] bg-neutral-900 text-white">
                            {globalSums.hasAnyScores1 || globalSums.hasAnyScores2 ? `${globalSums.percentageGeneral.toFixed(2)} %` : '-'}
                          </td>
                          <td colSpan={2} className="border-black"></td>
                        </tr>

                        <tr className="font-bold text-xs">
                          <td className="branch-name border-black uppercase text-[9.5px] pl-6">PLACE / EFFECTIF</td>
                          <td colSpan={3} className="border-black text-center">
                            <input
                              type="text"
                              value={bulletinMetadata.placeInClass}
                              onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, placeInClass: e.target.value })}
                              placeholder="Place (ex: 1er)"
                              className="table-input w-16 font-bold text-[9px]"
                            />
                            <span className="mx-1">/</span>
                            <input
                              type="text"
                              value={bulletinMetadata.effectif}
                              onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, effectif: e.target.value })}
                              placeholder="Effectif (ex: 45)"
                              className="table-input w-14 font-bold text-[9px]"
                            />
                          </td>
                          <td className="border-black font-mono text-[9px] bg-neutral-100">
                            {bulletinMetadata.placeInClass ? `${bulletinMetadata.placeInClass} / ${bulletinMetadata.effectif || '?'}` : '-'}
                          </td>
                          <td colSpan={3} className="border-black"></td>
                          <td className="border-black"></td>
                          <td className="border-black"></td>
                          <td colSpan={2} className="border-black bg-neutral-50/50 flex items-center justify-center p-1 text-[8.5px] leading-tight font-bold">
                            <div className="flex flex-col items-start gap-0.5 w-full text-[8px]">
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name="decision"
                                  checked={bulletinMetadata.decisionText === 'PASSE'}
                                  onChange={() => setBulletinMetadata({ ...bulletinMetadata, decisionText: 'PASSE' })}
                                  className="accent-black w-2.5 h-2.5"
                                />
                                PASSE (1)
                              </label>
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name="decision"
                                  checked={bulletinMetadata.decisionText === 'DOUBLE'}
                                  onChange={() => setBulletinMetadata({ ...bulletinMetadata, decisionText: 'DOUBLE' })}
                                  className="accent-black w-2.5 h-2.5"
                                />
                                DOUBLE (1)
                              </label>
                            </div>
                          </td>
                        </tr>

                        <tr className="font-bold">
                          <td className="branch-name border-black uppercase text-[9.5px] pl-6 bg-neutral-50/30">APPLICATION</td>
                          <td colSpan={3} className="border-black">
                            <input
                              type="text"
                              value={bulletinMetadata.application}
                              onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, application: e.target.value.toUpperCase() })}
                              placeholder="A / B / C / D / E"
                              className="table-input font-bold"
                            />
                          </td>
                          <td className="border-black font-bold font-mono text-[9px]">{bulletinMetadata.application || '-'}</td>
                          <td colSpan={3} className="border-black"></td>
                          <td className="border-black"></td>
                          <td className="border-black"></td>
                          <td colSpan={2} className="border-black"></td>
                        </tr>

                        <tr className="font-bold">
                          <td className="branch-name border-black uppercase text-[9.5px] pl-6 bg-neutral-50/30">CONDUITE</td>
                          <td colSpan={3} className="border-black">
                            <input
                              type="text"
                              value={bulletinMetadata.conduite}
                              onChange={(e) => setBulletinMetadata({ ...bulletinMetadata, conduite: e.target.value.toUpperCase() })}
                              placeholder="A / B / C / D / E"
                              className="table-input font-bold"
                            />
                          </td>
                          <td className="border-black font-bold font-mono text-[9px]">{bulletinMetadata.conduite || '-'}</td>
                          <td colSpan={3} className="border-black"></td>
                          <td className="border-black"></td>
                          <td className="border-black"></td>
                          <td colSpan={2} className="border-black"></td>
                        </tr>

                      </tbody>
                    </table>
                  </div>

                  {/* Barcode & scanner block */}
                  <div className="flex justify-between items-center mt-2 px-1 border border-black p-1.5 bg-white z-10">
                    <div className="flex flex-col text-[9.5px] leading-tight font-medium text-black">
                      <span className="font-extrabold uppercase text-[8.5px] mb-0.5 text-neutral-800">Décision du Conseil d'Établissement</span>
                      <span>Classe supérieure : <strong className="underline decoration-indigo-600 decoration-1">{bulletinMetadata.decisionText === 'PASSE' ? 'PASSAGE ACCORDÉ' : bulletinMetadata.decisionText === 'DOUBLE' ? 'REDOUBLEMENT' : 'EN ATTENTE'}</strong></span>
                      <span className="text-[7.5px] text-neutral-500 mt-0.5">Le {bulletinMetadata.faitLe}</span>
                    </div>
                    <div>
                      <CSSBarcode value={`${bulletinMetadata.academicYear.replace(/\s+/g, '')}-${bulletinMetadata.permanentNumber.substring(0, 8)}`} />
                    </div>
                  </div>

                  {/* 5. Zones de signatures */}
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-black mt-2 text-[8.5px] leading-normal z-10 bg-white">
                    <div className="flex flex-col items-center text-center h-[80px]">
                      <span className="font-extrabold uppercase underline mb-0.5">Signature de l'Élève</span>
                      <div className="flex-1 flex items-center justify-center italic text-neutral-400 font-sans text-[7.5px]">
                        (Signer ici)
                      </div>
                    </div>
                    <div className="flex flex-col items-center text-center h-[80px]">
                      <span className="font-extrabold uppercase underline mb-0.5">Signature du Responsable</span>
                      <div className="flex-1 flex items-center justify-center italic text-neutral-400 font-sans text-[7.5px]">
                        (Signer ici)
                      </div>
                    </div>
                    <div className="flex flex-col items-center text-center h-[80px] border-r border-dashed border-black/30">
                      <span className="font-extrabold uppercase underline mb-0.5">Sceau de l'École</span>
                      <div className="flex-1 flex items-center justify-center text-neutral-300 font-sans mt-1">
                        <Stamp className="w-8 h-8 stroke-[1] stroke-neutral-400" />
                      </div>
                    </div>
                    <div className="flex flex-col items-center text-center h-[80px]">
                      <span className="font-extrabold uppercase underline mb-0.5">Chef d'Établissement</span>
                      <span className="text-[8px] mt-0.5 text-black font-bold">Nom et Signature</span>
                      <div className="flex-1 flex items-center justify-center italic text-neutral-400 font-sans text-[7.5px]">
                        (Signer ici)
                      </div>
                    </div>
                  </div>

                  {/* 6. Footer legals notes */}
                  <div className="border-t border-black pt-1.5 mt-auto text-[7.5px] text-neutral-800 leading-normal flex flex-col gap-0.5 z-10 bg-white">
                    <p className="italic">
                      (1) Biffer la mention inutile. Note importante : Le bulletin est sans valeur s'il est raturé ou surchargé.
                    </p>
                    <p className="font-bold text-center border-t border-black/25 pt-0.5 text-[7px] uppercase tracking-wider text-black">
                      Interdiction formelle de reproduire ce Bulletin sous peine des sanctions prévues par la loi.
                    </p>
                  </div>

                </div>
              </div>

            </div>
          )}
        </TabsContent>

        {/* ==========================================
            TAB 2: GERER LES COURS (PRESERVED)
           ========================================== */}
        <TabsContent value="courses">
          <Card className="shadow-sm border border-neutral-200 bg-white">
            <CardHeader className="bg-neutral-50/50 border-b border-neutral-100">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                    Gestion des cours et coefficients
                  </CardTitle>
                  <CardDescription>
                    Configurez les cours, leurs points (coefficients) et notes maximales dans la base de données
                  </CardDescription>
                </div>
                <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { setEditingCourse(null); setCourseForm({ name: '', points: 1, maxScore: 20, trimester1Weight: 0.5, trimester2Weight: 0.5 }); }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter un cours
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingCourse ? 'Modifier le cours' : 'Ajouter un cours'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Nom du cours</Label>
                        <Input
                          value={courseForm.name}
                          onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                          placeholder="Ex: Mathématiques"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Points (coefficient)</Label>
                          <Input
                            type="number"
                            value={courseForm.points}
                            onChange={(e) => setCourseForm({ ...courseForm, points: parseInt(e.target.value) || 1 })}
                            min={1}
                            max={10}
                          />
                          <p className="text-xs text-muted-foreground">Ex: Mathématiques = 5 points</p>
                        </div>
                        <div className="space-y-2">
                          <Label>Note maximale</Label>
                          <Input
                            type="number"
                            value={courseForm.maxScore}
                            onChange={(e) => setCourseForm({ ...courseForm, maxScore: parseFloat(e.target.value) || 20 })}
                            min={10}
                            max={100}
                          />
                          <p className="text-xs text-muted-foreground">Généralement sur 20</p>
                        </div>
                      </div>
                      <Button onClick={editingCourse ? handleUpdateCourse : handleAddCourse} className="w-full">
                        {editingCourse ? 'Modifier' : 'Ajouter'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="space-y-4">
                <div className="w-full md:w-96">
                  <Label>Classe</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une classe" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedClass && (
                  <div className="border border-neutral-200 rounded-lg overflow-hidden mt-4">
                    <Table>
                      <TableHeader className="bg-neutral-50">
                        <TableRow>
                          <TableHead>Cours</TableHead>
                          <TableHead className="text-center w-24">Points</TableHead>
                          <TableHead className="text-center w-24">Note Max</TableHead>
                          <TableHead className="text-center w-24">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {courses.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              Aucun cours configuré pour cette classe
                            </TableCell>
                          </TableRow>
                        ) : (
                          courses.map((course) => (
                            <TableRow key={course.id}>
                              <TableCell className="font-medium text-neutral-800">{course.name}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary">{course.points}</Badge>
                              </TableCell>
                              <TableCell className="text-center text-neutral-600">/{course.maxScore}</TableCell>
                              <TableCell className="text-center">
                                <div className="flex justify-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingCourse(course);
                                      setCourseForm({
                                        name: course.name,
                                        points: course.points,
                                        maxScore: course.maxScore,
                                        trimester1Weight: course.trimester1Weight,
                                        trimester2Weight: course.trimester2Weight,
                                      });
                                      setCourseDialogOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteCourse(course.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==========================================
            TAB 3: ARCHIVES BULLETINS (NEW)
           ========================================== */}
        <TabsContent value="archive">
          <Card className="shadow-sm border border-neutral-200 bg-white">
            <CardHeader className="bg-neutral-50/50 border-b border-neutral-100 flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Archive className="h-5 w-5 text-blue-600" />
                  Bulletins Scolaires Archivés (RDC)
                </CardTitle>
                <CardDescription>
                  Explorez et gérez les bulletins déjà générés et enregistrés par classe et par élève.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowImportReports(true)}
                  className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  <Upload className="h-4 w-4" />
                  Importer des bulletins
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchArchive}
                  disabled={archiveLoading}
                  className="gap-2 border-neutral-200"
                >
                  <RotateCcw className={`h-4 w-4 ${archiveLoading ? 'animate-spin' : ''}`} />
                  Actualiser
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {archiveLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Skeleton className="h-32 rounded-xl" />
                    <Skeleton className="h-32 rounded-xl" />
                    <Skeleton className="h-32 rounded-xl" />
                  </div>
                </div>
              ) : archiveReports.length === 0 ? (
                <div className="text-center py-12">
                  <File className="h-16 w-16 text-neutral-300 mx-auto mb-4 stroke-[1]" />
                  <h3 className="font-bold text-lg text-neutral-700">Aucun bulletin archivé</h3>
                  <p className="text-neutral-500 max-w-sm mx-auto text-sm mt-1">
                    Générez un bulletin depuis l'onglet "Dessiner Bulletin" en mode Base de Données et cliquez sur "Enregistrer en BDD" pour le voir apparaître ici.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Niveau 1 : Choix de la classe */}
                  {selectedArchiveClass === null ? (
                    <div>
                      <h4 className="font-bold text-sm text-neutral-500 uppercase tracking-wider mb-4">Classes (Dossiers)</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {(() => {
                          const classesMap = new Map();
                          archiveReports.forEach(r => {
                            const clsName = r.class?.name || "Classe Inconnue";
                            if (!classesMap.has(clsName)) {
                              classesMap.set(clsName, 0);
                            }
                            classesMap.set(clsName, classesMap.get(clsName) + 1);
                          });
                          return Array.from(classesMap.entries()).map(([className, count]) => (
                            <button
                              key={className}
                              onClick={() => setSelectedArchiveClass(className)}
                              className="flex flex-col items-start p-4 border border-neutral-200 hover:border-blue-500 bg-neutral-50/50 hover:bg-white rounded-xl shadow-sm transition-all text-left group"
                            >
                              <div className="flex items-center gap-3 w-full mb-3">
                                <div className="p-2 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors">
                                  <Folder className="h-8 w-8 text-amber-500 fill-amber-100 group-hover:scale-105 transition-transform" />
                                </div>
                                <span className="font-mono text-xs font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full ml-auto">
                                  {count} {count > 1 ? 'fichiers' : 'fichier'}
                                </span>
                              </div>
                              <span className="font-bold text-neutral-800 text-sm line-clamp-2 w-full group-hover:text-blue-600 transition-colors">
                                {className}
                              </span>
                            </button>
                          ));
                        })()}
                      </div>
                    </div>
                  ) : selectedArchiveStudent === null ? (
                    /* Niveau 2 : Choix de l'élève */
                    <div>
                      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-6 bg-neutral-50 p-2.5 rounded-lg border border-neutral-150">
                        <button 
                          onClick={() => setSelectedArchiveClass(null)} 
                          className="hover:text-blue-600 font-semibold flex items-center gap-1 transition-colors"
                        >
                          <FolderOpen className="h-4 w-4 text-amber-500 fill-amber-50" />
                          Archives
                        </button>
                        <ChevronRight className="h-4 w-4" />
                        <span className="text-neutral-800 font-bold">{selectedArchiveClass}</span>
                      </div>
                      
                      <h4 className="font-bold text-sm text-neutral-500 uppercase tracking-wider mb-4">Élèves (Bulletins)</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {(() => {
                          const studentsMap = new Map();
                          archiveReports
                            .filter(r => (r.class?.name || "Classe Inconnue") === selectedArchiveClass)
                            .forEach(r => {
                              const sName = r.studentName;
                              if (!studentsMap.has(sName)) {
                                studentsMap.set(sName, 0);
                              }
                              studentsMap.set(sName, studentsMap.get(sName) + 1);
                            });
                          return Array.from(studentsMap.entries()).map(([studentName, count]) => (
                            <button
                              key={studentName}
                              onClick={() => setSelectedArchiveStudent(studentName)}
                              className="flex flex-col items-start p-4 border border-neutral-200 hover:border-blue-500 bg-neutral-50/50 hover:bg-white rounded-xl shadow-sm transition-all text-left group"
                            >
                              <div className="flex items-center gap-3 w-full mb-3">
                                <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                                  <Users className="h-7 w-7 text-blue-500 group-hover:scale-105 transition-transform" />
                                </div>
                                <span className="font-mono text-xs font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full ml-auto">
                                  {count} {count > 1 ? 'bulletins' : 'bulletin'}
                                </span>
                              </div>
                              <span className="font-bold text-neutral-800 text-sm line-clamp-1 w-full group-hover:text-blue-600 transition-colors">
                                {studentName}
                              </span>
                            </button>
                          ));
                        })()}
                      </div>
                    </div>
                  ) : (
                    /* Niveau 3 : Liste des bulletins de l'élève */
                    <div>
                      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-6 bg-neutral-50 p-2.5 rounded-lg border border-neutral-150">
                        <button 
                          onClick={() => { setSelectedArchiveClass(null); setSelectedArchiveStudent(null); }} 
                          className="hover:text-blue-600 font-semibold flex items-center gap-1 transition-colors"
                        >
                          <FolderOpen className="h-4 w-4 text-amber-500 fill-amber-50" />
                          Archives
                        </button>
                        <ChevronRight className="h-4 w-4" />
                        <button 
                          onClick={() => setSelectedArchiveStudent(null)} 
                          className="hover:text-blue-600 font-semibold transition-colors"
                        >
                          {selectedArchiveClass}
                        </button>
                        <ChevronRight className="h-4 w-4" />
                        <span className="text-neutral-800 font-bold">{selectedArchiveStudent}</span>
                      </div>

                      <h4 className="font-bold text-sm text-neutral-500 uppercase tracking-wider mb-4">Liste des bulletins enregistrés</h4>
                      <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-sm bg-white">
                        <Table>
                          <TableHeader className="bg-neutral-50">
                            <TableRow>
                              <TableHead className="font-bold text-neutral-700">N° Bulletin</TableHead>
                              <TableHead className="font-bold text-neutral-700">Période / Trimestre</TableHead>
                              <TableHead className="font-bold text-neutral-700">Année Scolaire</TableHead>
                              <TableHead className="font-bold text-neutral-700">Points & Pourcentage</TableHead>
                              <TableHead className="font-bold text-neutral-700">Mention</TableHead>
                              <TableHead className="font-bold text-neutral-700">Date d'enregistrement</TableHead>
                              <TableHead className="font-bold text-neutral-700 text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const studentReports = archiveReports.filter(
                                r => (r.class?.name || "Classe Inconnue") === selectedArchiveClass && r.studentName === selectedArchiveStudent
                              );
                              return studentReports.map((report) => (
                                <TableRow key={report.id} className="hover:bg-neutral-50/50">
                                  <TableCell className="font-mono font-bold text-sm text-blue-600">
                                    {report.reportNumber}
                                  </TableCell>
                                  <TableCell className="font-semibold text-neutral-700">
                                    {report.trimester === '1' ? '1er Semestre' : report.trimester === '2' ? '2d Semestre' : `Période ${report.trimester}`}
                                  </TableCell>
                                  <TableCell className="font-semibold text-neutral-600">
                                    {report.academicYear}
                                  </TableCell>
                                  <TableCell className="font-mono text-sm font-semibold">
                                    {report.totalPointsObtained.toFixed(1)} / {report.totalPointsPossible.toFixed(1)}
                                    <span className="ml-2 font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                      {report.overallPercentage.toFixed(2)} %
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <Badge 
                                      className={report.overallPercentage >= 50 
                                        ? 'bg-green-100 hover:bg-green-150 text-green-800 font-bold border-green-200' 
                                        : 'bg-red-100 hover:bg-red-150 text-red-800 font-bold border-red-200'
                                      }
                                      variant="outline"
                                    >
                                      {report.overallPercentage >= 50 ? 'Passage (Admis)' : 'Ajourné'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-neutral-500 text-xs">
                                    {new Date(report.createdAt).toLocaleDateString('fr-FR', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleLoadArchivedBulletin(report)}
                                        className="gap-1 border-neutral-200 hover:border-blue-500 hover:text-blue-600 text-xs font-semibold"
                                        title="Charger dans l'éditeur pour visualiser ou modifier"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Visualiser / Éditer
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePrintArchived(report)}
                                        className="gap-1 border-neutral-200 hover:border-indigo-500 hover:text-indigo-600 text-xs font-semibold"
                                        title="Charger et lancer l'impression A4"
                                      >
                                        <Printer className="h-3.5 w-3.5" />
                                        Imprimer
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteArchived(report.id)}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        title="Supprimer définitivement"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ));
                            })()}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==========================================
            TAB 4: STATISTIQUES (UPDATED)
           ========================================== */}
        <TabsContent value="stats">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-sm border border-neutral-200 bg-white">
              <CardHeader className="bg-neutral-50/50 border-b border-neutral-100">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Statistiques de la plateforme
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                {reportStats ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-blue-600">{reportStats.totalGenerated.toLocaleString()}</p>
                      <p className="text-sm text-neutral-500 font-semibold mt-1">Bulletins générés par cette école</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-500 font-semibold">Consommation de la limite nationale (1.000.000 / an)</span>
                        <span className="font-bold text-neutral-800">{reportStats.percentageUsed.toFixed(4)}%</span>
                      </div>
                      <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all"
                          style={{ width: `${Math.min(reportStats.percentageUsed, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-neutral-500">
                        <span>{reportStats.globalGenerated.toLocaleString()} bulletins générés globalement</span>
                        <span>{reportStats.remaining.toLocaleString()} bulletins restants</span>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="font-bold text-sm text-neutral-700">Par année scolaire (cette école)</h4>
                      {Object.entries(reportStats.byYear).map(([year, count]) => (
                        <div key={year} className="flex justify-between text-sm">
                          <span className="text-neutral-600">{year}</span>
                          <span className="font-bold text-neutral-800">{count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Chargement des statistiques...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border border-neutral-200 bg-white">
              <CardHeader className="bg-neutral-50/50 border-b border-neutral-100">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  À propos du système officiel
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm text-neutral-600">Numérotation unique officielle par école</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-sm text-neutral-600">Limite nationale : 1.000.000 bulletins</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-sm text-neutral-600">Archivage et traçabilité par code-barres unique</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span className="text-sm text-neutral-600">Impression A4 et PDF vectoriels intégrés</span>
                  </div>
                </div>
                <div className="bg-blue-50/40 border border-blue-100 p-4 rounded-xl">
                  <p className="text-xs text-center text-blue-800 leading-relaxed font-semibold">
                    🇨🇩 République Démocratique du Congo<br />
                    Ministère de l'Éducation Nationale et Nouvelle Citoyenneté<br />
                    Secrétariat Général à l'Enseignement Primaire, Secondaire et Technique
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <DocumentImportDialog
        open={showImportReports}
        onOpenChange={setShowImportReports}
        title="Importer des bulletins"
        description="Importez les bulletins depuis un document PDF, Word (.docx) ou une photo : chaque ligne correspond à un bulletin d'élève."
                expectedColumns={['Classe', 'Élève', 'Matricule', 'Trimestre', 'Moyenne', 'Rang', 'Mention']}
        sampleRows={[
          ['6ème A', 'Jean KABILA', '2025001', 1, 14.5, 3, 'Très Bien'],
          ['6ème A', 'Marie MBALA', '2025002', 1, 11, 12, ''],
          ['5ème B', 'Paul ILUNGA', '2024045', 1, 9.5, 18, ''],
        ]}
        columnHints={[
          { header: 'Classe', hint: 'nom exact de la classe' },
          { header: 'Élève', hint: 'nom complet ou matricule (voir Matricule)' },
          { header: 'Matricule', hint: 'facultatif, identifiant de l\u2019élève' },
          { header: 'Trimestre', hint: '1, 2 ou 3' },
          { header: 'Moyenne', hint: 'sur 20 (obligatoire)' },
          { header: 'Rang', hint: 'facultatif' },
          { header: 'Mention', hint: 'facultatif, calculée si absente' },
        ]}
        onImport={handleImportReports}
      />
    </div>
  );
}