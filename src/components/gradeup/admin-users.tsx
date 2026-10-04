'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  GraduationCap,
  UserCheck,
  Shield,
  UserCog,
  UsersRound,
  UserPlus,
  Power,
  PowerOff,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';

interface UserItem {
  id: string;
  fullName: string;
  email: string;
  role: string;
  active?: boolean;
  gender?: string;
  birthDate?: string;
  specialty?: string;
  phone?: string;
  classEnrollments?: Array<{ class: { id: string; name: string } }>;
  isTitulaire?: boolean;
  titulaireClassIds?: string[];
}

interface ClassItem {
  id: string;
  name: string;
}

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrateur',
  TEACHER: 'Professeur',
  STUDENT: 'Élève',
  PARENT: 'Parent',
};

const roleColors: Record<string, string> = {
  ADMIN: 'bg-blue-100 text-blue-700 border-blue-200',
  TEACHER: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  STUDENT: 'bg-purple-100 text-purple-700 border-purple-200',
  PARENT: 'bg-orange-100 text-orange-700 border-orange-200',
};

const roleAvatarColors: Record<string, string> = {
  ADMIN: 'bg-blue-500',
  TEACHER: 'bg-emerald-500',
  STUDENT: 'bg-purple-500',
  PARENT: 'bg-orange-500',
};

const roleIcons: Record<string, typeof Users> = {
  ADMIN: Shield,
  TEACHER: GraduationCap,
  STUDENT: UserCheck,
  PARENT: UsersRound,
};

