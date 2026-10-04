'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import PWAInstallDialog from './pwa-install-dialog';
import type { UserRole, PageView } from '@/lib/types';
import { useTheme } from 'next-themes';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Loader2,
  Eye,
  EyeOff,
  Shield,
  Sparkles,
  Users,
  BookOpen,
  ArrowLeft,
  School,
  GraduationCap,
  UserCheck,
  Key,
  Copy,
  Check,
  X,
  Smartphone,
  ChevronRight,
  Zap,
  Lock,
  Mail,
  User,
  Globe,
  Award,
  Calendar,
  BarChart3,
  Bot,
  Sun,
  Moon,
  CheckCircle2,
  Building2,
  FileSpreadsheet,
  Clock,
  Wallet,
  BellRing,
  ArrowRight,
  ShieldCheck,
  Laptop,
} from 'lucide-react';

const roleDashboardMap: Record<UserRole, PageView> = {
  ADMIN: 'admin-dashboard',
  TEACHER: 'teacher-dashboard',
  STUDENT: 'student-dashboard',
  PARENT: 'parent-dashboard',
};

const roleLabels: Record<string, string> = {
  STUDENT: 'Élève',
  TEACHER: 'Enseignant',
  PARENT: 'Parent',
  ADMIN: 'Direction / Admin',
};

const roleIcons: Record<string, React.ElementType> = {
  STUDENT: GraduationCap,
  TEACHER: UserCheck,
  PARENT: Users,
  ADMIN: Shield,
};

const roleColors: Record<string, { bg: string; border: string; badge: string; gradient: string }> = {
  STUDENT: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-emerald-200 dark:border-emerald-800/40',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300',
    gradient: 'from-emerald-500 to-teal-600',
  },
  TEACHER: {
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    border: 'border-blue-200 dark:border-blue-800/40',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300',
    gradient: 'from-blue-500 to-indigo-600',
  },
  PARENT: {
    bg: 'bg-purple-50 dark:bg-purple-950/20',
    border: 'border-purple-200 dark:border-purple-800/40',
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300',
    gradient: 'from-purple-500 to-pink-600',
  },
  ADMIN: {
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-800/40',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300',
    gradient: 'from-amber-500 to-orange-600',
  },
};

