'use client';

import { useState, useEffect } from 'react';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Smartphone, Apple, X, Download, CheckCircle2, Share, Plus } from 'lucide-react';

export default function PWAInstallDialog({ placement = 'sidebar' }: { placement?: 'sidebar' | 'welcome' | 'settings' }) {
  const { isInstallable, isAppInstalled, isIOS, installPWA } = usePWAInstall();
  const [showDialog, setShowDialog] = useState(false);
  const [installStep, setInstallStep] = useState<'idle' | 'installing' | 'done'>('idle');
  const [isAndroid, setIsAndroid] = useState(() => {
    if (typeof window === 'undefined') return false;
    return /android/.test(navigator.userAgent.toLowerCase());
  });
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(localStorage.getItem('pwa-install-dismissed'));
  });
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // No-op or external listeners if needed
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', 'true');
    setDismissed(true);
    setShowDialog(false);
  };

  const handleInstall = async () => {
    setInstallStep('installing');
    setProgress(0);
    await new Promise<void>((resolve) => {
      const started = Date.now();
      const timer = window.setInterval(() => {
        const next = Math.min(100, Math.round(((Date.now() - started) / 3000) * 100));
        setProgress(next);
        if (next >= 100) { window.clearInterval(timer); resolve(); }
      }, 60);
    });
    if (isIOS) { setInstallStep('idle'); return; }
    if (isInstallable) {
      const success = await installPWA();
      if (success) {
        setInstallStep('done');
        setTimeout(() => setShowDialog(false), 2500);
      } else {
        setInstallStep('idle');
      }
    } else setInstallStep('idle');
  };

  if (isAppInstalled || dismissed) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={placement === 'sidebar' ? 'w-full justify-start gap-2 text-xs bg-sidebar-accent/30 border-sidebar-border hover:bg-sidebar-accent/50' : 'gap-2 rounded-full'}
        onClick={() => {
          setInstallStep('idle');
          setShowDialog(true);
        }}
      >
        {isIOS ? (
          <Apple className="w-3.5 h-3.5 text-slate-500 dark:text-slate-300" />
        ) : (
          <Smartphone className="w-3.5 h-3.5 text-green-500" />
        )}
        Télécharger l&apos;application
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-6 text-white">
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-1.5 rounded-xl bg-white shadow-lg shadow-blue-900/20 overflow-hidden shrink-0">
                <img src="/icon-192x192.png" alt="Logo LaBorneTRAIT" width={40} height={40} className="w-10 h-10 object-contain" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Installer LaBorneTRAIT</h3>
                <p className="text-sm text-blue-100">Accédez depuis votre écran d&apos;accueil</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-100">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Notifications push même hors ligne</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-100 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Accès rapide et mode plein écran</span>
            </div>
          </div>

          <div className="p-6">
            {installStep === 'installing' && (
              <div className="space-y-3 py-5" aria-live="polite">
                <div className="flex items-center justify-center gap-2">
                  <span className="animate-spin text-blue-600">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                  </span>
                  <p className="text-sm font-semibold">Téléchargement en cours...</p>
                </div>
                <p className="text-xs text-muted-foreground text-center">{progress}%</p>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-[width] duration-75 rounded-full" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            {/* ===== iOS ===== */}
            {installStep !== 'installing' && isIOS ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground font-medium">
                  Sur iPhone/iPad, ouvrez cette page dans <strong>Safari</strong> puis suivez les étapes :
                </p>
                <ol className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0 mt-0.5">1</span>
                    <span>Appuyez sur l&apos;icône <strong>Partager</strong> en bas de Safari</span>
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 border shrink-0">
                      <Share className="w-4 h-4 text-blue-600" />
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0 mt-0.5">2</span>
                    <span>Faites défiler et sélectionnez <strong>&quot;Sur l&apos;écran d&apos;accueil&quot;</strong></span>
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 border shrink-0">
                      <Plus className="w-4 h-4 text-blue-600" />
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0 mt-0.5">3</span>
                    <span>Appuyez sur <strong>&quot;Ajouter&quot;</strong> en haut à droite</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold shrink-0 mt-0.5">✓</span>
                    <span className="text-green-600 font-medium">LaBorneTRAIT apparaîtra sur votre écran d&apos;accueil !</span>
                  </li>
                </ol>
                <Button onClick={handleInstall} className="w-full" size="lg">
                  Préparer l&apos;ajout à l&apos;écran d&apos;accueil
                </Button>
              </div>
            ) : installStep !== 'installing' ? (
              /* ===== Android / Desktop ===== */
              <div className="space-y-4">
                {installStep === 'done' ? (
                  <div className="text-center py-4">
                    <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <p className="text-sm font-medium text-green-600">LaBorneTRAIT a été installé !</p>
                  </div>
                ) : (
                  <>
                    {isInstallable ? (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Installez LaBorneTRAIT sur votre appareil en un clic.
                        </p>
                        <Button
                          onClick={handleInstall}
                          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                          size="lg"
                        >
                          <span className="flex items-center gap-2">
                            <Download className="w-4 h-4" />
                            Installer maintenant
                          </span>
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground font-medium">
                          {isAndroid ? (
                            <>Dans <strong>Chrome</strong>, installez LaBorneTRAIT :</>
                          ) : (
                            <>Dans votre navigateur, installez LaBorneTRAIT :</>
                          )}
                        </p>
                        <ol className="space-y-3 text-sm">
                          <li className="flex items-start gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0 mt-0.5">1</span>
                            <span>
                              {isAndroid ? (
                                <>Appuyez sur le <strong>menu ⋮</strong> (3 points) en haut à droite</>
                              ) : (
                                <>Appuyez sur le <strong>menu</strong> de votre navigateur</>
                              )}
                            </span>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0 mt-0.5">2</span>
                            <span>Cherchez et appuyez sur <strong>&quot;Installer l&apos;application&quot;</strong> ou <strong>&quot;Ajouter à l&apos;écran d&apos;accueil&quot;</strong></span>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold shrink-0 mt-0.5">✓</span>
                            <span className="text-green-600 font-medium">Confirmez l&apos;installation !</span>
                          </li>
                        </ol>
                      </>
                    )}
                  </>
                )}
                <Button onClick={handleDismiss} variant="ghost" className="w-full" size="sm">
                  Plus tard
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
