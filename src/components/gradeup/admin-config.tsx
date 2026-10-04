'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Settings,
  School,
  Mail,
  Globe,
  Save,
  Info,
  Loader2,
  Upload,
  Trash2,
  CheckCircle2,
  Smartphone,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import PWAInstallDialog from './pwa-install-dialog';

interface ConfigData {
  id: string;
  name: string;
  email: string;
  currency: string;
  logoUrl?: string;
  createdAt: string;
  heureArriveeScolaire?: string;
}

const currencies = [
  { value: 'USD', label: 'USD — Dollar américain', symbol: '$' },
  { value: 'EUR', label: 'EUR — Euro', symbol: '€' },
  { value: 'CDF', label: 'CDF — Franc congolais', symbol: 'FC' },
];

export default function AdminConfig() {
  const { user } = useAppStore();
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [logoUrl, setLogoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [arrivalTime, setArrivalTime] = useState('08:00');

  useEffect(() => {
    if (user?.schoolId) {
      fetchConfig();
    }
  }, [user?.schoolId]);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`/api/config?schoolId=${user?.schoolId}`);
      const data = await res.json();
      if (data.config) {
        setConfig(data.config);
        setSelectedCurrency(data.config.currency || 'USD');
        setLogoUrl(data.config.logoUrl || '');
        setArrivalTime(data.config.heureArriveeScolaire || '08:00');
      }
    } catch {
      toast.error('Erreur lors du chargement de la configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Logo is now saved immediately on upload via /api/ecole/logo
      // This endpoint only saves currency
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: user?.schoolId,
          currency: selectedCurrency,
          heureArriveeScolaire: arrivalTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast.success('Configuration mise à jour avec succès');
      setConfig((prev) => prev ? { ...prev, ...data.config } : data.config);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.schoolId) return;

    const MAX_MB = 48;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`L'image est trop grande (max ${MAX_MB} MB).`);
      return;
    }

    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!ALLOWED.includes(file.type)) {
      toast.error('Format invalide. Acceptés : JPG, PNG, WEBP, GIF, SVG.');
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('schoolId', user.schoolId);

      const res = await fetch('/api/ecole/logo', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur upload');

      setLogoUrl(data.logoUrl);
      setConfig((prev) => prev ? { ...prev, logoUrl: data.logoUrl } : prev);
      if (user?.school) user.school.logoUrl = data.logoUrl;
      toast.success('✅ Logo uploadé et sauvegardé dans Supabase !');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'upload du logo.');
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      e.target.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!user?.schoolId) return;
    try {
      const res = await fetch('/api/ecole/logo', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: user.schoolId }),
      });
      if (!res.ok) throw new Error('Erreur suppression logo');
      setLogoUrl('');
      setConfig((prev) => prev ? { ...prev, logoUrl: '' } : prev);
      if (user?.school) user.school.logoUrl = '';
      toast.success('Logo supprimé.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression.');
    }
  };

  const currentCurrency = currencies.find((c) => c.value === selectedCurrency);

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">
      {/* Page Header */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6">
        <h1 className="text-2xl font-bold">Configuration</h1>
        <p className="text-sm text-muted-foreground mt-1">Paramètres globaux de votre école</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <>
          {/* School Info */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <School className="h-5 w-5 text-blue-600" />
                Informations de l&apos;école
              </CardTitle>
              <CardDescription>Informations enregistrées lors de l&apos;inscription</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3.5 rounded-lg bg-blue-50/50 border border-blue-100/50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                  <School className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nom de l&apos;école</p>
                  <p className="font-semibold">{config?.name || user?.school?.name || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3.5 rounded-lg bg-blue-50/50 border border-blue-100/50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                  <Mail className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email de l&apos;école</p>
                  <p className="font-semibold">{config?.email || user?.school?.email || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3.5 rounded-lg bg-blue-50/50 border border-blue-100/50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                  <Settings className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">École créée le</p>
                  <p className="font-semibold">
                    {config?.createdAt
                      ? new Date(config.createdAt).toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Currency Configuration */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-600" />
                Devise
              </CardTitle>
              <CardDescription>
                Choisissez la devise utilisée sur toute la plateforme
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={selectedCurrency}
                onValueChange={setSelectedCurrency}
                className="space-y-3"
              >
                {currencies.map((currency) => (
                  <Label
                    key={currency.value}
                    htmlFor={`currency-${currency.value}`}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-sm ${
                      selectedCurrency === currency.value
                        ? 'border-blue-500 bg-blue-50 shadow-blue-500/10 shadow-sm'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <RadioGroupItem
                      value={currency.value}
                      id={`currency-${currency.value}`}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{currency.label}</p>
                      <p className="text-sm text-muted-foreground">
                        Symbole : {currency.symbol}
                      </p>
                    </div>
                    <span className="text-2xl font-bold text-muted-foreground/40">
                      {currency.symbol}
                    </span>
                  </Label>
                ))}
              </RadioGroup>

              <Separator />

              <div className="flex items-center gap-2 p-3.5 rounded-lg bg-blue-50 border border-blue-100">
                <Info className="h-4 w-4 text-blue-600 shrink-0" />
                <p className="text-sm text-blue-700">
                  Cette devise sera appliquée à toute la plateforme et affectera l&apos;affichage
                  des frais scolaires et des paiements.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="school-arrival-time">Heure officielle d&apos;arrivée</Label>
                <Input
                  id="school-arrival-time"
                  type="time"
                  value={arrivalTime}
                  onChange={(event) => setArrivalTime(event.target.value)}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Toute présence enregistrée après cette heure sera signalée comme retard.
                </p>
              </div>

              <Button
                onClick={handleSave}
                disabled={saving || (selectedCurrency === config?.currency && arrivalTime === (config?.heureArriveeScolaire || '08:00'))}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-blue-500/20 animate-scale-in"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Enregistrer la devise
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Logo Configuration */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-5 w-5 text-blue-600" />
                Logo de l&apos;école
              </CardTitle>
              <CardDescription>
                Ajoutez le logo de votre établissement pour l&apos;afficher sur toutes les cartes d&apos;identité
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center gap-4">
                {logoUrl ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-32 h-32 rounded-xl border border-border bg-white flex items-center justify-center p-2 shadow-sm overflow-hidden">
                      <img src={logoUrl} alt="Logo de l'école" className="max-w-full max-h-full object-contain" />
                    </div>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={handleRemoveLogo}
                      className="gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      Retirer le logo
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-32 h-32 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 flex items-center justify-center">
                      <School className="w-12 h-12 text-muted-foreground/40" />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">Aucun logo configuré (affichage vide sur les cartes)</p>
                  </div>
                )}

                <div className="w-full">
                  <Label htmlFor="school-logo-upload" className={uploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}>
                    <div className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-3 hover:bg-muted/50 transition-colors">
                      {uploading ? (
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="text-sm text-muted-foreground">
                        {uploading
                          ? 'Upload en cours vers Supabase...'
                          : 'Sélectionner un logo (JPG, PNG, WEBP, GIF, SVG — max 48 MB)'}
                      </span>
                    </div>
                  </Label>
                  <input
                    id="school-logo-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                  />
                  {logoUrl && (
                    <p className="text-[11px] text-emerald-600 mt-1.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Logo sauvegardé — utilisé automatiquement sur les cartes d&apos;identité
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* PWA Install Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-blue-600" />
            Application Mobile
          </CardTitle>
          <CardDescription>
            Installez LaBorneTRAIT sur votre appareil mobile ou bureau pour un accès rapide
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PWAInstallDialog placement="settings" />
        </CardContent>
      </Card>
    </div>
  );
}
