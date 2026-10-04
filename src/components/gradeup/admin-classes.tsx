'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  Users,
  GraduationCap,
  Baby,
  School,
  FolderPlus,
} from 'lucide-react';
import { toast } from 'sonner';

interface ClassItem {
  id: string;
  name: string;
  level: string;
  cycle?: string;
  section?: string;
  option?: string;
  capacity?: number;
  fees: number;
  _count?: {
    enrollments: number;
    courses: number;
  };
}

const levelColors: Record<string, string> = {
  Maternelle: 'bg-pink-100 text-pink-700 border-pink-200',
  Primaire: 'bg-blue-100 text-blue-700 border-blue-200',
  Secondaire: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Humanités': 'bg-violet-100 text-violet-700 border-violet-200',
};

const levelBgColors: Record<string, string> = {
  Maternelle: 'bg-pink-50 border-pink-200 hover:border-pink-300',
  Primaire: 'bg-blue-50 border-blue-200 hover:border-blue-300',
  Secondaire: 'bg-emerald-50 border-emerald-200 hover:border-emerald-300',
  'Humanités': 'bg-violet-50 border-violet-200 hover:border-violet-300',
};

const levelIcons: Record<string, typeof GraduationCap> = {
  Maternelle: Baby,
  Primaire: GraduationCap,
  Secondaire: School,
  'Humanités': School,
};

const levelIconBg: Record<string, string> = {
  Maternelle: 'bg-pink-100 text-pink-600',
  Primaire: 'bg-blue-100 text-blue-600',
  Secondaire: 'bg-emerald-100 text-emerald-600',
  'Humanités': 'bg-violet-100 text-violet-600',
};

const SECONDARY_LEVELS = ['Secondaire', 'Humanités'];

const sectionSuggestions: Record<string, string[]> = {
  Secondaire: ['Scientifique', 'Littéraire', 'Pédagogie générale', 'Commerciale et gestion'],
  'Humanités': ['Scientifique', 'Littéraire', 'Pédagogie générale', 'Commerciale et gestion'],
};

const optionSuggestions: Record<string, string[]> = {
  Secondaire: ['Mathématiques', 'Sciences physiques', 'Biologie', 'Lettres modernes', 'Informatique'],
  'Humanités': ['Mathématiques', 'Sciences physiques', 'Biologie', 'Lettres modernes', 'Informatique', 'Comptabilité'],
};

