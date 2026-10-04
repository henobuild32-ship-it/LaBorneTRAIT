'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  DollarSign,
  Search,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  Filter,
  RefreshCw,
  UserCheck,
  UserX,
  FileText,
} from 'lucide-react';

interface StudentTuition {
  id: string;
  fullName: string;
  matricule: string;
  active: boolean;
  classId: string | null;
  className: string;
  classFees: number;
  paymentStatus: 'paid' | 'unpaid';
  lastPaymentDate: string | null;
  lastPaymentAmount: number;
  lastPaymentMethod: string | null;
  lastPaymentMonth: string | null;
}

interface ClassOption {
  id: string;
  name: string;
}

export default function TuitionTracking() {
  const user = useAppStore((s) => s.user);
  const schoolId = user?.schoolId;
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentTuition[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [paymentDialog, setPaymentDialog] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMonth, setPaymentMonth] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const fetchData = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ schoolId });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (classFilter !== 'all') params.set('classId', classFilter);
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/tuition?${params}`);
      const data = await res.json();
      setStudents(data.students || []);
      setClasses(data.classes || []);
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de charger les données', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [schoolId, statusFilter, classFilter, searchQuery, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (studentId: string, action: string, extra?: Record<string, unknown>) => {
    setActionLoading(studentId);
    try {
      const res = await fetch('/api/tuition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, action, adminId: user?.id, ...extra }),
      });
      if (!res.ok) throw new Error();
      toast({
        title: 'Succès',
        description:
          action === 'block'
            ? 'Accès bloqué'
            : action === 'restore'
              ? 'Accès rétabli'
              : 'Paiement enregistré',
      });
      setPaymentDialog(null);
      fetchData();
    } catch {
      toast({ title: 'Erreur', description: 'Action échouée', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const paidCount = students.filter((s) => s.paymentStatus === 'paid').length;
  const unpaidCount = students.filter((s) => s.paymentStatus === 'unpaid').length;
  const blockedCount = students.filter((s) => !s.active).length;
  const totalFees = students.reduce((sum, s) => sum + s.classFees, 0);
  const collectedFees = students
    .filter((s) => s.paymentStatus === 'paid')
    .reduce((sum, s) => sum + s.lastPaymentAmount, 0);

  const filteredStudents = students.filter((s) => {
    if (searchQuery && !s.fullName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suivi des frais scolaires</h1>
          <p className="text-muted-foreground">
            Gérez les paiements et les accès des élèves à la plateforme
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total élèves</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{students.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ayant payé</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{paidCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">N'ayant pas payé</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{unpaidCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bloqués</CardTitle>
            <Lock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{blockedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <CardTitle className="text-lg">Élèves</CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un élève..."
                  className="pl-8 w-48"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="paid">Payé</SelectItem>
                  <SelectItem value="unpaid">Non payé</SelectItem>
                </SelectContent>
              </Select>
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Classe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les classes</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun élève trouvé
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filteredStudents.map((student) => (
                  <Card key={student.id} className="border-l-4 border-l-transparent hover:border-l-primary transition-colors">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{student.fullName}</span>
                            {!student.active && (
                              <Badge variant="destructive" className="text-xs">
                                <Lock className="w-3 h-3 mr-1" />
                                Bloqué
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span>{student.className}</span>
                            {student.matricule && <span>• {student.matricule}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {student.paymentStatus === 'paid' ? (
                            <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-200">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Payé
                              {student.lastPaymentAmount > 0 && (
                                <span className="ml-1">({student.lastPaymentAmount} FCFA)</span>
                              )}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-200">
                              <XCircle className="w-3 h-3 mr-1" />
                              Non payé
                            </Badge>
                          )}
                          <div className="flex gap-1">
                            {student.active ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                onClick={() => handleAction(student.id, 'block')}
                                disabled={actionLoading === student.id}
                              >
                                <Lock className="w-4 h-4 mr-1" />
                                Bloquer
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleAction(student.id, 'restore')}
                                disabled={actionLoading === student.id}
                              >
                                <Unlock className="w-4 h-4 mr-1" />
                                Rétablir
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPaymentDialog(student.id);
                                setPaymentAmount('');
                                setPaymentMonth('');
                              }}
                            >
                              <DollarSign className="w-4 h-4 mr-1" />
                              Marquer payé
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={paymentDialog !== null} onOpenChange={(open) => { if (!open) setPaymentDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marquer payé</DialogTitle>
            <DialogDescription>
              Enregistrer un paiement pour cet élève
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Montant (USD)</Label>
              <Input
                id="amount"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Ex: 50000"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="month">Mois concerné</Label>
              <Select value={paymentMonth} onValueChange={setPaymentMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un mois" />
                </SelectTrigger>
                <SelectContent>
                  {['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'].map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="method">Méthode de paiement</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="mobile">Mobile Money</SelectItem>
                  <SelectItem value="bank">Virement bancaire</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog(null)}>Annuler</Button>
            <Button
              onClick={() => paymentDialog && handleAction(paymentDialog, 'payment', {
                amount: parseFloat(paymentAmount),
                month: paymentMonth,
                method: paymentMethod,
              })}
              disabled={!paymentAmount || !paymentMonth || actionLoading === paymentDialog}
            >
              {actionLoading === paymentDialog ? 'Enregistrement...' : 'Confirmer le paiement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}