'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { QRCodeSVG } from 'qrcode.react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { 
  IdCard, Printer, RefreshCw, Phone, Edit, Calendar, User, 
  BookOpen, GraduationCap, Building2, Upload, CreditCard, 
  ExternalLink, Loader2, Mail, MapPin, Hash, Shield, 
  CheckCircle, School, Users, Eye, EyeOff, RotateCw, Download 
} from 'lucide-react';
import { toast } from 'sonner';
import IdCard3D from './IdCard3D';

interface EnrolledClassInfo {
  class: { id: string; name: string; level: string };
}

interface StudentItem {
  id: string;
  fullName: string;
  email?: string;
  postName?: string;
  gender?: string;
  birthDate?: string;
  matricule?: string;
  specialty?: string;
  qualification?: string;
  ine?: string;
  phone?: string;
  parentPhone?: string;
  parentPhone2?: string;
  parentEmail?: string;
  address?: string;
  academicYear?: string;
  section?: string;
  photoUrl?: string;
  cardId?: string;
  cardIssuedDate?: string;
  cardExpiryDate?: string;
  classEnrollments?: EnrolledClassInfo[];
  password?: string;
  className?: string;
  bloodType?: string;
  nationality?: string;
  tuteur?: string;
  contactTuteur?: string;
  allergies?: string;
  assurance?: string;
}