export default function AdminClasses() {
  const { user } = useAppStore();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [deletingClass, setDeletingClass] = useState<ClassItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formName, setFormName] = useState('');
  const [formLevel, setFormLevel] = useState('Primaire');
  const [formSection, setFormSection] = useState('');
  const [formOption, setFormOption] = useState('');
  const [formFees, setFormFees] = useState('0');
  const [formCapacity, setFormCapacity] = useState('');

  const needsSectionOption = SECONDARY_LEVELS.includes(formLevel);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch(`/api/classes?schoolId=${user?.schoolId}`);
      const data = await res.json();
      setClasses(Array.isArray(data.classes) ? data.classes : []);
    } catch {
      toast.error('Erreur lors du chargement des classes');
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId]);

  useEffect(() => {
    if (user?.schoolId) {
      fetchClasses();
    }
  }, [fetchClasses, user?.schoolId]);

  const resetForm = () => {
    setFormName('');
    setFormLevel('Primaire');
    setFormSection('');
    setFormOption('');
    setFormFees('0');
    setFormCapacity('');
    setEditingClass(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (c: ClassItem) => {
    setEditingClass(c);
    setFormName(c.name);
    setFormLevel(c.level);
    setFormSection(c.section || '');
    setFormOption(c.option || '');
    setFormFees(String(c.fees));
    setFormCapacity(c.capacity ? String(c.capacity) : '');
    setDialogOpen(true);
  };

  const buildPayload = () => ({
    schoolId: user?.schoolId,
    name: formName.trim(),
    level: formLevel,
    cycle: formLevel,
    section: needsSectionOption ? formSection.trim() : '',
    option: needsSectionOption ? formOption.trim() : '',
    capacity: parseInt(formCapacity, 10) > 0 ? parseInt(formCapacity, 10) : 0,
    fees: parseFloat(formFees) || 0,
  });

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error('Le nom de la classe est requis');
      return;
    }

    setSubmitting(true);
    try {
      if (editingClass) {
        const res = await fetch(`/api/classes/${editingClass.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload()),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur');
        toast.success('Classe modifiée avec succès');
      } else {
        const res = await fetch('/api/classes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload()),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur');
        toast.success('Classe créée avec succès');
      }

      setDialogOpen(false);
      resetForm();
      fetchClasses();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'opération');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingClass) return;
    try {
      const res = await fetch(`/api/classes/${deletingClass.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast.success('Classe supprimée avec succès');
      setDeleteDialogOpen(false);
      setDeletingClass(null);
      fetchClasses();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la suppression');
    }
  };

  const getCapacityColor = (enrollments: number, capacity = 0) => {
    if (capacity > 0) {
      if (enrollments >= capacity) return 'text-red-500';
      if (enrollments >= capacity * 0.8) return 'text-amber-500';
      return 'text-emerald-500';
    }
    if (enrollments === 0) return 'text-gray-400';
    if (enrollments <= 15) return 'text-emerald-500';
    if (enrollments <= 25) return 'text-amber-500';
    return 'text-red-500';
  };

  const getCapacityLabel = (enrollments: number, capacity = 0) => {
    if (capacity > 0) {
      if (enrollments >= capacity) return 'Complet';
      if (enrollments >= capacity * 0.8) return 'Presque plein';
      return `${capacity - enrollments} place(s) libre(s)`;
    }
    if (enrollments === 0) return 'Vide';
    if (enrollments <= 15) return 'Places disponibles';
    if (enrollments <= 25) return 'Presque plein';
    return 'Complet';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Gestion des classes</h1>
            <p className="text-sm text-muted-foreground mt-1">Créez et gérez les classes de votre école</p>
          </div>
          <Button onClick={openCreateDialog} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-blue-500/20">
            <FolderPlus className="h-4 w-4 mr-2" />
            Créer une classe
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-20">
          <div className="mx-auto w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <BookOpen className="h-12 w-12 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Aucune classe</h3>
          <p className="text-muted-foreground mb-6">Commencez par créer votre première classe</p>
          <Button onClick={openCreateDialog} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-blue-500/20">
            <Plus className="h-4 w-4 mr-2" />
            Créer une classe
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((c) => {
            const LevelIcon = levelIcons[c.level] || BookOpen;
            const enrolled = c._count?.enrollments || 0;
            const capacity = c.capacity && c.capacity > 0 ? c.capacity : 0;
            const fillRatio = capacity > 0 ? enrolled / capacity : enrolled / 30;
            const fillPercent = Math.min(fillRatio * 100, 100);
            const fillClass =
              capacity > 0
                ? enrolled >= capacity
                  ? 'bg-red-500'
                  : enrolled >= capacity * 0.8
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                : enrolled <= 15
                  ? 'bg-emerald-500'
                  : enrolled <= 25
                    ? 'bg-amber-500'
                    : 'bg-red-500';
            return (
              <Card key={c.id} className={`relative group border-2 hover:shadow-lg transition-all ${levelBgColors[c.level] || 'bg-white border-muted hover:border-muted-foreground/30'}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${levelIconBg[c.level] || 'bg-gray-100 text-gray-600'}`}>
                        <LevelIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{c.name}</CardTitle>
                        <Badge
                          variant="outline"
                          className={`mt-1 text-xs ${levelColors[c.level] || ''}`}
                        >
                          {c.level}
                        </Badge>
                        {(c.section || c.option) && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {c.section && (
                              <Badge variant="secondary" className="text-[10px] bg-white/80 font-medium">
                                {c.section}
                              </Badge>
                            )}
                            {c.option && (
                              <Badge variant="secondary" className="text-[10px] bg-white/80 font-medium">
                                {c.option}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-white/80"
                        onClick={() => openEditDialog(c)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-red-100"
                        onClick={() => {
                          setDeletingClass(c);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        Élèves
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-white/80 text-foreground font-semibold">
                          {c._count?.enrollments || 0}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <GraduationCap className="h-4 w-4" />
                        Cours
                      </span>
                      <Badge variant="secondary" className="bg-white/80 text-foreground font-semibold">
                        {c._count?.courses || 0}
                      </Badge>
                    </div>
                    {/* Capacity indicator */}
                    <div className="pt-2 border-t border-border/50">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Capacité</span>
                        <span className={`text-xs font-medium ${getCapacityColor(enrolled, capacity)}`}>
                          {capacity > 0 ? `${enrolled}/${capacity}` : `${enrolled} élève(s)`}
                          <span className="ml-1.5 font-normal text-muted-foreground">
                            — {getCapacityLabel(enrolled, capacity)}
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${fillClass}`}
                          style={{ width: `${fillPercent}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-border/50">
                      <span className="text-muted-foreground">Frais scolaires</span>
                      <span className="font-bold text-emerald-600">{Number(c.fees).toLocaleString()} USD</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-t-lg -mx-6 -mt-6 mb-0" />
          <DialogHeader className="pt-2">
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-blue-600" />
              {editingClass ? 'Modifier la classe' : 'Créer une classe'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="class-name">Nom *</Label>
              <Input
                id="class-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: 6ème Année A"
                className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-level">Niveau</Label>
              <Select value={formLevel} onValueChange={setFormLevel}>
                <SelectTrigger id="class-level" className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Maternelle">🧒 Maternelle</SelectItem>
                  <SelectItem value="Primaire">📚 Primaire</SelectItem>
                  <SelectItem value="Secondaire">🎓 Secondaire</SelectItem>
                  <SelectItem value="Humanités">🏛️ Humanités</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {needsSectionOption && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="class-section">Section</Label>
                  <Input
                    id="class-section"
                    list="section-suggestions"
                    value={formSection}
                    onChange={(e) => setFormSection(e.target.value)}
                    placeholder="Ex: Scientifique"
                    className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  <datalist id="section-suggestions">
                    {(sectionSuggestions[formLevel] || []).map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="class-option">Option</Label>
                  <Input
                    id="class-option"
                    list="option-suggestions"
                    value={formOption}
                    onChange={(e) => setFormOption(e.target.value)}
                    placeholder="Ex: Mathématiques"
                    className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  <datalist id="option-suggestions">
                    {(optionSuggestions[formLevel] || []).map((o) => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="class-fees">Frais scolaires (USD)</Label>
                <Input
                  id="class-fees"
                  type="number"
                  min="0"
                  value={formFees}
                  onChange={(e) => setFormFees(e.target.value)}
                  placeholder="0"
                  className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-capacity">Capacité maximale</Label>
                <Input
                  id="class-capacity"
                  type="number"
                  min="0"
                  value={formCapacity}
                  onChange={(e) => setFormCapacity(e.target.value)}
                  placeholder="Illimité"
                  className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                <p className="text-xs text-muted-foreground">Nombre max d&apos;élèves (vide = illimité)</p>
              </div>
            </div>
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
              {submitting ? 'Enregistrement...' : editingClass ? 'Modifier' : 'Créer'}
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
              Êtes-vous sûr de vouloir supprimer la classe <span className="font-semibold">&quot;{deletingClass?.name}&quot;</span> ?
              Toutes les inscriptions associées seront également supprimées. Cette action est irréversible.
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
