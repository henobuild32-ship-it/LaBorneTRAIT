'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import type { UserInfo, PaymentInfo } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  CreditCard, CheckCircle2, Clock, AlertTriangle, CircleDollarSign, CalendarDays, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ParentPayments() {
  const { user } = useAppStore();
  const [children, setChildren] = useState<UserInfo[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [payments, setPayments] = useState<PaymentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const schoolId = user?.schoolId || '';
  const currency = user?.school?.currency || 'FCFA';

  useEffect(() => { fetchChildren(); }, [user]);
  useEffect(() => { if (selectedChildId && schoolId) { fetchPayments(); } }, [selectedChildId, schoolId]);

  const fetchChildren = async () => {
    if (!user?.id || !schoolId) {
      setLoadingChildren(false);
      return;
    }
    setLoadingChildren(true);
    try {
      const res = await fetch(`/api/users?schoolId=${schoolId}&role=STUDENT&parentId=${user.id}`);
      if (res.ok) { 
        const data = await res.json(); 
        const childrenArray = Array.isArray(data.users) ? data.users : [];
        setChildren(childrenArray); 
        if (childrenArray.length > 0 && !selectedChildId) { 
          setSelectedChildId(childrenArray[0].id); 
        } 
      } else {
        setChildren([]);
      }
    } catch { 
      toast.error('Erreur lors du chargement des enfants');
      setChildren([]);
    } finally { 
      setLoadingChildren(false);
    }
  };

  const fetchPayments = async () => {
    if (!selectedChildId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payments?schoolId=${schoolId}&studentId=${selectedChildId}`);
      if (res.ok) { 
        const data = await res.json();
        setPayments(Array.isArray(data.payments) ? data.payments : []);
      } else {
        setPayments([]);
      }
    } catch { 
      toast.error('Erreur lors du chargement des paiements');
      setPayments([]);
    } finally { 
      setLoading(false);
    }
  };

  const selectedChild = Array.isArray(children) ? children.find(c => c.id === selectedChildId) : undefined;

  const paidPayments = Array.isArray(payments) ? payments.filter(p => p.status === 'paid') : [];
  const pendingPayments = Array.isArray(payments) ? payments.filter(p => p.status === 'pending') : [];
  const overduePayments = Array.isArray(payments) ? payments.filter(p => p.status === 'overdue') : [];
  const totalAmount = Array.isArray(payments) ? payments.reduce((sum, p) => sum + p.amount, 0) : 0;
  const paidAmount = paidPayments.reduce((sum, p) => sum + p.amount, 0);
  const pendingAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
  const overdueAmount = overduePayments.reduce((sum, p) => sum + p.amount, 0);
  const paymentProgress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 gap-1"><CheckCircle2 className="size-3" />Payé</Badge>;
      case 'pending': return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 gap-1"><Clock className="size-3" />En attente</Badge>;
      case 'overdue': return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200 gap-1"><AlertTriangle className="size-3" />En retard</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const formatAmount = (amount: number) => new Intl.NumberFormat('fr-FR').format(amount);

  if (!user) return null;

  // Affichage du chargement des enfants
  if (loadingChildren) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6">
          <h1 className="text-2xl font-bold">Paiements</h1>
          <p className="text-sm text-muted-foreground mt-1">Suivi des paiements scolaires</p>
        </div>
        <Skeleton className="h-12 w-full max-w-md" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Aucun enfant trouvé
  if (Array.isArray(children) && children.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6">
          <h1 className="text-2xl font-bold">Paiements</h1>
          <p className="text-sm text-muted-foreground mt-1">Suivi des paiements scolaires</p>
        </div>
        <div className="text-center py-20">
          <div className="mx-auto w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <CreditCard className="h-12 w-12 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground text-center">Aucun enfant trouvé</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6">
        <h1 className="text-2xl font-bold">Paiements</h1>
        <p className="text-sm text-muted-foreground mt-1">Suivi des paiements scolaires</p>
      </div>

      {/* Child selector */}
      {Array.isArray(children) && children.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Enfant :</span>
          <Select value={selectedChildId} onValueChange={setSelectedChildId}>
            <SelectTrigger className="w-full sm:w-[200px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
              <SelectValue placeholder="Sélectionner un enfant" />
            </SelectTrigger>
            <SelectContent>
              {children.map(child => <SelectItem key={child.id} value={child.id}>{child.fullName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !Array.isArray(payments) || payments.length === 0 ? (
        <div className="text-center py-20">
          <div className="mx-auto w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <CreditCard className="h-12 w-12 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground text-center">Aucun paiement trouvé pour {selectedChild?.fullName || 'votre enfant'}</p>
        </div>
      ) : (
        <>
          {/* Payment Overview */}
          <Card className="border-blue-100 bg-gradient-to-r from-blue-50/50 to-white shadow-sm">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="size-4 text-blue-600" />Résumé des paiements — {selectedChild?.fullName}
                </div>
                <span className="text-sm text-muted-foreground">{formatAmount(paidAmount)} / {formatAmount(totalAmount)} {currency}</span>
              </div>
              <div className="space-y-1">
                <div className="h-3 w-full rounded-full overflow-hidden bg-primary/10">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${paymentProgress}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{paymentProgress.toFixed(0)}% payé</span>
                  <span>{formatAmount(totalAmount - paidAmount)} {currency} restant</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50/80 border border-emerald-100">
                  <div className="size-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Payé</p>
                    <p className="text-sm font-semibold text-emerald-700">{paidPayments.length} · {formatAmount(paidAmount)} {currency}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50/80 border border-amber-100">
                  <div className="size-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <Clock className="size-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">En attente</p>
                    <p className="text-sm font-semibold text-amber-700">{pendingPayments.length} · {formatAmount(pendingAmount)} {currency}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50/80 border border-red-100">
                  <div className="size-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="size-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">En retard</p>
                    <p className="text-sm font-semibold text-red-700">{overduePayments.length} · {formatAmount(overdueAmount)} {currency}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CircleDollarSign className="size-5 text-blue-600" />Historique des paiements
              </CardTitle>
              <CardDescription>Tous les paiements de {selectedChild?.fullName}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[500px]">
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead>
                          <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />Mois</span>
                        </TableHead>
                        <TableHead className="text-right">
                          <span className="flex items-center justify-end gap-1.5"><CreditCard className="size-3.5" />Montant</span>
                        </TableHead>
                        <TableHead className="text-center">Statut</TableHead>
                        <TableHead className="hidden sm:table-cell">Méthode</TableHead>
                        <TableHead className="hidden md:table-cell">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...payments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(payment => (
                        <TableRow key={payment.id} className="even:bg-muted/20 hover:bg-blue-50/50 transition-colors">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {payment.status === 'overdue' && <AlertTriangle className="size-4 text-red-500 shrink-0" />}
                              {payment.month}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold">{formatAmount(payment.amount)} {currency}</TableCell>
                          <TableCell className="text-center">{getStatusBadge(payment.status)}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">{payment.method || '—'}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground text-xs">{formatDate(payment.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="block md:hidden space-y-3 p-1">
                  {[...payments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(payment => (
                    <div key={payment.id} className="rounded-xl border border-border bg-background/80 p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{payment.month}</p>
                          <p className="text-xs text-muted-foreground">{payment.method || '—'}</p>
                        </div>
                        {getStatusBadge(payment.status)}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{formatAmount(payment.amount)} {currency}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(payment.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}