export default function AdminCards() {
  const { user } = useAppStore();
  const [usersList, setUsersList] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [cardRole, setCardRole] = useState<'STUDENT' | 'TEACHER'>('STUDENT');
  const [schoolLogo, setSchoolLogo] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [schoolColor, setSchoolColor] = useState('#2563eb');
  const [schoolAcademicYear, setSchoolAcademicYear] = useState('');
  const [schoolEmail, setSchoolEmail] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  // Edit/Create State
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState<Partial<StudentItem>>({});

  // Payment states
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pawapay' | 'card'>('pawapay');
  const [paymentAuthorized, setPaymentAuthorized] = useState(false);

  // Check if payment was successful on mount (from URL params)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const paymentStatus = params.get('payment');
      if (paymentStatus === 'success') {
        setPaymentAuthorized(true);
        setShowPaymentDialog(false);
        toast.success('✅ Paiement de 10 USD réussi ! Vous pouvez maintenant créer la carte.', { duration: 5000 });
        window.history.replaceState({}, '', window.location.pathname);
        setTimeout(() => openCreateModal(), 300);
      } else if (paymentStatus === 'cancel') {
        setShowPaymentDialog(false);
        toast.error('Paiement annulé. Vous devez payer 10 USD pour créer une carte.');
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const handleInitiatePayment = async () => {
    if (paymentMethod === 'pawapay' && !/^\+243\d{9}$/.test(paymentPhone.replace(/\s/g, ''))) {
      toast.error('Saisissez un numéro congolais valide au format +243XXXXXXXXX.');
      return;
    }
    setPaymentLoading(true);
    try {
      const successUrl = `${window.location.origin}/api/payments/geniuspay/success?schoolId=${user?.schoolId}&action=generate-single&userId=new-card`;
      const cancelUrl = `${window.location.origin}/api/payments/geniuspay/cancel`;

      const res = await fetch('/api/payments/geniuspay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 10,
          currency: 'USD',
          paymentMethod,
          customer: {
            name: user?.fullName || 'Administrateur LaBorneTRAIT',
            phone: paymentPhone.replace(/\s/g, ''),
            country: 'CD',
          },
          description: 'LaBorneTRAIT - Création de carte d\'identité scolaire',
          successUrl,
          cancelUrl,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur paiement');
      }

      const data = await res.json();
      
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        throw new Error('URL de paiement manquante');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de l\'initialisation du paiement');
      setPaymentLoading(false);
    }
  };

  const fetchUsersList = useCallback(async () => {
    if (!user?.schoolId) {
      setUsersList([]);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/users?schoolId=${user?.schoolId}&role=${cardRole}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur lors du chargement des cartes');
      }
      const data = await res.json();
      setUsersList(Array.isArray(data.users) ? data.users : []);
    } catch (error: unknown) {
      setUsersList([]);
      toast.error(error instanceof Error ? error.message : cardRole === 'STUDENT' ? 'Erreur lors du chargement des élèves' : 'Erreur lors du chargement des enseignants');
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId, cardRole]);

  const fetchSchoolLogo = useCallback(async () => {
    if (!user?.schoolId) return;
    try {
      const res = await fetch(`/api/config?schoolId=${user.schoolId}`);
      const data = await res.json();
      if (data.config) {
        const config = data.config;
        setSchoolLogo(config.logoUrl || user?.school?.logoUrl || '');
        setSchoolName(config.name || user?.school?.name || '');
        setSchoolColor(config.color || user?.school?.color || '#2563eb');
        setSchoolAcademicYear(config.academicYear || user?.school?.academicYear || '');
        setSchoolEmail(config.email || '');
        // Build address from commune + city + province
        const parts = [config.commune, config.city, config.province].filter(Boolean);
        setSchoolAddress(parts.join(', '));
      }
    } catch {
      // silencieux
    }
  }, [user?.schoolId]);

  useEffect(() => {
    if (user?.schoolId) {
      fetchUsersList();
      fetchSchoolLogo();
    }
  }, [fetchUsersList, fetchSchoolLogo, user?.schoolId]);

  const generateCards = async (action: 'generate-all' | 'generate-class' | 'generate-single', classId?: string, studentId?: string) => {
    try {
      setGenerating(true);
      const payload = {
        schoolId: user?.schoolId,
        action,
        classId,
        userId: studentId,
      };
      const res = await fetch('/api/users/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(action === 'generate-single' ? 'Carte générée avec succès !' : `${data.generatedCount || 0} carte(s) générée(s) avec succès !`);
      fetchUsersList();
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  const openEditModal = (student: StudentItem) => {
    setEditingStudent(student);
    setIsCreating(false);
    setFormData({
      fullName: student.fullName,
      email: student.email || '',
      postName: student.postName || '',
      gender: student.gender || 'M',
      birthDate: student.birthDate || '',
      matricule: student.matricule || '',
      specialty: student.specialty || '',
      qualification: student.qualification || '',
      phone: student.phone || '',
      parentPhone: student.parentPhone || '',
      parentPhone2: student.parentPhone2 || '',
      parentEmail: student.parentEmail || '',
      address: student.address || '',
      academicYear: student.academicYear || new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
      section: student.section || '',
      photoUrl: student.photoUrl || '',
      className: student.classEnrollments?.[0]?.class?.name || '',
      bloodType: student.bloodType || '',
      nationality: student.nationality || '',
      ine: student.ine || student.cardId || '',
      tuteur: student.tuteur || '',
      contactTuteur: student.contactTuteur || '',
      allergies: student.allergies || '',
      assurance: student.assurance || '',
      cardIssuedDate: student.cardIssuedDate || '',
      cardExpiryDate: student.cardExpiryDate || '',
    });
  };

  const openCreateModal = () => {
    setEditingStudent(null);
    setIsCreating(true);
    setFormData({
      fullName: '',
      email: '',
      postName: '',
      gender: 'M',
      birthDate: '',
      matricule: '',
      specialty: '',
      qualification: '',
      phone: '',
      parentPhone: '',
      parentPhone2: '',
      parentEmail: '',
      address: '',
      academicYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
      section: '',
      photoUrl: '',
      className: '',
      bloodType: '',
      nationality: '',
      password: Math.random().toString(36).slice(-8),
    });
  };

  useEffect(() => {
    if (isCreating && formData.fullName) {
      const firstLetter = formData.fullName.trim().charAt(0).toUpperCase();
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const autoMatricule = `${firstLetter}${year}${month}`;
      if (!formData.matricule || formData.matricule.startsWith(firstLetter)) {
        setFormData(prev => ({ ...prev, matricule: autoMatricule }));
      }
    }
  }, [formData.fullName, isCreating]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('L\'image est trop grande (max 2MB)');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await fetch('/api/upload/photo', {
        method: 'POST',
        body: fd,
      });
      if (res.ok) {
        const { url } = await res.json();
        setFormData(prev => ({ ...prev, photoUrl: url }));
        toast.success('Photo uploadée');
      } else {
        toast.error('Erreur upload');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (isCreating && !formData.fullName) {
      toast.error('Le nom complet est obligatoire.');
      return;
    }
    if (cardRole === 'TEACHER') {
      if (!formData.specialty?.trim()) {
        toast.error('La spécialité est obligatoire pour un professeur.');
        return;
      }
      if (!formData.phone?.trim()) {
        toast.error('Le numéro de téléphone est obligatoire pour un professeur.');
        return;
      }
    }
    setSubmitting(true);
    try {
      if (isCreating) {
        const res = await fetch(`/api/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            schoolId: user?.schoolId, 
            role: cardRole,
            useFreeCard: !paymentAuthorized,
            paymentAuthorized,
            ...formData 
          }),
        });
        if (!res.ok) throw new Error('Erreur lors de la création');
        toast.success(cardRole === 'STUDENT' ? 'Nouvelle carte (élève) créée avec succès' : 'Nouvelle carte (enseignant) créée avec succès');
      } else if (editingStudent) {
        const res = await fetch(`/api/users`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: editingStudent.id, ...formData }),
        });
        if (!res.ok) throw new Error('Erreur de mise à jour');
        toast.success('Informations mises à jour');
      }
      setIsCreating(false);
      setEditingStudent(null);
      fetchUsersList();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Grouping logic (Only for students. Teachers will be shown in a single list)
  const classesMap = new Map<string, { id: string; name: string; students: StudentItem[] }>();
  classesMap.set('UNASSIGNED', { id: 'unassigned', name: 'Sans Classe', students: [] });

  if (cardRole === 'STUDENT') {
    usersList.forEach((s) => {
      if (!s.classEnrollments || s.classEnrollments.length === 0) {
        classesMap.get('UNASSIGNED')!.students.push(s);
      } else {
        s.classEnrollments.forEach((enrollment) => {
          const cls = enrollment.class;
          if (!classesMap.has(cls.id)) classesMap.set(cls.id, { id: cls.id, name: cls.name, students: [] });
          classesMap.get(cls.id)!.students.push(s);
        });
      }
    });
  }

  if (classesMap.get('UNASSIGNED')!.students.length === 0) classesMap.delete('UNASSIGNED');
  const allClasses = Array.from(classesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  
  const filteredStudents = cardRole === 'TEACHER' 
    ? usersList 
    : (activeTab === 'ALL' ? usersList : activeTab === 'UNASSIGNED' ? classesMap.get('UNASSIGNED')?.students || [] : classesMap.get(activeTab)?.students || []);

  const StudentCard = ({ student }: { student: StudentItem }) => {
    return (
      <div className="break-inside-avoid relative group border border-border/60 rounded-3xl p-4 bg-muted/10 shadow-sm flex flex-col items-center">
        {/* Button to edit card details */}
        <div className="absolute top-2 right-2 z-10 no-print">
          <Button 
            onClick={() => openEditModal(student)}
            className="rounded-full shadow-md h-9 w-9 p-0 bg-white hover:bg-slate-100 text-blue-600 border border-slate-200"
            title="Modifier la carte"
          >
            <Edit className="w-4 h-4" />
          </Button>
        </div>

        {/* The 3D double-sided interactive card */}
        <IdCard3D 
          user={{
            ...student,
            role: cardRole,
            roleLabel: cardRole === 'STUDENT' ? 'Élève' : 'Enseignant',
            className: student.classEnrollments?.[0]?.class?.name || student.className,
            courseName: student.section,
            specialty: student.specialty,
            qualification: student.qualification,
            address: student.address,
            cardIssuedDate: student.cardIssuedDate,
            ine: student.cardId || student.id.slice(-8),
          }} 
          school={{
            name: schoolName || user?.school?.name || 'Établissement LaBorneTRAIT',
            logoUrl: schoolLogo || user?.school?.logoUrl || '',
            color: schoolColor || user?.school?.color || '#2563eb',
            academicYear: schoolAcademicYear || user?.school?.academicYear || new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
            email: schoolEmail,
          }}
          role={cardRole} 
        />
        <div className="mt-4 w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Informations de la carte</p>
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
            <p><span className="text-slate-500">Matricule :</span> <span className="font-semibold">{student.matricule || 'Non attribué'}</span></p>
            <p><span className="text-slate-500">Statut :</span> <span className="font-semibold">{student.cardId ? 'Carte créée' : 'ID à générer'}</span></p>
            {cardRole === 'STUDENT' && <p><span className="text-slate-500">Classe :</span> <span className="font-semibold">{student.classEnrollments?.[0]?.class?.name || student.className || 'Non attribuée'}</span></p>}
            {cardRole === 'TEACHER' && <p><span className="text-slate-500">Spécialité :</span> <span className="font-semibold">{student.specialty || 'Non renseignée'}</span></p>}
            <p><span className="text-slate-500">Téléphone :</span> <span className="font-semibold">{student.phone || 'Non renseigné'}</span></p>
            <p><span className="text-slate-500">Email :</span> <span className="font-semibold break-all">{student.email || 'Non renseigné'}</span></p>
            {cardRole === 'STUDENT' && <p><span className="text-slate-500">Tuteur :</span> <span className="font-semibold">{student.tuteur || 'Non renseigné'}</span></p>}
            {cardRole === 'STUDENT' && <p><span className="text-slate-500">Contact tuteur :</span> <span className="font-semibold">{student.contactTuteur || student.parentPhone || 'Non renseigné'}</span></p>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          #print-section, #print-section * { visibility: visible; }
          #print-section { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%;
            background: white;
          }
          .no-print { display: none !important; }
          @page { 
            margin: 0.5cm;
            size: A4;
          }
          .break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}} />

      {/* En-tête */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <IdCard className="w-6 h-6 text-blue-600" /> 
              Cartes d&apos;Identité Scolaires
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gérez et téléchargez les cartes d&apos;identification recto-verso pour les élèves et enseignants
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowPaymentDialog(true)} className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md">
              <CreditCard className="w-4 h-4 mr-2" />
              Nouvelle Carte — 10 USD
            </Button>
            <Button variant="outline" onClick={() => generateCards('generate-all')} disabled={generating || usersList.length === 0}>
              <RefreshCw className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
              Générer IDs
            </Button>
            <Button onClick={handlePrint} disabled={filteredStudents.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Printer className="h-4 w-4 mr-2" /> Imprimer tout
            </Button>
          </div>
        </div>
      </div>

      {/* Rôle Selector Segmented Control */}
      <div className="no-print mb-4 bg-muted/40 p-1.5 rounded-xl inline-flex gap-2">
        <Button 
          variant={cardRole === 'STUDENT' ? 'default' : 'ghost'} 
          onClick={() => { setCardRole('STUDENT'); setActiveTab('ALL'); }}
          className="rounded-lg text-sm gap-2"
        >
          <Users className="w-4 h-4" />
          Élèves
        </Button>
        <Button 
          variant={cardRole === 'TEACHER' ? 'default' : 'ghost'} 
          onClick={() => { setCardRole('TEACHER'); setActiveTab('ALL'); }}
          className="rounded-lg text-sm gap-2"
        >
          <GraduationCap className="w-4 h-4" />
          Enseignants
        </Button>
      </div>

      {/* Onglets de filtrage par classe (Uniquement pour les élèves) */}
      {cardRole === 'STUDENT' && (
        <div className="no-print">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="overflow-x-auto pb-2">
              <TabsList className="inline-flex w-max">
                <TabsTrigger value="ALL" className="gap-1.5">
                  Tous 
                  <Badge variant="secondary" className="ml-1 text-xs">{usersList.length}</Badge>
                </TabsTrigger>
                {allClasses.map((c) => (
                  <TabsTrigger key={c.id} value={c.id} className="gap-1.5">
                    {c.name} 
                    <Badge variant="secondary" className="ml-1 text-xs">{c.students.length}</Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
        </div>
      )}

      {/* Liste des cartes */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[320px] w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-16 no-print bg-muted/20 rounded-xl border border-dashed">
          <IdCard className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Aucun {cardRole === 'STUDENT' ? 'élève' : 'enseignant'} trouvé</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Commencez par créer une nouvelle carte d&apos;identité
          </p>
        </div>
      ) : (
        <div ref={printRef} id="print-section" className="grid grid-cols-1 lg:grid-cols-2 gap-6 content-start print:grid-cols-2 print:gap-4">
          {filteredStudents.map((student) => (
            <StudentCard key={student.id} student={student} />
          ))}
        </div>
      )}

      {/* Dialog de paiement */}
      <Dialog open={showPaymentDialog} onOpenChange={(open) => {
        setShowPaymentDialog(open);
        if (open) setPaymentPhone(user?.phone || '');
      }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="p-1.5 rounded-lg bg-emerald-50">
                <CreditCard className="h-5 w-5 text-emerald-600" />
              </div>
              Paiement requis — 10 USD
            </DialogTitle>
            <DialogDescription>
              Un paiement de <strong>10 USD</strong> est requis pour créer une nouvelle carte d'identité scolaire.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 p-6 text-center border border-emerald-200">
              <p className="text-sm text-muted-foreground mb-2">Montant à payer</p>
              <p className="text-4xl font-bold text-emerald-600">10 USD</p>
              <p className="text-xs text-muted-foreground mt-2">Paiement unique par carte</p>
            </div>

            <div className="space-y-2">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
                <p className="font-semibold">Paiement Mobile Money RDC</p>
                <p className="mt-1 text-xs leading-relaxed text-blue-800 break-words">
                  Vous payez 10 USD. Avec Mobile Money, le montant sera débité en francs congolais selon le taux affiché par GeniusPay. Avec une carte Visa, le paiement reste en USD.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Mode de paiement</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button type="button" variant={paymentMethod === 'pawapay' ? 'default' : 'outline'} onClick={() => setPaymentMethod('pawapay')} className="h-auto whitespace-normal py-2">Mobile Money RDC</Button>
                  <Button type="button" variant={paymentMethod === 'card' ? 'default' : 'outline'} onClick={() => setPaymentMethod('card')} className="h-auto whitespace-normal py-2">Carte Visa / bancaire</Button>
                </div>
              </div>
              {paymentMethod === 'pawapay' && (
              <div className="space-y-1.5">
                <Label htmlFor="card-payment-phone">Numéro Mobile Money RDC *</Label>
                <Input
                  id="card-payment-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="+243XXXXXXXXX"
                  value={paymentPhone}
                  onChange={(event) => setPaymentPhone(event.target.value)}
                  disabled={paymentLoading}
                />
                <p className="text-xs text-muted-foreground">Format requis : +243 suivi de 9 chiffres.</p>
              </div>
              )}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <IdCard className="h-5 w-5 text-blue-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Carte premium avec QR code</p>
                  <p className="text-xs text-muted-foreground">Design moderne et sécurisé</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <RefreshCw className="h-5 w-5 text-purple-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Mise à jour en temps réel</p>
                  <p className="text-xs text-muted-foreground">Notifications envoyées</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)} disabled={paymentLoading}>
              Annuler
            </Button>
            <Button
              onClick={handleInitiatePayment}
              disabled={paymentLoading}
              className="bg-gradient-to-r from-emerald-600 to-emerald-500"
            >
              {paymentLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Redirection...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Payer 10 USD avec GeniusPay
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog d'édition/création */}
      <Dialog open={!!editingStudent || isCreating} onOpenChange={(o) => { if (!o) { setEditingStudent(null); setIsCreating(false); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IdCard className="w-5 h-5" />
              {isCreating ? 'Créer une nouvelle carte' : 'Modifier la carte'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
            <div className="space-y-2">
              <Label>Nom Complet *</Label>
              <Input 
                value={formData.fullName || ''} 
                onChange={(e) => setFormData({...formData, fullName: e.target.value})} 
                placeholder="Nom et prénom"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Post-nom</Label>
              <Input 
                value={formData.postName || ''} 
                onChange={(e) => setFormData({...formData, postName: e.target.value})} 
                placeholder="Nom du père"
              />
            </div>

            <div className="space-y-2">
              <Label>Email (Prof / Élève)</Label>
              <Input 
                type="email"
                value={formData.email || ''} 
                onChange={(e) => setFormData({...formData, email: e.target.value})} 
                placeholder="Ex: prof@ecole.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Sexe</Label>
              <Select value={formData.gender || 'M'} onValueChange={(v) => setFormData({...formData, gender: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculin</SelectItem>
                  <SelectItem value="F">Féminin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {cardRole === 'TEACHER' && (
              <>
                <div className="space-y-2">
                  <Label>Spécialité *</Label>
                  <Input 
                    value={formData.specialty || ''} 
                    onChange={(e) => setFormData({...formData, specialty: e.target.value})} 
                    placeholder="Ex: Mathématiques"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Qualification</Label>
                  <Input 
                    value={formData.qualification || ''} 
                    onChange={(e) => setFormData({...formData, qualification: e.target.value})} 
                    placeholder="Ex: Licence, Master"
                  />
                </div>
              </>
            )}
            
            <div className="space-y-2">
              <Label>Date de naissance</Label>
              <Input 
                type="date" 
                value={formData.birthDate || ''} 
                onChange={(e) => setFormData({...formData, birthDate: e.target.value})} 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Matricule</Label>
              <Input 
                value={formData.matricule || ''} 
                onChange={(e) => setFormData({...formData, matricule: e.target.value})} 
                placeholder="Numéro d'identification"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Groupe Sanguin</Label>
              <Select value={formData.bloodType || ''} onValueChange={(v) => setFormData({...formData, bloodType: v})}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A+">A+</SelectItem>
                  <SelectItem value="A-">A-</SelectItem>
                  <SelectItem value="B+">B+</SelectItem>
                  <SelectItem value="B-">B-</SelectItem>
                  <SelectItem value="AB+">AB+</SelectItem>
                  <SelectItem value="AB-">AB-</SelectItem>
                  <SelectItem value="O+">O+</SelectItem>
                  <SelectItem value="O-">O-</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Nationalité</Label>
              <Input 
                value={formData.nationality || ''} 
                onChange={(e) => setFormData({...formData, nationality: e.target.value})} 
                placeholder="Nationalité"
              />
            </div>

            <div className="space-y-2">
              <Label>INE / Identifiant National</Label>
              <Input 
                value={formData.ine || ''} 
                onChange={(e) => setFormData({...formData, ine: e.target.value})} 
                placeholder="Identifiant National Élève"
              />
            </div>

            <div className="space-y-2">
              <Label>Tuteur</Label>
              <Input 
                value={formData.tuteur || ''} 
                onChange={(e) => setFormData({...formData, tuteur: e.target.value})} 
                placeholder="Nom du tuteur"
              />
            </div>

            <div className="space-y-2">
              <Label>Contact Tuteur</Label>
              <Input 
                value={formData.contactTuteur || ''} 
                onChange={(e) => setFormData({...formData, contactTuteur: e.target.value})} 
                placeholder="Téléphone du tuteur"
              />
            </div>

            <div className="space-y-2">
              <Label>Allergies</Label>
              <Input 
                value={formData.allergies || ''} 
                onChange={(e) => setFormData({...formData, allergies: e.target.value})} 
                placeholder="Ex: Arachides, Latex"
              />
            </div>

            <div className="space-y-2">
              <Label>Assurance</Label>
              <Input 
                value={formData.assurance || ''} 
                onChange={(e) => setFormData({...formData, assurance: e.target.value})} 
                placeholder="Nom de l'assurance"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Classe</Label>
              <Input 
                value={formData.className || ''} 
                onChange={(e) => setFormData({...formData, className: e.target.value})} 
                placeholder="Ex: 6ème A"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Section / Option</Label>
              <Input 
                value={formData.section || ''} 
                onChange={(e) => setFormData({...formData, section: e.target.value})} 
                placeholder="Ex: Scientifique"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Année Scolaire</Label>
              <Input 
                value={formData.academicYear || ''} 
                onChange={(e) => setFormData({...formData, academicYear: e.target.value})} 
                placeholder="2025-2026"
              />
            </div>
            
            <div className="space-y-2">
              <Label>{cardRole === 'TEACHER' ? 'Téléphone *' : 'Téléphone Élève'}</Label>
              <Input 
                value={formData.phone || ''} 
                onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                placeholder={cardRole === 'TEACHER' ? 'Obligatoire' : 'Optionnel'}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Téléphone Parent 1</Label>
              <Input 
                value={formData.parentPhone || ''} 
                onChange={(e) => setFormData({...formData, parentPhone: e.target.value})} 
                placeholder="Optionnel"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Téléphone Parent 2</Label>
              <Input 
                value={formData.parentPhone2 || ''} 
                onChange={(e) => setFormData({...formData, parentPhone2: e.target.value})} 
                placeholder="Optionnel"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Email Parent</Label>
              <Input 
                type="email"
                value={formData.parentEmail || ''} 
                onChange={(e) => setFormData({...formData, parentEmail: e.target.value})} 
                placeholder="Optionnel"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Adresse</Label>
              <Input 
                value={formData.address || ''} 
                onChange={(e) => setFormData({...formData, address: e.target.value})} 
                placeholder="Adresse complète"
              />
            </div>
            
            {isCreating && (
              <div className="space-y-2">
                <Label>Mot de passe temporaire</Label>
                <div className="flex gap-2">
                  <Input 
                    value={formData.password || ''} 
                    onChange={(e) => setFormData({...formData, password: e.target.value})} 
                    type={showPassword ? "text" : "password"}
                    placeholder="Mot de passe"
                  />
                  <Button 
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
            
            <div className="space-y-2 col-span-1 md:col-span-2 lg:col-span-3">
              <Label>Photo de l'élève</Label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 flex items-center justify-center overflow-hidden shrink-0">
                  {formData.photoUrl ? (
                    <img src={formData.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex-1">
                  <Label htmlFor="photo-upload" className="cursor-pointer">
                    <div className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-3 hover:bg-muted/50 transition-colors">
                      <Upload className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Cliquez pour importer une photo (Max 2MB)</span>
                    </div>
                  </Label>
                  <Input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingStudent(null); setIsCreating(false); }}>
              Annuler
            </Button>
            <Button onClick={handleUpdate} disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
              {submitting ? 'Enregistrement...' : isCreating ? 'Créer la carte' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}