export default function AdminUsers() {
  const { user } = useAppStore();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [allUsers, setAllUsers] = useState<UserItem[]>([]); // For counting across roles
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [parents, setParents] = useState<{ id: string; fullName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('STUDENT');
  const [formGender, setFormGender] = useState<'M' | 'F' | ''>('');
  const [formBirthDate, setFormBirthDate] = useState('');
  const [formSpecialty, setFormSpecialty] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formClassName, setFormClassName] = useState('');
  const [formParentId, setFormParentId] = useState('');
  const [formIsTitulaire, setFormIsTitulaire] = useState(false);
  const [formTitulaireClassIds, setFormTitulaireClassIds] = useState<string[]>([]);

  const fetchUsers = useCallback(async () => {
    try {
      let url = `/api/users?schoolId=${user?.schoolId}`;
      if (activeTab !== 'ALL') url += `&role=${activeTab}`;
      const res = await fetch(url);
      const data = await res.json();
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch {
      toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId, activeTab]);

  // Load all users (without role filter) for accurate tab counters
  const fetchAllUsers = useCallback(async () => {
    try {
      const res = await fetch(`/api/users?schoolId=${user?.schoolId}`);
      const data = await res.json();
      setAllUsers(Array.isArray(data.users) ? data.users : []);
    } catch {
      // silent
    }
  }, [user?.schoolId]);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch(`/api/classes?schoolId=${user?.schoolId}`);
      if (!res.ok) return;
      const data = await res.json();
      setClasses(Array.isArray(data.classes) ? data.classes : []);
    } catch {
      // silencieux
    }
  }, [user?.schoolId]);

  const fetchParents = useCallback(async () => {
    try {
      const res = await fetch(`/api/users?schoolId=${user?.schoolId}&role=PARENT`);
      if (!res.ok) return;
      const data = await res.json();
      setParents(Array.isArray(data.users) ? data.users : []);
    } catch {
      // silencieux
    }
  }, [user?.schoolId]);

  useEffect(() => {
    if (user?.schoolId) {
      setLoading(true);
      fetchUsers();
      fetchAllUsers();
      fetchClasses();
      fetchParents();
    }
  }, [fetchUsers, fetchAllUsers, fetchClasses, fetchParents, user?.schoolId]);

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('STUDENT');
    setFormGender('');
    setFormBirthDate('');
    setFormSpecialty('');
    setFormPhone('');
    setFormClassName('');
    setFormParentId('');
    setFormIsTitulaire(false);
    setFormTitulaireClassIds([]);
    setEditingUser(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (u: UserItem) => {
    setEditingUser(u);
    setFormName(u.fullName);
    setFormEmail(u.email);
    setFormPassword('');
    setFormRole(u.role);
    setFormGender((u.gender === 'M' || u.gender === 'F') ? u.gender : '');
    setFormBirthDate(u.birthDate || '');
    setFormSpecialty(u.specialty || '');
    setFormPhone(u.phone || '');
    setFormClassName(u.classEnrollments?.[0]?.class?.name || '');
    setFormParentId('');
    setFormIsTitulaire(u.isTitulaire || false);
    setFormTitulaireClassIds(u.titulaireClassIds || []);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error('Le nom complet est requis');
      return;
    }
    if (!editingUser && !formPassword.trim()) {
      toast.error('Le mot de passe est requis');
      return;
    }
    if (!formGender) {
      toast.error('Le sexe (M ou F) est obligatoire');
      return;
    }
    if ((formRole === 'STUDENT' || formRole === 'TEACHER') && !formBirthDate.trim()) {
      toast.error('La date de naissance est obligatoire pour ce rôle');
      return;
    }
    if (formRole === 'TEACHER') {
      if (!formSpecialty.trim()) {
        toast.error('La spécialité est obligatoire pour un professeur');
        return;
      }
      if (!formPhone.trim()) {
        toast.error('Le numéro de téléphone est obligatoire pour un professeur');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (editingUser) {
        const body: Record<string, unknown> = {
          schoolId: user?.schoolId,
          fullName: formName,
          email: formEmail,
          role: formRole,
          gender: formGender,
          birthDate: formBirthDate,
          specialty: formSpecialty,
          phone: formPhone,
          isTitulaire: formIsTitulaire,
          titulaireClassIds: formIsTitulaire ? formTitulaireClassIds : [],
        };
        if (formPassword) body.password = formPassword;

        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur');
        toast.success('Utilisateur modifié avec succès');
      } else {
        const body: Record<string, unknown> = {
          schoolId: user?.schoolId,
          fullName: formName,
          email: formEmail,
          password: formPassword,
          role: formRole,
          gender: formGender,
          birthDate: formBirthDate,
          specialty: formSpecialty,
          phone: formPhone,
          isTitulaire: formIsTitulaire,
          titulaireClassIds: formIsTitulaire ? formTitulaireClassIds : [],
        };
        if (formRole === 'STUDENT' && formClassName) body.className = formClassName;
        if (formRole === 'STUDENT' && formParentId) body.parentId = formParentId;

        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur');
        toast.success('Utilisateur créé avec succès');
      }

      setDialogOpen(false);
      resetForm();
      fetchUsers();
      fetchAllUsers();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'opération');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    try {
      const res = await fetch(`/api/users/${deletingUser.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast.success('Utilisateur supprimé avec succès');
      setDeleteDialogOpen(false);
      setDeletingUser(null);
      fetchUsers();
      fetchAllUsers();

    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la suppression');
    }
  };

  const toggleActive = async (u: UserItem) => {
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: u.id, active: !u.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast.success(u.active ? 'Compte désactivé' : 'Compte activé');
      fetchUsers();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'opération');
    }
  };

  const filteredUsers = users.filter((u) =>
    u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Use allUsers (full list) to compute accurate counts regardless of active tab
  const getCountByRole = (role: string) => {
    if (role === 'ALL') return allUsers.length;
    return allUsers.filter(u => u.role === role).length;
  };

  const exportCSV = () => {
    if (filteredUsers.length === 0) {
      toast.error('Aucun utilisateur à exporter');
      return;
    }
    const headers = ['Nom', 'Email', 'Rôle', 'Actif', 'Classe(s)'];
    const rows = filteredUsers.map((u) => [
      u.fullName,
      u.email,
      u.role,
      u.active === false ? 'Non' : 'Oui',
      u.classEnrollments?.map((e) => e.class.name).join(' / ') || '',
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `utilisateurs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Utilisateurs exportés en CSV');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Gestion des utilisateurs</h1>
              <p className="text-sm text-muted-foreground mt-1">Gérez les élèves, professeurs et parents</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={exportCSV} variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-all">
                <Download className="h-4 w-4 mr-2" />
                Exporter CSV
              </Button>
              <Button onClick={openCreateDialog} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-blue-500/20">
                <UserPlus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ALL" className="gap-1.5">
            <Users className="h-4 w-4" />
            Tous
            <Badge variant="secondary" className="ml-1 text-xs bg-blue-100 text-blue-700 h-5 min-w-[20px] px-1.5">{getCountByRole('ALL')}</Badge>
          </TabsTrigger>
          <TabsTrigger value="STUDENT" className="gap-1.5">
            <UserCheck className="h-4 w-4" />
            Élèves
            <Badge variant="secondary" className="ml-1 text-xs bg-purple-100 text-purple-700 h-5 min-w-[20px] px-1.5">{getCountByRole('STUDENT')}</Badge>
          </TabsTrigger>
          <TabsTrigger value="TEACHER" className="gap-1.5">
            <GraduationCap className="h-4 w-4" />
            Professeurs
            <Badge variant="secondary" className="ml-1 text-xs bg-emerald-100 text-emerald-700 h-5 min-w-[20px] px-1.5">{getCountByRole('TEACHER')}</Badge>
          </TabsTrigger>
          <TabsTrigger value="PARENT" className="gap-1.5">
            <UsersRound className="h-4 w-4" />
            Parents
            <Badge variant="secondary" className="ml-1 text-xs bg-orange-100 text-orange-700 h-5 min-w-[20px] px-1.5">{getCountByRole('PARENT')}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un utilisateur..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Users className="h-10 w-10 text-muted-foreground/60" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Aucun utilisateur trouvé</h3>
              <p className="text-muted-foreground mb-4">Essayez de modifier votre recherche ou ajoutez un nouvel utilisateur</p>
              <Button onClick={openCreateDialog} variant="outline" className="hover:scale-[1.02] active:scale-[0.98] transition-all">
                <UserPlus className="h-4 w-4 mr-2" />
                Ajouter un utilisateur
              </Button>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&>tr:nth-child(even)]:bg-muted/30">
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full ${roleAvatarColors[u.role] || 'bg-gray-500'} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                            {getInitials(u.fullName)}
                          </div>
                          <span className="font-medium">{u.fullName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={roleColors[u.role] || ''}>
                          {roleLabels[u.role] || u.role}
                          {u.role === 'TEACHER' && u.isTitulaire && ' (Titulaire)'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.classEnrollments && u.classEnrollments.length > 0
                          ? u.classEnrollments.map((e) => e.class.name).join(', ')
                          : u.isTitulaire && u.titulaireClassIds && u.titulaireClassIds.length > 0
                          ? `Titulaire: ${u.titulaireClassIds.map(cid => classes.find(c => c.id === cid)?.name).filter(Boolean).join(', ')}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => toggleActive(u)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                            u.active !== false
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          {u.active !== false ? (
                            <><Power className="w-3 h-3" /> Actif</>
                          ) : (
                            <><PowerOff className="w-3 h-3" /> Inactif</>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            onClick={() => openEditDialog(u)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-red-50 hover:text-red-600 transition-colors"
                            onClick={() => {
                              setDeletingUser(u);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-t-lg -mx-6 -mt-6 mb-0" />
          <DialogHeader className="pt-2">
            <DialogTitle className="flex items-center gap-2">
              {editingUser ? <UserCog className="h-5 w-5 text-blue-600" /> : <UserPlus className="h-5 w-5 text-blue-600" />}
              {editingUser ? 'Modifier l\'utilisateur' : 'Ajouter un utilisateur'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="form-name">Nom complet *</Label>
              <Input
                id="form-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Jean Dupont"
                className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-email">Email</Label>
              <Input
                id="form-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="jean@exemple.com"
                className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-password">
                Mot de passe {editingUser ? '(laisser vide pour ne pas modifier)' : '*'}
              </Label>
              <Input
                id="form-password"
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="••••••••"
                className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-role">Rôle *</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger id="form-role" className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENT">Élève</SelectItem>
                  <SelectItem value="TEACHER">Professeur</SelectItem>
                  <SelectItem value="PARENT">Parent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sexe *</Label>
              <RadioGroup
                value={formGender}
                onValueChange={(v) => setFormGender(v as 'M' | 'F')}
                className="grid grid-cols-2 gap-2"
              >
                <Label
                  htmlFor="au-form-gender-m"
                  className={`flex items-center justify-center gap-2 h-10 rounded-lg border font-semibold text-sm cursor-pointer transition-all ${
                    formGender === 'M' ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40' : 'border-border/60 hover:bg-muted'
                  }`}
                >
                  <RadioGroupItem value="M" id="au-form-gender-m" className="sr-only" />
                  Masculin
                </Label>
                <Label
                  htmlFor="au-form-gender-f"
                  className={`flex items-center justify-center gap-2 h-10 rounded-lg border font-semibold text-sm cursor-pointer transition-all ${
                    formGender === 'F' ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40' : 'border-border/60 hover:bg-muted'
                  }`}
                >
                  <RadioGroupItem value="F" id="au-form-gender-f" className="sr-only" />
                  Féminin
                </Label>
              </RadioGroup>
            </div>
            {(formRole === 'STUDENT' || formRole === 'TEACHER') && (
              <div className="space-y-2">
                <Label htmlFor="form-birthdate">Date de naissance *</Label>
                <Input
                  id="form-birthdate"
                  type="date"
                  value={formBirthDate}
                  onChange={(e) => setFormBirthDate(e.target.value)}
                  className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            )}
            {formRole === 'TEACHER' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="form-specialty">Spécialité *</Label>
                  <Input
                    id="form-specialty"
                    value={formSpecialty}
                    onChange={(e) => setFormSpecialty(e.target.value)}
                    placeholder="Ex: Mathématiques"
                    className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="form-phone">Téléphone *</Label>
                  <Input
                    id="form-phone"
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+243 ..."
                    className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </>
            )}
            {formRole === 'TEACHER' && (
              <div className="space-y-3 p-3 border rounded-lg bg-slate-50/50 dark:bg-slate-900/20">
                <div className="flex items-center gap-2">
                  <input
                    id="form-is-titulaire"
                    type="checkbox"
                    checked={formIsTitulaire}
                    onChange={(e) => setFormIsTitulaire(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <Label htmlFor="form-is-titulaire" className="font-semibold cursor-pointer">Professeur titulaire</Label>
                </div>
                {formIsTitulaire && (
                  <div className="space-y-2 mt-2 pt-2 border-t border-dashed">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Classes dont il est titulaire ({formTitulaireClassIds.length})
                    </Label>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 bg-white dark:bg-black/20 rounded border">
                      {classes.length === 0 ? (
                        <p className="text-xs text-muted-foreground col-span-2 p-2 text-center">Aucune classe disponible</p>
                      ) : (
                        classes.map((c) => {
                          const isChecked = formTitulaireClassIds.includes(c.id);
                          return (
                            <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer p-1 hover:bg-muted/50 rounded transition-colors">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setFormTitulaireClassIds(formTitulaireClassIds.filter(id => id !== c.id));
                                  } else {
                                    setFormTitulaireClassIds([...formTitulaireClassIds, c.id]);
                                  }
                                }}
                                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="truncate">{c.name}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {formRole === 'STUDENT' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="form-class">Classe *</Label>
                  <div className="relative">
                    <Input
                      id="form-class"
                      list="class-list"
                      placeholder="Sélectionnez ou tapez le nom de la classe"
                      value={formClassName}
                      onChange={(e) => setFormClassName(e.target.value)}
                      className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                    <datalist id="class-list">
                      {classes.map((c) => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Si la classe n&apos;existe pas, elle sera créée automatiquement.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="form-parent">Parent (optionnel)</Label>
                  <Select value={formParentId} onValueChange={setFormParentId}>
                    <SelectTrigger id="form-parent" className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                      <SelectValue placeholder="Sélectionner un parent" />
                    </SelectTrigger>
                    <SelectContent>
                      {parents.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} className="hover:scale-[1.02] active:scale-[0.98] transition-all">
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              {submitting ? 'Enregistrement...' : editingUser ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <div className="bg-gradient-to-r from-red-500 to-rose-500 h-2 rounded-t-lg -mx-6 -mt-6 mb-0" />
          <AlertDialogHeader className="pt-2">
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Confirmer la suppression
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer <span className="font-semibold">{deletingUser?.fullName}</span> ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="hover:scale-[1.02] active:scale-[0.98] transition-all">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 hover:scale-[1.02] active:scale-[0.98] transition-all">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
