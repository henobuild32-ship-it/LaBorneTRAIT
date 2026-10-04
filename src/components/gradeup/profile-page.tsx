'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  User,
  Mail,
  Lock,
  School,
  Save,
  Eye,
  EyeOff,
  Shield,
  Building2,
  CheckCircle2,
  Loader2,
  LogOut,
  MessageCircle,
  Camera,
  IdCard,
  GraduationCap,
  ArrowRight,
} from 'lucide-react';
import IdCard3D from './IdCard3D';

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrateur',
  TEACHER: 'Professeur',
  STUDENT: 'Élève',
  PARENT: 'Parent',
};

export default function ProfilePage() {
  const { user, setUser, setCurrentPage, logout } = useAppStore();
  const { toast } = useToast();

  const [name, setName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [schoolName, setSchoolName] = useState(user?.school?.name || '');
  const [currency, setCurrency] = useState(user?.school?.currency || '');
  const [savingConfig, setSavingConfig] = useState(false);
  const [fullUser, setFullUser] = useState<any>(null);
  const [loadingCard, setLoadingCard] = useState(false);
  const [passages, setPassages] = useState<any[]>([]);

  useEffect(() => {
    if (user?.id && user.role === 'STUDENT' && user.schoolId) {
      const fetchPassages = async () => {
        try {
          const res = await fetch(`/api/passages?schoolId=${user.schoolId}&studentId=${user.id}`);
          const data = await res.json();
          setPassages(Array.isArray(data.passages) ? data.passages : []);
        } catch {
          setPassages([]);
        }
      };
      fetchPassages();
    }
  }, [user?.id, user?.role, user?.schoolId]);

  useEffect(() => {
    if (user) {
      setName(user.fullName);
      setEmail(user.email);
      if (user.school) {
        setSchoolName(user.school.name);
        setCurrency(user.school.currency);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user?.id && (user.role === 'STUDENT' || user.role === 'TEACHER')) {
      const fetchFullUser = async () => {
        try {
          setLoadingCard(true);
          const res = await fetch(`/api/users/${user.id}`);
          const data = await res.json();
          if (data.user) {
            setFullUser(data.user);
          }
        } catch {
          // silencieux
        } finally {
          setLoadingCard(false);
        }
      };
      fetchFullUser();
    }
  }, [user?.id, user?.role]);

  if (!user) return null;

  const initials = user.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Erreur', description: 'Image trop grande (max 2MB)', variant: 'destructive' });
      return;
    }
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await fetch('/api/upload/photo', { method: 'POST', body: fd });
      if (res.ok) {
        const { url } = await res.json();
        setUser({ ...user, photoUrl: url });
        toast({ title: 'Photo mise à jour' });
      } else {
        toast({ title: 'Erreur upload', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erreur réseau', variant: 'destructive' });
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast({ title: 'Déconnexion', description: 'Vous avez été déconnecté.' });
  };

  const handleSaveProfile = async () => {
    if (!name.trim() || !email.trim()) {
      toast({ title: 'Erreur', description: 'Veuillez remplir tous les champs obligatoires.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: name.trim(), email: email.trim(), photoUrl: user.photoUrl }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({ title: 'Erreur', description: err.error || 'Erreur lors de la mise à jour', variant: 'destructive' });
        return;
      }

      const updated = await res.json();
      if (updated.user) {
        setUser({ ...user, fullName: updated.user.fullName, email: updated.user.email });
      }
      toast({ title: 'Succès', description: 'Profil mis à jour avec succès !' });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de se connecter au serveur.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast({ title: 'Erreur', description: 'Veuillez remplir tous les champs du mot de passe.', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 4) {
      toast({ title: 'Erreur', description: 'Le nouveau mot de passe doit contenir au moins 4 caractères.', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Erreur', description: 'La confirmation du mot de passe ne correspond pas.', variant: 'destructive' });
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({ title: 'Erreur', description: err.error || 'Erreur lors du changement de mot de passe', variant: 'destructive' });
        return;
      }

      toast({ title: 'Succès', description: 'Mot de passe modifié avec succès !' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de se connecter au serveur.', variant: 'destructive' });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!schoolName.trim()) {
      toast({ title: 'Erreur', description: "Le nom de l'école est obligatoire.", variant: 'destructive' });
      return;
    }

    setSavingConfig(true);
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: user.schoolId, name: schoolName.trim(), currency: currency.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({ title: 'Erreur', description: err.error || 'Erreur lors de la mise à jour', variant: 'destructive' });
        return;
      }

      const updated = await res.json();
      if (updated.school) {
        setUser({
          ...user,
          school: { ...user.school!, name: updated.school.name, currency: updated.school.currency },
        });
      }
      toast({ title: 'Succès', description: "Configuration de l'école mise à jour !" });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de se connecter au serveur.', variant: 'destructive' });
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {/* User Info Card */}
      <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg">
        <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 ring-4 ring-white/30 shadow-lg relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                {user.photoUrl ? (
                  <img src={user.photoUrl} alt="" className="h-full w-full object-cover rounded-full" />
                ) : (
                  <AvatarFallback className="text-2xl bg-white/20 text-white font-bold">
                    {initials}
                  </AvatarFallback>
                )}
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {photoUploading ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold">{user.fullName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="bg-white/20 text-white hover:bg-white/30 border-0">
                    <Shield className="h-3 w-3 mr-1" />
                    {roleLabels[user.role]}
                  </Badge>
                </div>
                <p className="text-blue-100 text-sm mt-1 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {user.email}
                </p>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="text-white/80 hover:text-white hover:bg-white/10 border border-white/20"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </Card>

      {/* Ma Carte d'Identité 3D (Élèves & Enseignants uniquement) */}
      {(user.role === 'STUDENT' || user.role === 'TEACHER') && (
        <Card className="transition-all duration-300 hover:shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <IdCard className="h-4 w-4 text-blue-600" />
              </div>
              Ma Carte d&apos;Identité Numérique
            </CardTitle>
            <CardDescription>
              Visualisez, retournez en 3D ou téléchargez votre carte d&apos;identité officielle
            </CardDescription>
          </CardHeader>
          <CardContent className="py-6 flex justify-center items-center">
            {loadingCard ? (
              <div className="flex flex-col items-center gap-4 w-full max-w-[400px]">
                <Skeleton className="h-[250px] w-full rounded-2xl" />
                <Skeleton className="h-9 w-32 rounded-lg" />
              </div>
            ) : fullUser ? (
              <IdCard3D 
                user={{
                  ...fullUser,
                  className: fullUser.classEnrollments?.[0]?.class?.name || fullUser.className,
                  courseName: fullUser.section,
                }}
                school={{
                  name: fullUser.school?.name || 'Établissement LaBorneTRAIT',
                  logoUrl: fullUser.school?.logoUrl,
                  color: fullUser.school?.color || '#2563eb',
                  academicYear: fullUser.school?.academicYear,
                }}
                role={user.role as 'STUDENT' | 'TEACHER'}
              />
            ) : (
              <p className="text-sm text-muted-foreground italic text-center py-8">
                Impossible de charger votre carte d&apos;identité. Veuillez contacter l&apos;administration.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Parcours scolaire (élèves uniquement) */}
      {user.role === 'STUDENT' && (
        <Card className="transition-all duration-300 hover:shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                <GraduationCap className="h-4 w-4 text-emerald-600" />
              </div>
              Parcours scolaire
            </CardTitle>
            <CardDescription>
              Historique de vos passages entre les classes au fil des années
            </CardDescription>
          </CardHeader>
          <CardContent>
            {passages.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">
                <GraduationCap className="h-10 w-10 text-emerald-300 mx-auto mb-2" />
                Aucun passage enregistré pour l&apos;instant.
              </div>
            ) : (
              <div className="space-y-3">
                {passages.map((p) => (
                  <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-xl bg-accent/30 border border-border">
                    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm font-medium">{p.sourceClass?.name || p.sourceClassId}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{p.targetClass?.name || p.targetClassId}</span>
                      {p.result === 'REDOUBLE' ? (
                        <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Redouble</Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Réussi</Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground sm:shrink-0">
                      {p.sourceYear || '—'} → {p.targetYear || '—'} · {p.datePassage ? new Date(p.datePassage).toLocaleDateString('fr-FR') : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* School Info (all roles can see) */}
      {user.school && (
        <Card className="transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <School className="h-4 w-4 text-blue-600" />
              </div>
              Informations de l&apos;école
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">Nom de l&apos;école</p>
                <p className="font-semibold">{user.school.name}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">Email de l&apos;école</p>
                <p className="font-semibold">{user.school.email}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <School className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">Devise</p>
                <p className="font-semibold">{user.school.currency || 'USD'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Profile Form */}
      <Card className="transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30">
              <User className="h-4 w-4 text-blue-600" />
            </div>
            Modifier le profil
          </CardTitle>
          <CardDescription>Mettez à jour vos informations personnelles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Nom complet</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-9"
                  placeholder="Nom complet"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Adresse e-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  placeholder="email@exemple.com"
                />
              </div>
            </div>
          </div>
          <Button
            onClick={handleSaveProfile}
            disabled={saving}
            className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-md shadow-blue-500/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30">
              <Lock className="h-4 w-4 text-amber-600" />
            </div>
            Changer le mot de passe
          </CardTitle>
          <CardDescription>Modifiez votre mot de passe de connexion</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="old-password">Ancien mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="old-password"
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="pl-9 pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-password"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-9 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-9 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 h-4" />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  Les mots de passe ne correspondent pas
                </p>
              )}
              {confirmPassword && newPassword === confirmPassword && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Correspond
                </p>
              )}
            </div>
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={savingPassword}
            variant="outline"
            className="border-amber-200 text-amber-700 hover:bg-amber-50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]"
          >
            {savingPassword ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Lock className="h-4 w-4 mr-2" />
            )}
            {savingPassword ? 'Modification...' : 'Changer le mot de passe'}
          </Button>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card className="transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50">
              <MessageCircle className="h-4 w-4 text-emerald-600" />
            </div>
            Nous contacter
          </CardTitle>
          <CardDescription>Contactez directement notre équipe support</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="https://wa.me/243845072349"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 flex-1"
            >
              <div className="p-2.5 rounded-xl bg-emerald-100">
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-emerald-600" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-emerald-800 text-sm">WhatsApp</p>
                <p className="text-xs text-emerald-600">+243 845 072 349</p>
              </div>
            </a>
            </div>
        </CardContent>
      </Card>

      {/* Admin Only: School Config */}
      {user.role === 'ADMIN' && (
        <Card className="transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                <Building2 className="h-4 w-4 text-emerald-600" />
              </div>
              Configuration de l&apos;école
              <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 ml-2">Admin</Badge>
            </CardTitle>
            <CardDescription>Modifier les paramètres généraux de l&apos;école</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="school-name">Nom de l&apos;école</Label>
                <div className="relative">
                  <School className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="school-name"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="pl-9"
                    placeholder="Nom de l'école"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Devise</Label>
                <div className="relative">
                  <School className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="pl-9"
                    placeholder="USD, EUR, XOF..."
                  />
                </div>
              </div>
            </div>
            <Button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md shadow-emerald-500/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]"
            >
              {savingConfig ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {savingConfig ? 'Enregistrement...' : 'Enregistrer la configuration'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
