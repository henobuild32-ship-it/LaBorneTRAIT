'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Search,
  DollarSign,
  MoreVertical,
  CreditCard,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Wallet,
  CircleDollarSign,
  Receipt,
} from 'lucide-react';
import { toast } from 'sonner';

interface PaymentItem {
  id: string;
  studentId: string;
  amount: number;
  status: string;
  month: string;
  method: string;
  createdAt: string;
  student?: { id: string; fullName: string; classEnrollments?: Array<{ class: { id: string; name: string } }> };
}

interface StudentItem {
  id: string;
  fullName: string;
  classEnrollments?: Array<{ class: { id: string; name: string } }>;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  paid: { label: 'Payé', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
  pending: { label: 'En attente', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  overdue: { label: 'En retard', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
};

const months = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export default function AdminPayments() {
  const { user } = useAppStore();
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('ALL');
  const [filterMonth, setFilterMonth] = useState('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formStudentId, setFormStudentId] = useState('');
  const [formClassName, setFormClassName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formMonth, setFormMonth] = useState('');
  const [formStatus, setFormStatus] = useState('pending');
  const [formMethod, setFormMethod] = useState('cash');

  const fetchPayments = useCallback(async () => {
    try {
      let url = `/api/payments?schoolId=${user?.schoolId}`;
      if (activeTab !== 'ALL') url += `&status=${activeTab}`;
      if (filterClass !== 'ALL') url += `&classId=${filterClass}`;
      if (filterMonth !== 'ALL') url += `&month=${filterMonth}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPayments(Array.isArray(data.payments) ? data.payments : []);
    } catch {
      toast.error('Erreur lors du chargement des paiements');
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId, activeTab, filterClass, filterMonth]);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch(`/api/users?schoolId=${user?.schoolId}&role=STUDENT`);
      if (!res.ok) return;
      const data = await res.json();
      setStudents(Array.isArray(data.users) ? data.users : []);
    } catch {
      // silencieux
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

  useEffect(() => {
    if (user?.schoolId) {
      setLoading(true);
      fetchPayments();
      fetchStudents();
      fetchClasses();
    }
  }, [fetchPayments, fetchStudents, fetchClasses, user?.schoolId]);

  const resetForm = () => {
    setFormStudentId('');
    setFormClassName('');
    setFormAmount('');
    setFormMonth('');
    setFormStatus('pending');
    setFormMethod('cash');
  };

  const selectStudent = (studentId: string) => {
    setFormStudentId(studentId);
    const selectedStudent = students.find((student) => student.id === studentId);
    setFormClassName(selectedStudent?.classEnrollments?.[0]?.class.name || 'Aucune classe attribuée');
  };

  const handleSubmit = async () => {
    if (!formStudentId) {
      toast.error('Veuillez sélectionner un élève');
      return;
    }
    if (!formAmount || parseFloat(formAmount) <= 0) {
      toast.error('Veuillez entrer un montant valide');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: user?.schoolId,
          studentId: formStudentId,
          amount: parseFloat(formAmount),
          month: formMonth,
          status: formStatus,
          method: formMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast.success('Paiement enregistré avec succès');
      setDialogOpen(false);
      resetForm();
      fetchPayments();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'opération');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (paymentId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: user?.schoolId,
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast.success('Statut mis à jour avec succès');
      fetchPayments();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la mise à jour');
    }
  };

  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.student?.fullName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const totalPaid = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payments
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalOverdue = payments
    .filter((p) => p.status === 'overdue')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalAll = totalPaid + totalPending + totalOverdue;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Gestion des paiements</h1>
            <p className="text-sm text-muted-foreground mt-1">Suivez et gérez les paiements des élèves</p>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-blue-500/20">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau paiement
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-100">
              <Wallet className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total</p>
              <p className="text-xl font-bold text-blue-600">{totalAll.toLocaleString()} USD</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-100">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Payé</p>
              <p className="text-xl font-bold text-emerald-600">{totalPaid.toLocaleString()} USD</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-100">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">En attente</p>
              <p className="text-xl font-bold text-amber-600">{totalPending.toLocaleString()} USD</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-gradient-to-br from-red-50 to-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">En retard</p>
              <p className="text-xl font-bold text-red-600">{totalOverdue.toLocaleString()} USD</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="ALL">Tous</TabsTrigger>
            <TabsTrigger value="paid">
              <CheckCircle className="h-3.5 w-3.5 mr-1 text-emerald-500" />
              Payé
            </TabsTrigger>
            <TabsTrigger value="pending">
              <Clock className="h-3.5 w-3.5 mr-1 text-amber-500" />
              En attente
            </TabsTrigger>
            <TabsTrigger value="overdue">
              <AlertTriangle className="h-3.5 w-3.5 mr-1 text-red-500" />
              En retard
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-[160px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                <SelectValue placeholder="Toutes les classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes les classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[160px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                <SelectValue placeholder="Tous les mois" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les mois</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Tabs>

      {/* Payments Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un élève..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <CreditCard className="h-10 w-10 text-muted-foreground/60" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Aucun paiement trouvé</h3>
              <p className="text-muted-foreground">Enregistrez le premier paiement pour commencer</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>Élève</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Mois</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Méthode</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&>tr:nth-child(even)]:bg-muted/30">
                  {filteredPayments.map((p) => {
                    const status = statusConfig[p.status] || statusConfig.pending;
                    const StatusIcon = status.icon;
                    return (
                      <TableRow key={p.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors">
                        <TableCell className="font-medium">
                          <div>{p.student?.fullName || 'Inconnu'}</div>
                          {p.student?.classEnrollments?.[0]?.class.name && (
                            <div className="text-xs font-normal text-muted-foreground">
                              {p.student.classEnrollments[0].class.name}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-bold">
                          {Number(p.amount).toLocaleString()} <span className="text-muted-foreground font-normal">USD</span>
                        </TableCell>
                        <TableCell>{p.month || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={status.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground">{p.method || '—'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {p.createdAt ? new Date(p.createdAt).toLocaleDateString('fr-FR') : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 transition-colors">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleUpdateStatus(p.id, 'paid')}>
                                <CheckCircle className="h-4 w-4 mr-2 text-emerald-600" />
                                Marquer payé
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleUpdateStatus(p.id, 'pending')}>
                                <Clock className="h-4 w-4 mr-2 text-amber-600" />
                                Marquer en attente
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleUpdateStatus(p.id, 'overdue')}>
                                <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
                                Marquer en retard
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Payment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-t-lg -mx-6 -mt-6 mb-0" />
          <DialogHeader className="pt-2">
            <DialogTitle className="flex items-center gap-2">
              <CircleDollarSign className="h-5 w-5 text-blue-600" />
              Nouveau paiement
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pay-student">Élève *</Label>
              <Select value={formStudentId} onValueChange={selectStudent}>
                <SelectTrigger id="pay-student" className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                  <SelectValue placeholder="Sélectionner un élève" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-class">Classe</Label>
              <Input
                id="pay-class"
                value={formClassName}
                placeholder="Sélectionnez un élève"
                readOnly
                className="bg-muted text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-amount">Montant (USD) *</Label>
              <Input
                id="pay-amount"
                type="number"
                min="0"
                step="0.01"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0.00"
                className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-month">Mois</Label>
              <Select value={formMonth} onValueChange={setFormMonth}>
                <SelectTrigger id="pay-month" className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                  <SelectValue placeholder="Sélectionner un mois" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pay-status">Statut</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger id="pay-status" className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="paid">Payé</SelectItem>
                    <SelectItem value="overdue">En retard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-method">Méthode</Label>
                <Select value={formMethod} onValueChange={setFormMethod}>
                  <SelectTrigger id="pay-method" className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="virement">Virement</SelectItem>
                    <SelectItem value="mobile">Mobile Money</SelectItem>
                  </SelectContent>
                </Select>
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
              {submitting ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
