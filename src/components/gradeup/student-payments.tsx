'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import type { PaymentInfo } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { CreditCard, CheckCircle, Clock, AlertCircle, Receipt } from 'lucide-react';

export default function StudentPayments() {
  const user = useAppStore((s) => s.user);
  const [payments, setPayments] = useState<PaymentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.schoolId || !user?.id) return;
    const fetchPayments = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/payments?schoolId=${user.schoolId}&studentId=${user.id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        const sorted = (Array.isArray(data.payments) ? data.payments : []).sort((a: PaymentInfo, b: PaymentInfo) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setPayments(sorted);
      } catch { /* ignore */ } finally { setLoading(false); }
    };
    fetchPayments();
  }, [user?.schoolId, user?.id]);

  const paidCount = payments.filter((p) => p.status === 'paid').length;
  const pendingCount = payments.filter((p) => p.status === 'pending').length;
  const overdueCount = payments.filter((p) => p.status === 'overdue').length;
  const totalPaid = payments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
  const currency = user?.school?.currency || 'FCFA';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1"><CheckCircle className="h-3 w-3" />Payé</Badge>;
      case 'pending': return <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1"><Clock className="h-3 w-3" />En attente</Badge>;
      case 'overdue': return <Badge className="bg-red-100 text-red-700 border-red-200 gap-1"><AlertCircle className="h-3 w-3" />En retard</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusIcon = () => {
    if (overdueCount > 0) return <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100"><AlertCircle className="h-8 w-8 text-red-600" /></div>;
    if (pendingCount > 0) return <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100"><Clock className="h-8 w-8 text-amber-600" /></div>;
    return <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100"><CheckCircle className="h-8 w-8 text-emerald-600" /></div>;
  };

  const getStatusText = () => {
    if (overdueCount > 0) return 'Paiements en retard';
    if (pendingCount > 0) return 'Paiements en attente';
    if (payments.length > 0) return 'Tous les paiements sont à jour';
    return 'Aucun paiement enregistré';
  };

  const getStatusDescription = () => {
    if (overdueCount > 0) return `Vous avez ${overdueCount} paiement(s) en retard. Veuillez régulariser votre situation.`;
    if (pendingCount > 0) return `Vous avez ${pendingCount} paiement(s) en attente de traitement.`;
    if (payments.length > 0) return `Vous avez effectué ${paidCount} paiement(s) d'un montant total de ${totalPaid.toLocaleString('fr-FR')} ${currency}.`;
    return 'Aucun paiement n\'a été enregistré pour le moment.';
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-24 rounded-xl" /><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6">
        <h1 className="text-2xl font-bold">Mes paiements</h1>
        <p className="text-sm text-muted-foreground mt-1">Suivez l&apos;état de vos paiements scolaires</p>
      </div>

      {/* Status Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-sm">
        <CardContent className="flex items-center gap-6">
          {getStatusIcon()}
          <div className="flex-1">
            <h3 className="text-xl font-bold">{getStatusText()}</h3>
            <p className="text-sm text-muted-foreground mt-1">{getStatusDescription()}</p>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-sm">
            <div className="text-center p-2 rounded-lg bg-white/60">
              <p className="text-lg font-bold text-emerald-600">{paidCount}</p>
              <p className="text-xs text-muted-foreground">Payé(s)</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-white/60">
              <p className="text-lg font-bold text-amber-600">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">En attente</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-white/60">
              <p className="text-lg font-bold text-red-600">{overdueCount}</p>
              <p className="text-xs text-muted-foreground">En retard</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Receipt className="h-5 w-5 text-blue-500" />Historique des paiements</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4"><CreditCard className="h-10 w-10 text-muted-foreground/50" /></div>
              <h3 className="text-lg font-semibold mb-1">Aucun paiement</h3>
              <p className="text-muted-foreground">Aucun paiement enregistré pour le moment.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30"><TableHead className="pl-6">Mois</TableHead><TableHead className="text-center">Montant</TableHead><TableHead className="text-center">Statut</TableHead><TableHead className="hidden sm:table-cell text-center">Méthode</TableHead><TableHead className="hidden sm:table-cell">Date</TableHead></TableRow>
                </TableHeader>
                <TableBody className="[&>tr:nth-child(even)]:bg-muted/30">
                  {payments.map((payment) => (
                    <TableRow key={payment.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors">
                      <TableCell className="pl-6 font-medium">{payment.month}</TableCell>
                      <TableCell className="text-center font-bold">{payment.amount.toLocaleString('fr-FR')} <span className="text-muted-foreground font-normal">{currency}</span></TableCell>
                      <TableCell className="text-center">{getStatusBadge(payment.status)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-center text-muted-foreground">{payment.method || '—'}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{formatDate(payment.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