function PasswordStrengthIndicator({ password }: { password: string }) {
  if (!password) return null;

  const length = password.length;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  
  let score = 1;
  if (length >= 6) score++;
  if (length >= 8 && (hasUpper || hasNumber)) score++;

  const labels = ['Faible', 'Moyen', 'Sécurisé'];
  const colors = ['bg-rose-500', 'bg-amber-500', 'bg-emerald-500'];
  const textColors = ['text-rose-600 dark:text-rose-400', 'text-amber-600 dark:text-amber-400', 'text-emerald-600 dark:text-emerald-400'];

  return (
    <div className="space-y-1.5 mt-2 animate-fade-in">
      <div className="flex gap-1.5">
        {[1, 2, 3].map((level) => (
          <div
            key={level}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              level <= score ? colors[score - 1] : 'bg-muted/60'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-semibold ${textColors[score - 1]}`}>
        Niveau de mot de passe : {labels[score - 1]}
      </p>
    </div>
  );
}

export default function AuthPage() {
  const { setUser, setCurrentPage, user } = useAppStore();
  const { toast } = useToast();
  const { isInstallable, installPWA } = usePWAInstall();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user) {
      const dashboardPage = roleDashboardMap[user.role as UserRole] || 'admin-dashboard';
      setCurrentPage(dashboardPage);
    }
  }, [user, setCurrentPage]);

  // Main navigation view state
  const [view, setView] = useState<'welcome' | 'login' | 'register-school' | 'register-user' | 'forgot'>('welcome');

  // Login form state
  const [loginInviteCode, setLoginInviteCode] = useState('');
  const [loginFullName, setLoginFullName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginIsAdmin, setLoginIsAdmin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginIdentity, setLoginIdentity] = useState(''); // champ unifié email ou nom
  const [loginRole, setLoginRole] = useState<UserRole>('STUDENT');

  // Forgot password (OTP) state
  const [forgotStep, setForgotStep] = useState<'identify' | 'otp' | 'reset'>('identify');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotIdentity, setForgotIdentity] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirm, setForgotConfirm] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotIsAdmin, setForgotIsAdmin] = useState(false);
  const [forgotCode, setForgotCode] = useState('');
  const [forgotResendIn, setForgotResendIn] = useState(0);

  // Register school state
  const [regAdminName, setRegAdminName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regAdminGender, setRegAdminGender] = useState<'M' | 'F' | ''>('');
  const [regAdminBirthDate, setRegAdminBirthDate] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Register user state
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [joinFullName, setJoinFullName] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinConfirmPassword, setJoinConfirmPassword] = useState('');
  const [joinRole, setJoinRole] = useState<UserRole>('STUDENT');
  const [joinClassIds, setJoinClassIds] = useState<string[]>([]);
  const [joinParentCode, setJoinParentCode] = useState('');
  const [joinEmail, setJoinEmail] = useState('');
  const [joinGender, setJoinGender] = useState<'M' | 'F' | ''>('');
  const [joinBirthDate, setJoinBirthDate] = useState('');
  const [joinSpecialty, setJoinSpecialty] = useState('');
  const [joinPhone, setJoinPhone] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [showJoinPassword, setShowJoinPassword] = useState(false);
  const [showJoinConfirmPassword, setShowJoinConfirmPassword] = useState(false);

  // Verification state for invite code
  const [availableClasses, setAvailableClasses] = useState<{ id: string; name: string; level: string }[]>([]);
  const [codeVerified, setCodeVerified] = useState(false);
  const [verifiedSchoolName, setVerifiedSchoolName] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);

  // School creation success state
  const [createdInviteCode, setCreatedInviteCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  // Verify school code handler
  const verifyInviteCode = async (code: string) => {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 5) {
      setAvailableClasses([]);
      setCodeVerified(false);
      setVerifiedSchoolName('');
      return;
    }
    setVerifyingCode(true);
    try {
      const checkRes = await fetch(`/api/config?inviteCode=${cleanCode}`);
      if (checkRes.ok) {
        const data = await checkRes.json();
        if (data.school) {
          setCodeVerified(true);
          setVerifiedSchoolName(data.school.name || 'École trouvée');
          const classRes = await fetch(`/api/classes?schoolId=${data.school.id}`);
          if (classRes.ok) {
            const classData = await classRes.json();
            setAvailableClasses(Array.isArray(classData.classes) ? classData.classes : []);
          }
        } else {
          setCodeVerified(false);
          setVerifiedSchoolName('');
          setAvailableClasses([]);
        }
      } else {
        setCodeVerified(false);
        setVerifiedSchoolName('');
        setAvailableClasses([]);
      }
    } catch {
      setCodeVerified(false);
      setVerifiedSchoolName('');
      setAvailableClasses([]);
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginLoading) return;

    // Résoudre l'identité : email ou nom complet
    const identityValue = loginIdentity.trim();
    const resolvedEmail = (!loginIsAdmin && identityValue.includes('@')) ? identityValue : (loginIsAdmin ? loginEmail.trim() : '');
    const resolvedFullName = (!loginIsAdmin && !identityValue.includes('@')) ? identityValue : '';

    if (loginIsAdmin) {
      if (!loginEmail.trim() || !loginPassword) {
        toast({ title: 'Champs requis', description: 'Veuillez remplir votre email et votre mot de passe.', variant: 'destructive' });
        return;
      }
    } else {
      if (!loginInviteCode.trim() || !loginPassword || !identityValue) {
        toast({
          title: 'Champs requis',
          description: 'Veuillez renseigner le code école, votre email ou nom complet, et votre mot de passe.',
          variant: 'destructive',
        });
        return;
      }
    }
    setLoginLoading(true);
    try {
      const payload = loginIsAdmin
        ? {
            isAdminLogin: true,
            email: loginEmail.trim(),
            password: loginPassword,
          }
        : {
            isAdminLogin: false,
            inviteCode: loginInviteCode.toUpperCase().trim(),
            email: resolvedEmail || undefined,
            fullName: resolvedFullName || undefined,
            password: loginPassword,
          };

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Échec de connexion', description: data.error || 'Identifiants incorrects.', variant: 'destructive' });
        return;
      }
      setUser(data.user);
      const dashboardPage = roleDashboardMap[data.user.role as UserRole];
      setCurrentPage(dashboardPage);
      toast({ title: '✅ Connexion réussie !', description: `Bienvenue, ${data.user.fullName} !` });
    } catch (err) {
      const isNetworkError = err instanceof TypeError && err.message.includes('fetch');
      toast({
        title: 'Erreur réseau',
        description: isNetworkError
          ? 'Impossible de contacter le serveur. Vérifiez votre connexion internet.'
          : 'Une erreur inattendue est survenue.',
        variant: 'destructive',
      });
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Mot de passe oublié (OTP via SMTP) ────────────────────────────────────
  const forgotApiPayload = () => {
    const identity = forgotIdentity.trim();
    const isEmail = identity.includes('@');
    return {
      isAdminLogin: forgotIsAdmin,
      inviteCode: loginInviteCode.toUpperCase().trim(),
      email: forgotIsAdmin ? forgotEmail.trim() : isEmail ? identity : '',
      fullName: (!forgotIsAdmin && !isEmail) ? identity : '',
    };
  };

  const handleForgotRequest = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (forgotLoading) return;
    setForgotError('');
    setForgotMessage('');
    if (forgotIsAdmin ? !forgotEmail.trim() : !forgotIdentity.trim()) {
      setForgotError('Veuillez saisir votre identifiant.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(forgotApiPayload()),
      });
      const data = await res.json();
      // réponse générique anti-énumération
      setForgotMessage(data.message || data.error || 'Si un compte correspond, un code a été envoyé.');
      if (res.ok) {
        setForgotCode('');
        setForgotStep('otp');
        setForgotResendIn(60);
      } else {
        setForgotError(data.error || 'Une erreur est survenue.');
      }
    } catch {
      setForgotError('Erreur réseau lors de la demande.');
    } finally {
      setForgotLoading(false);
    }
  };

  useEffect(() => {
    if (forgotResendIn <= 0) return;
    const t = setTimeout(() => setForgotResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [forgotResendIn]);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotLoading) return;
    setForgotError('');
    if (!/^\d{6}$/.test(forgotCode.trim())) {
      setForgotError('Veuillez saisir le code OTP à 6 chiffres reçu par email.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...forgotApiPayload(), code: forgotCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setForgotError(data.error || 'Code invalide.');
        return;
      }
      setForgotStep('reset');
      setForgotMessage('');
    } catch {
      setForgotError('Erreur réseau lors de la vérification.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotLoading) return;
    setForgotError('');
    if (forgotNewPassword.length < 4) {
      setForgotError('Le nouveau mot de passe doit contenir au moins 4 caractères.');
      return;
    }
    if (forgotNewPassword !== forgotConfirm) {
      setForgotError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...forgotApiPayload(), code: forgotCode.trim(), newPassword: forgotNewPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setForgotError(data.error || 'Erreur lors de la réinitialisation.');
        return;
      }
      if (data.user) {
        setUser(data.user);
        const dashboardPage = roleDashboardMap[data.user.role as UserRole];
        setCurrentPage(dashboardPage);
      }
      toast({ title: '✅ Mot de passe réinitialisé !', description: 'Vous êtes maintenant connecté.' });
    } catch {
      setForgotError('Erreur réseau lors de la réinitialisation.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regLoading) return;
    if (!regAdminName.trim() || !regEmail.trim() || !regPassword || !regConfirmPassword) {
      toast({ title: 'Champs obligatoires', description: 'Veuillez remplir tous les champs du formulaire.', variant: 'destructive' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(regEmail.trim())) {
      toast({ title: 'Email invalide', description: 'Veuillez entrer une adresse email valide.', variant: 'destructive' });
      return;
    }
    if (regPassword !== regConfirmPassword) {
      toast({ title: 'Mots de passe non identiques', description: 'Les deux mots de passe doivent être identiques.', variant: 'destructive' });
      return;
    }
    if (regPassword.length < 4) {
      toast({ title: 'Mot de passe trop court', description: 'Le mot de passe doit comporter au moins 4 caractères.', variant: 'destructive' });
      return;
    }
    setRegLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'create-school',
          fullName: regAdminName.trim(),
          email: regEmail.trim(),
          password: regPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Erreur de configuration de La Borne", description: data.error || "Impossible de configurer l'espace de La Borne.", variant: 'destructive' });
        return;
      }
      setCreatedInviteCode(data.inviteCode);
      setUser(data.user);
      setCurrentPage('admin-dashboard');
      toast({
        title: 'La Borne est configurée !',
        description: `Code d'accès La Borne : ${data.inviteCode}`,
        duration: 8000,
      });
    } catch {
      toast({
        title: 'Erreur',
        description: "Une erreur réseau est survenue lors de la configuration de La Borne.",
        variant: 'destructive',
      });
    } finally {
      setRegLoading(false);
    }
  };

  const handleJoinSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (joinLoading) return;
    if (!joinInviteCode.trim() || !joinFullName.trim() || !joinPassword || !joinConfirmPassword || !joinRole) {
      toast({ title: 'Champs manquants', description: 'Veuillez renseigner tous les champs requis.', variant: 'destructive' });
      return;
    }
    if (!codeVerified) {
      toast({ title: 'Code école invalide', description: "Veuillez entrer un code d'invitation école valide.", variant: 'destructive' });
      return;
    }
    if (joinPassword !== joinConfirmPassword) {
      toast({ title: 'Erreur de mot de passe', description: 'Les mots de passe ne correspondent pas.', variant: 'destructive' });
      return;
    }
    if (joinPassword.length < 4) {
      toast({ title: 'Mot de passe trop court', description: 'Le mot de passe doit comporter au moins 4 caractères.', variant: 'destructive' });
      return;
    }
    if (joinRole === 'STUDENT' && joinClassIds.length === 0) {
      toast({ title: 'Classe obligatoire', description: 'Veuillez sélectionner au moins une classe.', variant: 'destructive' });
      return;
    }
    if (!joinGender) {
      toast({ title: 'Sexe obligatoire', description: 'Veuillez sélectionner votre sexe (M ou F).', variant: 'destructive' });
      return;
    }
    if ((joinRole === 'STUDENT' || joinRole === 'TEACHER') && !joinBirthDate.trim()) {
      toast({ title: 'Date de naissance requise', description: 'Veuillez renseigner votre date de naissance.', variant: 'destructive' });
      return;
    }
    if (joinRole === 'TEACHER') {
      if (!joinSpecialty.trim()) {
        toast({ title: 'Spécialité requise', description: 'Veuillez renseigner votre spécialité.', variant: 'destructive' });
        return;
      }
      if (!joinPhone.trim()) {
        toast({ title: 'Téléphone requis', description: 'Veuillez renseigner votre numéro de téléphone.', variant: 'destructive' });
        return;
      }
    }
    if (joinRole === 'PARENT' && !joinParentCode.trim()) {
      toast({ title: 'Code Parent requis', description: 'Le code parent de votre enfant est requis.', variant: 'destructive' });
      return;
    }
    setJoinLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'join-school',
          fullName: joinFullName.trim(),
          email: joinEmail.trim() || undefined,
          password: joinPassword,
          inviteCode: joinInviteCode.trim().toUpperCase(),
          role: joinRole,
          gender: joinGender,
          dateOfBirth: joinBirthDate || undefined,
          specialty: joinRole === 'TEACHER' ? joinSpecialty.trim() : undefined,
          phone: joinRole === 'TEACHER' ? joinPhone.trim() : undefined,
          classIds: (joinRole === 'STUDENT' || joinRole === 'TEACHER') ? joinClassIds : undefined,
          parentCode: joinRole === 'PARENT' ? joinParentCode.trim().toUpperCase() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Erreur d'inscription", description: data.error || 'Erreur lors de la création du compte.', variant: 'destructive' });
        return;
      }
      setUser(data.user);
      setCurrentPage(roleDashboardMap[joinRole]);
      toast({ title: `Bienvenue, ${data.user.fullName} !`, description: 'Votre inscription est validée.' });
    } catch {
      toast({
        title: 'Erreur réseau',
        description: 'Vérifiez votre connexion et réessayez.',
        variant: 'destructive',
      });
    } finally {
      setJoinLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    toast({ title: 'Code copié', description: 'Code d\'école copié dans le presse-papier.' });
    setTimeout(() => setCodeCopied(false), 2000);
  };

  // Toggle light/dark mode helper
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // Shared Footer for all auth views
  const renderFooter = () => (
    <footer className="p-6 text-center text-xs text-muted-foreground border-t border-border/40 bg-card/40 backdrop-blur-md">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <img src="/trait-logo.png" alt="LaBorneTRAIT" className="w-6 h-6 rounded-md object-contain" />
          <span className="font-bold text-foreground">LaBorneTRAIT</span>
        </div>
        <a href="https://wa.me/243990601417" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 text-xs font-semibold">
          WhatsApp : +243 990 601 417
        </a>
      </div>
      <div className="mt-3 text-[11px] text-muted-foreground/80">
        © {new Date().getFullYear()} LaBorneTRAIT. Tous droits réservés. Conçu et développé par{' '}
        <span className="font-semibold text-foreground/80">TRAIT Fintech</span>
      </div>
      <nav aria-label="Liens légaux" className="mt-3 flex justify-center gap-4 text-[11px] font-medium">
        <a href="/faq" className="hover:text-primary hover:underline">FAQ</a>
        <a href="/confidentialite" className="hover:text-primary hover:underline">Confidentialité</a>
      </nav>
    </footer>
  );

  // Shared Header for all views
  const renderHeader = () => (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50 px-4 sm:px-8 py-3.5 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('welcome')}>
        <div className="relative group">
          <img
            src="/trait-logo.png"
            alt="LaBorneTRAIT"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-contain shadow-md shadow-primary/20 group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-full flex items-center justify-center shadow-sm">
            <Sparkles className="w-2.5 h-2.5 text-white" />
          </div>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              LaBorneTRAIT
            </span>
            <Badge variant="outline" className="hidden sm:inline-flex text-[10px] py-0 px-1.5 border-primary/30 text-primary font-semibold">
              v3.6 ERP
            </Badge>
          </div>
          <span className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase">
            Gestion Scolaire Intelligente
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full w-9 h-9 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            title="Changer de thème (Sombre / Clair)"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </Button>
        )}

        <PWAInstallDialog placement="welcome" />

        {view !== 'welcome' ? (
          <Button
            onClick={() => setView('welcome')}
            variant="ghost"
            size="sm"
            className="rounded-full text-xs font-medium gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Accueil
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setView('login')}
              variant="ghost"
              size="sm"
              className="rounded-full text-xs font-semibold px-4 hover:bg-primary/10 text-primary"
            >
              Connexion
            </Button>
            <Button
              onClick={() => setView('register-user')}
              size="sm"
              className="rounded-full text-xs font-semibold px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all"
            >
              S'inscrire
            </Button>
          </div>
        )}
      </div>
    </header>
  );

  // ---------------------------------------------------------------------------
  // 1. ACCUEIL (WELCOME LANDING PAGE)
  // ---------------------------------------------------------------------------
  if (view === 'welcome') {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors overflow-x-hidden selection:bg-primary/20">
        {renderHeader()}

        <main className="flex-1 flex flex-col pb-20 lg:pb-0">
          {/* HERO SECTION */}
          <section className="relative px-4 sm:px-8 pt-12 pb-16 lg:pt-20 lg:pb-24 overflow-hidden border-b border-border/40">
            {/* Ambient Background Decorative Blobs */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-blue-500/15 via-indigo-500/10 to-purple-500/15 rounded-full blur-3xl pointer-events-none -z-10" />
            <div className="absolute top-10 right-[10%] w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

            <div className="max-w-6xl mx-auto text-center space-y-8">
              {/* Badge Pills */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wide animate-fade-in">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Application scolaire officielle de La Borne</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] max-w-4xl mx-auto">
                L'école La Borne,{' '}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  connectée et organisée
                </span>
              </h1>

              {/* Sub-headline */}
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto font-normal leading-relaxed">
                L'application de gestion scolaire de La Borne : élèves, enseignants, notes, présences, emplois du temps et finances réunis dans un seul espace.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
                <Button
                  onClick={() => setView('register-user')}
                  size="lg"
                  className="w-full sm:w-auto h-13 px-8 rounded-full text-base font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white shadow-xl shadow-blue-600/25 transition-all transform hover:-translate-y-0.5"
                >
                  Rejoindre La Borne
                  <ChevronRight className="w-5 h-5 ml-1.5" />
                </Button>
                <Button
                  onClick={() => setView('register-school')}
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto h-13 px-8 rounded-full text-base font-bold border-2 hover:bg-muted/60 transition-all"
                >
                  <School className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                  Configurer l'accès Direction
                </Button>
                <Button
                  onClick={() => setView('login')}
                  variant="ghost"
                  size="lg"
                  className="w-full sm:w-auto h-13 px-6 rounded-full text-base font-semibold text-muted-foreground hover:text-foreground"
                >
                  Se connecter
                </Button>
                <div className="w-full sm:w-auto">
                  <PWAInstallDialog placement="welcome" />
                </div>
              </div>

              {/* Trust & Spec pills */}
              <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Espace sécurisé de La Borne</span>
                </div>
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-blue-500" />
                  <span>Application iOS & Android (PWA)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-purple-500" />
                  <span>Accès Web Multi-supports</span>
                </div>
              </div>
            </div>
          </section>

          {/* ROLE SELECTOR CARDS */}
          <section className="px-4 sm:px-8 py-12 lg:py-16 bg-muted/30 border-b border-border/40">
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Un espace pour toute la communauté de La Borne</h2>
                <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                  Chaque acteur de la communauté scolaire dispose d'une interface optimisée selon ses besoins.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(['STUDENT', 'TEACHER', 'PARENT', 'ADMIN'] as UserRole[]).map((role) => {
                  const Icon = roleIcons[role];
                  const style = roleColors[role];
                  return (
                    <div
                      key={role}
                      onClick={() => {
                        setJoinRole(role);
                        setView('register-user');
                      }}
                      className={`group cursor-pointer p-5 rounded-2xl border ${style.border} ${style.bg} hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between space-y-4`}
                    >
                      <div className="flex items-center justify-between">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${style.gradient} flex items-center justify-center text-white shadow-md`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <Badge className={`${style.badge} font-bold text-[11px]`}>
                          {roleLabels[role]}
                        </Badge>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{roleLabels[role]}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {role === 'STUDENT' && 'Consulter les notes, cours, bulletins, absences et exercices.'}
                          {role === 'TEACHER' && 'Encoder les cotations, présences, leçons et emplois du temps.'}
                          {role === 'PARENT' && 'Suivre la scolarité de vos enfants et payer les frais scolaires.'}
                          {role === 'ADMIN' && 'Gérer les effectifs, finances, rapports et configurations.'}
                        </p>
                      </div>
                      <div className="flex items-center text-xs font-bold text-primary group-hover:translate-x-1 transition-transform">
                        <span>Créer un compte à La Borne</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ERP MODULES SHOWCASE GRID */}
          <section className="px-4 sm:px-8 py-16 max-w-6xl mx-auto w-full space-y-12">
            <div className="text-center space-y-3">
              <Badge variant="outline" className="px-3 py-1 text-xs font-semibold text-primary border-primary/30">
                Fonctionnalités Clés
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Une expérience académique complète
              </h2>
              <p className="text-base text-muted-foreground max-w-xl mx-auto">
                Des outils modernes conçus pour simplifier la vie scolaire au quotidien.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: Building2,
                  title: 'Gestion des Classes & Élèves',
                  desc: 'Inscriptions, listes de classe, dossiers d’élèves et fiches individuelles en temps réel.',
                  color: 'text-blue-500 bg-blue-500/10',
                },
                {
                  icon: BookOpen,
                  title: 'Cours & Leçons Numériques',
                  desc: 'Partage de ressources pédagogiques, supports de cours et devoirs interactifs.',
                  color: 'text-indigo-500 bg-indigo-500/10',
                },
                {
                  icon: FileSpreadsheet,
                  title: 'Cahier de Cotation & Bulletins',
                  desc: 'Calcul automatique des moyennes, génération de bulletins Ponderés et export PDF.',
                  color: 'text-emerald-500 bg-emerald-500/10',
                },
                {
                  icon: Clock,
                  title: 'Suivi des Présences & Absences',
                  desc: 'Pointage rapide des présences par cours avec notifications instantanées.',
                  color: 'text-amber-500 bg-amber-500/10',
                },
                {
                  icon: Calendar,
                  title: 'Emploi du Temps Intelligent',
                  desc: 'Planning des cours interactif synchronisé par classe, enseignant et salle.',
                  color: 'text-purple-500 bg-purple-500/10',
                },
                {
                  icon: Wallet,
                  title: 'Finances & Frais Scolaires',
                  desc: 'Suivi des paiements de minerval, émission de recus et états financiers.',
                  color: 'text-teal-500 bg-teal-500/10',
                },
                {
                  icon: BellRing,
                  title: 'Centre de Notifications',
                  desc: 'Annonces de La Borne, alertes urgentes et messagerie interne.',
                  color: 'text-rose-500 bg-rose-500/10',
                },
                {
                  icon: Bot,
                  title: 'IA Teno Intégrée',
                  desc: 'Assistant IA pédagogique pour générer des exercices, résumés et conseils d’apprentissage.',
                  color: 'text-sky-500 bg-sky-500/10',
                },
                {
                  icon: ShieldCheck,
                  title: 'Cartes Scolaires 3D & PWA',
                  desc: 'Génération de cartes d’identité scolaires et accès hors-ligne via application mobile.',
                  color: 'text-orange-500 bg-orange-500/10',
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-card border border-border/60 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300 flex flex-col space-y-3"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.color}`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* BOTTOM CTA */}
          <section className="px-4 sm:px-8 py-16 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white text-center">
            <div className="max-w-4xl mx-auto space-y-6">
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight">Toute la vie scolaire de La Borne, dans un seul espace.</h2>
              <p className="text-blue-100 text-base sm:text-lg max-w-xl mx-auto">
                LaBorneTRAIT accompagne les élèves, les enseignants, les parents et la direction de La Borne.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Button
                  onClick={() => setView('register-user')}
                  size="lg"
                  className="w-full sm:w-auto h-13 px-8 rounded-full font-bold bg-white text-blue-700 hover:bg-blue-50 shadow-lg"
                >
                  <UserCheck className="w-5 h-5 mr-2" />
                  Accéder à La Borne
                </Button>
                <Button
                  onClick={() => setView('login')}
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto h-13 px-8 rounded-full font-bold border-white/40 text-white hover:bg-white/10"
                >
                  Se connecter
                </Button>
              </div>
            </div>
          </section>
        </main>

        {renderFooter()}
        <div className="fixed inset-x-3 bottom-3 z-50 lg:hidden">
          <Button
            onClick={() => setView('register-user')}
            className="h-12 w-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-base font-bold text-white shadow-xl shadow-indigo-600/30"
          >
            Accéder à La Borne
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 2. CONNEXION (LOGIN SCREEN)
  // ---------------------------------------------------------------------------
  if (view === 'login') {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        {renderHeader()}

        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md space-y-8 bg-card p-6 sm:p-8 rounded-3xl border border-border/80 shadow-xl">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                <Lock className="w-7 h-7" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Connexion à LaBorneTRAIT</h1>
              <p className="text-sm text-muted-foreground">Accédez à votre espace personnel sécurisé</p>
            </div>

            {/* Toggle Mode User vs Admin */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted rounded-2xl">
              <button
                type="button"
                onClick={() => setLoginIsAdmin(false)}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                  !loginIsAdmin
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <User className="w-3.5 h-3.5 inline mr-1.5" />
                Élève / Prof / Parent
              </button>
              <button
                type="button"
                onClick={() => setLoginIsAdmin(true)}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                  loginIsAdmin
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Shield className="w-3.5 h-3.5 inline mr-1.5 text-amber-500" />
                Direction / Admin
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {!loginIsAdmin ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-code" className="text-xs font-bold flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-blue-500" />
                      Code École
                    </Label>
                    <Input
                      id="login-code"
                      placeholder="Ex: ECOLE-XXXXXX"
                      value={loginInviteCode}
                      onChange={(e) => setLoginInviteCode(e.target.value.toUpperCase())}
                      className="h-11 font-mono uppercase tracking-wider rounded-xl"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">Le code d'invitation fourni par votre établissement.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="login-identity" className="text-xs font-bold flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-500" />
                      {loginIdentity.includes('@') ? 'Email' : loginIdentity ? 'Nom Complet' : 'Email ou Nom Complet'}
                    </Label>
                    <Input
                      id="login-identity"
                      placeholder="Jean Dupont  ou  jean@exemple.com"
                      value={loginIdentity}
                      onChange={(e) => setLoginIdentity(e.target.value)}
                      autoComplete="username"
                      className="h-11 rounded-xl"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {loginIdentity.includes('@')
                        ? '✉️ Connexion par adresse email détectée'
                        : loginIdentity
                        ? '👤 Connexion par nom complet détectée'
                        : 'Entrez votre email ou votre nom complet (exactement comme enregistré).'}
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="admin-email" className="text-xs font-bold flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-amber-500" />
                    Email Administrateur
                  </Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@ecole.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="h-11 rounded-xl"
                    required
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-xs font-bold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-purple-500" />
                  Mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="h-11 rounded-xl pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loginLoading}
                className="w-full h-12 rounded-xl text-base font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20"
              >
                {loginLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connexion en cours...
                  </>
                ) : (
                  'Se connecter'
                )}
              </Button>
            </form>

            <div className="pt-2 text-center space-y-3">
              <p className="text-xs text-muted-foreground">
                Pas encore de compte ?{' '}
                <button
                  type="button"
                  onClick={() => setView('register-user')}
                  className="font-bold text-primary hover:underline"
                >
                  S'inscrire
                </button>
              </p>

              <p className="text-xs text-muted-foreground">
                Mot de passe oublié ?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setForgotIsAdmin(loginIsAdmin);
                    setForgotEmail(loginIsAdmin ? loginEmail : '');
                    setForgotIdentity(loginIsAdmin ? '' : loginIdentity);
                    setForgotStep('identify');
                    setForgotMessage('');
                    setForgotError('');
                    setView('forgot');
                  }}
                  className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Réinitialiser mon mot de passe
                </button>
              </p>
            </div>
          </div>
        </main>
        {renderFooter()}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 3. MOT DE PASSE OUBLIÉ (OTP VIA SMTP)
  // ---------------------------------------------------------------------------
  if (view === 'forgot') {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        {renderHeader()}

        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md space-y-6 bg-card p-6 sm:p-8 rounded-3xl border border-border/80 shadow-xl">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                <Lock className="w-7 h-7" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Mot de passe oublié</h1>
              <p className="text-sm text-muted-foreground">
                {forgotStep === 'identify' && 'Recevez un code de réinitialisation par email'}
                {forgotStep === 'otp' && 'Saisissez le code reçu par email'}
                {forgotStep === 'reset' && 'Choisissez votre nouveau mot de passe'}
              </p>
            </div>

            {/* Stepper */}
            <div className="flex items-center justify-center gap-2 text-[11px] font-bold">
              {['identify', 'otp', 'reset'].map((step, idx) => (
                <div key={step} className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all ${
                      ['identify', 'otp', 'reset'].indexOf(forgotStep) >= idx
                        ? 'bg-indigo-600 text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  {idx < 2 && <div className="w-6 h-0.5 bg-muted rounded-full" />}
                </div>
              ))}
            </div>

            {forgotMessage && !forgotError && forgotStep !== 'reset' && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                {forgotMessage}
              </div>
            )}
            {forgotError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-medium">
                {forgotError}
              </div>
            )}

            {forgotStep === 'identify' && (
              <form onSubmit={handleForgotRequest} className="space-y-4">
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setForgotIsAdmin(false)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                      !forgotIsAdmin ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <User className="w-3.5 h-3.5 inline mr-1.5" />
                    Élève / Prof / Parent
                  </button>
                  <button
                    type="button"
                    onClick={() => setForgotIsAdmin(true)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                      forgotIsAdmin ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 inline mr-1.5 text-amber-500" />
                    Direction / Admin
                  </button>
                </div>

                {forgotIsAdmin ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-amber-500" />
                      Email Administrateur
                    </Label>
                    <Input
                      type="email"
                      placeholder="admin@ecole.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="h-11 rounded-xl"
                      required
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-blue-500" />
                        Code École
                      </Label>
                      <Input
                        placeholder="Ex: ECOLE-XXXXXX"
                        value={loginInviteCode}
                        onChange={(e) => setLoginInviteCode(e.target.value.toUpperCase())}
                        className="h-11 font-mono uppercase tracking-wider rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-500" />
                        Email ou Nom Complet
                      </Label>
                      <Input
                        placeholder="Jean Dupont  ou  jean@exemple.com"
                        value={forgotIdentity}
                        onChange={(e) => setForgotIdentity(e.target.value)}
                        className="h-11 rounded-xl"
                        required
                      />
                    </div>
                  </>
                )}

                <Button type="submit" disabled={forgotLoading} className="w-full h-12 rounded-xl text-base font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
                  {forgotLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Envoi du code...
                    </>
                  ) : (
                    'Recevoir le code par email'
                  )}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  Si vous ne recevez rien, vérifiez vos spams / courriers indésirables.
                </p>
              </form>
            )}

            {forgotStep === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-500" />
                    Code à 6 chiffres
                  </Label>
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••••"
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, ''))}
                    className="h-12 rounded-xl text-center text-xl font-black tracking-[0.5em]"
                    autoFocus
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Le code OTP à 6 chiffres est valable 10 minutes. Vérifiez vos spams si nécessaire.
                  </p>
                </div>

                <Button type="submit" disabled={forgotLoading || forgotCode.length < 6} className="w-full h-12 rounded-xl text-base font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
                  {forgotLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Vérification...
                    </>
                  ) : (
                    'Vérifier le code'
                  )}
                </Button>

                <div className="text-center">
                  {forgotResendIn > 0 ? (
                    <span className="text-xs text-muted-foreground">Renvoi possible dans {forgotResendIn}s</span>
                  ) : (
                    <button type="button" onClick={() => { setForgotStep('identify'); setForgotMessage(''); setForgotError(''); }} className="text-xs font-bold text-indigo-600 hover:underline">
                      Retour et renvoyer le code
                    </button>
                  )}
                </div>
              </form>
            )}

            {forgotStep === 'reset' && (
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-purple-500" />
                    Nouveau mot de passe
                  </Label>
                  <Input
                    type="password"
                    placeholder="Au moins 4 caractères"
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    className="h-11 rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Confirmer le mot de passe</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={forgotConfirm}
                    onChange={(e) => setForgotConfirm(e.target.value)}
                    className="h-11 rounded-xl"
                    required
                  />
                </div>

                <Button type="submit" disabled={forgotLoading} className="w-full h-12 rounded-xl text-base font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg">
                  {forgotLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Réinitialisation...
                    </>
                  ) : (
                    'Réinitialiser mon mot de passe'
                  )}
                </Button>
              </form>
            )}

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => { setView('login'); setForgotError(''); setForgotMessage(''); }}
                className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Retour à la connexion
              </button>
            </div>
          </div>
        </main>
        {renderFooter()}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 4. INSCRIPTION (REGISTRATION SCREEN)
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {renderHeader()}

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg space-y-6 bg-card p-6 sm:p-8 rounded-3xl border border-border/80 shadow-xl">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <UserCheck className="w-7 h-7" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Inscription LaBorneTRAIT</h1>
            <p className="text-sm text-muted-foreground">Créez votre compte pour accéder à l'espace scolaire de La Borne</p>
          </div>

          {/* Dual Tabs for Registration */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted rounded-2xl">
            <button
              type="button"
              onClick={() => setView('register-user')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                view === 'register-user'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Rejoindre La Borne
            </button>
            <button
              type="button"
              onClick={() => setView('register-school')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                view === 'register-school'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <School className="w-3.5 h-3.5 inline mr-1 text-indigo-500" />
              Configurer La Borne
            </button>
          </div>

          {/* FORM A: CREATE SCHOOL */}
          {view === 'register-school' && (
            <>
              {createdInviteCode ? (
                <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-4 animate-scale-in">
                  <div className="w-12 h-12 rounded-full bg-emerald-500 text-white mx-auto flex items-center justify-center shadow-md">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                    L'espace scolaire de La Borne est prêt.
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Partagez ce code d'accès avec les enseignants, élèves et parents de La Borne :
                  </p>
                  <div className="p-4 rounded-xl bg-card border font-mono text-2xl font-black tracking-widest text-primary flex items-center justify-center gap-3">
                    <span>{createdInviteCode}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyCode(createdInviteCode)}
                      className="rounded-lg h-9 w-9"
                    >
                      {codeCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <Button
                    onClick={() => setCurrentPage('admin-dashboard')}
                    className="w-full rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Accéder au Tableau de Bord Direction
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleCreateSchool} className="space-y-4">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-center">
                    <p className="text-xs font-semibold text-muted-foreground">Établissement</p>
                    <p className="text-lg font-bold text-foreground">La Borne</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-name" className="text-xs font-bold">Nom complet du Directeur / Administrateur</Label>
                    <Input
                      id="admin-name"
                      placeholder="Ex: Prof. Marc Kabamba"
                      value={regAdminName}
                      onChange={(e) => setRegAdminName(e.target.value)}
                      className="h-11 rounded-xl"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reg-email" className="text-xs font-bold">Email du Directeur / Administrateur</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="direction@la-borne.example"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="h-11 rounded-xl"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-pass" className="text-xs font-bold">Mot de passe</Label>
                      <div className="relative">
                        <Input
                          id="reg-pass"
                          type={showRegPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          className="h-11 rounded-xl pr-9"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                        >
                          {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="reg-confirm" className="text-xs font-bold">Confirmer Mot de passe</Label>
                      <div className="relative">
                        <Input
                          id="reg-confirm"
                          type={showRegConfirmPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={regConfirmPassword}
                          onChange={(e) => setRegConfirmPassword(e.target.value)}
                          className="h-11 rounded-xl pr-9"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                        >
                          {showRegConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <PasswordStrengthIndicator password={regPassword} />

                  <Button
                    type="submit"
                    disabled={regLoading}
                    className="w-full h-12 rounded-xl text-base font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                  >
                    {regLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Configuration de La Borne...
                      </>
                    ) : (
                      "Configurer La Borne & Obtenir le Code"
                    )}
                  </Button>
                </form>
              )}
            </>
          )}

          {/* FORM B: JOIN SCHOOL */}
          {view === 'register-user' && (
            <form onSubmit={handleJoinSchool} className="space-y-4">
              {/* Invite code with live verification */}
              <div className="space-y-1.5">
                <Label htmlFor="join-code" className="text-xs font-bold flex items-center justify-between">
                  <span>Code d'accès La Borne</span>
                  {verifyingCode && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                </Label>
                <div className="relative">
                  <Input
                    id="join-code"
                    placeholder="Ex: ECOLE-XXXXXX"
                    value={joinInviteCode}
                    onChange={(e) => {
                      const code = e.target.value.toUpperCase();
                      setJoinInviteCode(code);
                      verifyInviteCode(code);
                    }}
                    className="h-11 font-mono uppercase tracking-wider rounded-xl pr-10"
                    required
                  />
                  {codeVerified && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>

                {codeVerified && (
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
                    <Check className="w-3.5 h-3.5" /> École vérifiée : {verifiedSchoolName}
                  </p>
                )}
              </div>

              {/* Role Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Votre Rôle dans l'École</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['STUDENT', 'TEACHER', 'PARENT'] as UserRole[]).map((r) => {
                    const RIcon = roleIcons[r];
                    const isSel = joinRole === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setJoinRole(r)}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                          isSel
                            ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                            : 'border-border/60 hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        <RIcon className="w-5 h-5" />
                        <span className="text-xs">{roleLabels[r]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Class selection for Student/Teacher */}
              {(joinRole === 'STUDENT' || joinRole === 'TEACHER') && (
                <div className="space-y-1.5">
                  <Label htmlFor="join-class" className="text-xs font-bold">
                    {joinRole === 'STUDENT' ? 'Votre Classe' : 'Classe(s) Enseignée(s)'}
                  </Label>
                  {availableClasses.length > 0 ? (
                    <select
                      id="join-class"
                      onChange={(e) => setJoinClassIds([e.target.value])}
                      className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm font-medium"
                      required
                    >
                      <option value="">-- Sélectionner une classe --</option>
                      {availableClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.level})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      placeholder="Identifiant de classe"
                      onChange={(e) => setJoinClassIds([e.target.value])}
                      className="h-11 rounded-xl text-xs"
                      required
                    />
                  )}
                </div>
              )}

              {/* Parent linkage code */}
              {joinRole === 'PARENT' && (
                <div className="space-y-1.5">
                  <Label htmlFor="join-parent-code" className="text-xs font-bold">
                    Code Éleve / Parent (Code de votre enfant)
                  </Label>
                  <Input
                    id="join-parent-code"
                    placeholder="Code fourni par l'élève"
                    value={joinParentCode}
                    onChange={(e) => setJoinParentCode(e.target.value.toUpperCase())}
                    className="h-11 rounded-xl uppercase font-mono"
                    required
                  />
                </div>
              )}

              {/* Gender M/F obligatoire */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">
                  Sexe <span className="text-destructive">*</span>
                </Label>
                <RadioGroup
                  value={joinGender}
                  onValueChange={(v) => setJoinGender(v as 'M' | 'F')}
                  className="grid grid-cols-2 gap-2"
                >
                  <Label
                    htmlFor="join-gender-m"
                    className={`flex items-center justify-center gap-2 h-11 rounded-xl border font-semibold text-sm cursor-pointer transition-all ${
                      joinGender === 'M'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/60 hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <RadioGroupItem value="M" id="join-gender-m" className="sr-only" />
                    <User className="w-4 h-4" /> Masculin
                  </Label>
                  <Label
                    htmlFor="join-gender-f"
                    className={`flex items-center justify-center gap-2 h-11 rounded-xl border font-semibold text-sm cursor-pointer transition-all ${
                      joinGender === 'F'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/60 hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <RadioGroupItem value="F" id="join-gender-f" className="sr-only" />
                    <User className="w-4 h-4" /> Féminin
                  </Label>
                </RadioGroup>
              </div>

              {/* Date de naissance pour STUDENT/TEACHER */}
              {(joinRole === 'STUDENT' || joinRole === 'TEACHER') && (
                <div className="space-y-1.5">
                  <Label htmlFor="join-birthdate" className="text-xs font-bold">
                    Date de Naissance <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="join-birthdate"
                    type="date"
                    value={joinBirthDate}
                    onChange={(e) => setJoinBirthDate(e.target.value)}
                    className="h-11 rounded-xl"
                    required
                  />
                </div>
              )}

              {/* Spécialité + Téléphone pour TEACHER */}
              {joinRole === 'TEACHER' && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="join-specialty" className="text-xs font-bold">
                      Spécialité <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="join-specialty"
                      placeholder="Ex: Mathématiques, Français"
                      value={joinSpecialty}
                      onChange={(e) => setJoinSpecialty(e.target.value)}
                      className="h-11 rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="join-phone" className="text-xs font-bold">
                      Téléphone <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="join-phone"
                      type="tel"
                      placeholder="+243 ..."
                      value={joinPhone}
                      onChange={(e) => setJoinPhone(e.target.value)}
                      className="h-11 rounded-xl"
                      required
                    />
                  </div>
                </>
              )}

              {/* Identity details */}
              <div className="space-y-1.5">
                <Label htmlFor="join-fullname" className="text-xs font-bold">Nom Complet</Label>
                <Input
                  id="join-fullname"
                  placeholder="Nom Prénom"
                  value={joinFullName}
                  onChange={(e) => setJoinFullName(e.target.value)}
                  className="h-11 rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="join-email" className="text-xs font-bold">Adresse Email (Optionnel)</Label>
                <Input
                  id="join-email"
                  type="email"
                  placeholder="nom@exemple.com"
                  value={joinEmail}
                  onChange={(e) => setJoinEmail(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>

              {/* Passwords */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="join-pass" className="text-xs font-bold">Mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="join-pass"
                      type={showJoinPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={joinPassword}
                      onChange={(e) => setJoinPassword(e.target.value)}
                      className="h-11 rounded-xl pr-9"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowJoinPassword(!showJoinPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showJoinPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="join-pass-confirm" className="text-xs font-bold">Confirmer</Label>
                  <div className="relative">
                    <Input
                      id="join-pass-confirm"
                      type={showJoinConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={joinConfirmPassword}
                      onChange={(e) => setJoinConfirmPassword(e.target.value)}
                      className="h-11 rounded-xl pr-9"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowJoinConfirmPassword(!showJoinConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showJoinConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={joinLoading}
                className="w-full h-12 rounded-xl text-base font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
              >
                {joinLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Inscription en cours...
                  </>
                ) : (
                  "Valider mon Inscription"
                )}
              </Button>
            </form>
          )}

          <div className="pt-2 text-center">
            <p className="text-xs text-muted-foreground">
              Déjà inscrit ?{' '}
              <button
                type="button"
                onClick={() => setView('login')}
                className="font-bold text-primary hover:underline"
              >
                Se connecter
              </button>
            </p>
          </div>
        </div>
      </main>
      {renderFooter()}
    </div>
  );
}
