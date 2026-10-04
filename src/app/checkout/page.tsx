'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CreditCard, 
  ShieldCheck, 
  Smartphone, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ArrowLeft, 
  Building2,
  Wallet,
  Phone,
  Lock,
  ChevronRight,
  Globe
} from 'lucide-react';

type PaymentStep = 'init' | 'processing' | 'success' | 'failed';
const STUDENT_CARD_PRICE_USD = 10;

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [step, setStep] = useState<PaymentStep>('init');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [errorMsg, setErrorMsg] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const requestedCurrency = searchParams.get('currency');
  const currency = 'USD';
  const description = searchParams.get('description') || 'Paiement carte d\'identité scolaire';
  const successUrl = searchParams.get('successUrl') || '/dashboard';
  const cancelUrl = searchParams.get('cancelUrl') || '/api/payments/geniuspay/cancel';
  const invalidCurrency = requestedCurrency !== null && requestedCurrency !== currency;
  const displayAmount = STUDENT_CARD_PRICE_USD.toFixed(2).replace('.', ',');

  const operators = [
    { id: 'orange', name: 'Orange Money', color: 'from-orange-500 to-orange-600', icon: '📱', countries: ['CM', 'CI', 'SN', 'ML', 'BF', 'NE', 'TG', 'BJ'] },
    { id: 'mpesa', name: 'M-Pesa', color: 'from-green-500 to-green-600', icon: '📱', countries: ['KE', 'TZ', 'UG', 'RW', 'ZM', 'GH'] },
    { id: 'airtel', name: 'Airtel Money', color: 'from-red-500 to-red-600', icon: '📱', countries: ['KE', 'UG', 'RW', 'ZM', 'MW', 'TD'] },
    { id: 'mtn', name: 'MTN Mobile Money', color: 'from-yellow-500 to-yellow-600', icon: '📱', countries: ['CI', 'GH', 'UG', 'RW', 'ZM', 'CM'] },
    { id: 'vodacom', name: 'Vodacom M-Pesa', color: 'from-red-600 to-red-700', icon: '📱', countries: ['CD', 'TZ'] },
    { id: 'africell', name: 'Africell Money', color: 'from-blue-500 to-blue-600', icon: '📱', countries: ['GM', 'SL', 'UG', 'CD'] },
  ];

  const handleBack = () => {
    if (step === 'init') {
      window.location.href = cancelUrl;
    } else {
      setStep('init');
      setErrorMsg('');
    }
  };

  const handlePay = async () => {
    if (invalidCurrency) {
      setErrorMsg('Cette page de paiement accepte uniquement le dollar américain (USD).');
      return;
    }
    if (!selectedOperator) {
      setErrorMsg('Veuillez sélectionner un opérateur Mobile Money');
      return;
    }
    if (!phoneNumber || phoneNumber.length < 8) {
      setErrorMsg('Veuillez entrer un numéro de téléphone valide');
      return;
    }

    setStep('processing');
    setErrorMsg('');

    // Simuler le traitement du paiement (3 secondes)
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Toujours succès en sandbox
    setStep('success');
    let count = 5;
    setCountdown(count);
    timerRef.current = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        window.location.href = successUrl;
      }
    }, 1000);
  };

  // Nettoyage
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={handleBack}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Retour</span>
          </button>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            <span className="text-white font-bold text-lg">LaBorneTRAIT</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Init - Formulaire de paiement */}
          {step === 'init' && (
            <motion.div
              key="init"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Card montant */}
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10 text-center">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wallet className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="text-white/60 text-sm mb-2">Montant à payer</p>
                <p className="text-5xl font-bold text-white mb-2">{displayAmount} <span className="text-2xl text-emerald-300">USD</span></p>
                <p className="text-emerald-300/80 text-xs font-semibold">Prix fixe de la carte scolaire</p>
                <p className="text-white/40 text-xs">{description}</p>
              </div>

              {/* Sélection opérateur */}
              <div>
                <p className="text-white/80 text-sm font-medium mb-3 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-blue-400" />
                  Choisissez votre opérateur Mobile Money
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {operators.map((op) => (
                    <button
                      key={op.id}
                      onClick={() => { setSelectedOperator(op.id); setErrorMsg(''); }}
                      className={`relative p-4 rounded-xl border transition-all duration-200 ${
                        selectedOperator === op.id
                          ? `bg-gradient-to-r ${op.color} border-white/40 shadow-lg scale-[1.02]`
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <span className="text-2xl mb-2 block">{op.icon}</span>
                      <p className={`text-xs font-semibold ${selectedOperator === op.id ? 'text-white' : 'text-white/80'}`}>
                        {op.name}
                      </p>
                      <div className="flex gap-0.5 mt-1 justify-center">
                        {op.countries.slice(0, 3).map((c, i) => (
                          <span key={i} className={`text-[8px] ${selectedOperator === op.id ? 'text-white/60' : 'text-white/30'} font-mono`}>
                            {c}
                          </span>
                        ))}
                      </div>
                      {selectedOperator === op.id && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Numéro de téléphone */}
              <div>
                <p className="text-white/80 text-sm font-medium mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-blue-400" />
                  Numéro Mobile Money
                </p>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-white/40">
                    <Globe className="w-4 h-4" />
                    <span className="text-sm">+</span>
                  </div>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => {
                      setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''));
                      setErrorMsg('');
                    }}
                    placeholder="243 XXX XXX XXX"
                    className="w-full pl-16 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all text-lg font-mono"
                    maxLength={15}
                  />
                </div>
                <p className="text-white/30 text-xs mt-2">
                  Ex: 243811223344 (indicatif pays + numéro)
                </p>
              </div>

              {/* Message d'erreur */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-300 text-sm">{errorMsg}</p>
                </div>
              )}

              {/* Bouton payer */}
              <button
                onClick={handlePay}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <CreditCard className="w-5 h-5" />
                Payer {displayAmount} USD
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Sécurité */}
              <div className="flex items-center justify-center gap-2 text-white/30 text-xs">
                <Lock className="w-3 h-3" />
                <span>Paiement sécurisé via Mobile Money</span>
                <ShieldCheck className="w-3 h-3" />
              </div>
            </motion.div>
          )}

          {/* Step 2: Processing */}
          {step === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="bg-white/5 backdrop-blur-xl rounded-2xl p-10 border border-white/10 text-center space-y-6"
            >
              <div className="w-24 h-24 mx-auto relative">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
                <div className="relative w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-white animate-spin" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Traitement en cours</h2>
                <p className="text-white/60">Veuillez confirmer la transaction sur votre téléphone</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-white/40 text-sm">Un code de confirmation vous a été envoyé au</p>
                <p className="text-white font-mono text-lg font-bold mt-1">
                  {phoneNumber ? `+${phoneNumber.replace(/(\d{3})(\d{2})(\d{3})(\d{3})/, '$1 $2 $3 $4')}` : '---'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-white/30 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Transaction en cours...</span>
              </div>
            </motion.div>
          )}

          {/* Step 3: Success */}
          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="bg-white/5 backdrop-blur-xl rounded-2xl p-10 border border-white/10 text-center space-y-6"
            >
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="w-12 h-12 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">✅ Paiement réussi !</h2>
                <p className="text-white/60">
                  Votre paiement de <strong className="text-emerald-400">{displayAmount} USD</strong> a été effectué avec succès.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-emerald-300 text-sm">
                  Vous allez être redirigé dans <strong className="text-white">{countdown}</strong> seconde{countdown > 1 ? 's' : ''}...
                </p>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 5, ease: 'linear' }}
                />
              </div>
              <button
                onClick={() => window.location.href = successUrl}
                className="text-white/50 hover:text-white text-sm transition-colors underline underline-offset-4"
              >
                Rediriger maintenant
              </button>
            </motion.div>
          )}

          {/* Step 4: Failed */}
          {step === 'failed' && (
            <motion.div
              key="failed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 0.9 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="bg-white/5 backdrop-blur-xl rounded-2xl p-10 border border-white/10 text-center space-y-6"
            >
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
                <XCircle className="w-12 h-12 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">❌ Paiement échoué</h2>
                <p className="text-white/60">{errorMsg || 'La transaction a été refusée. Veuillez réessayer.'}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('init'); setErrorMsg(''); }}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all"
                >
                  Réessayer
                </button>
                <button
                  onClick={() => window.location.href = cancelUrl}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-medium transition-all"
                >
                  Annuler
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-white/20 text-xs">
            Propulsé par <span className="text-white/40 font-semibold">LaBorneTRAIT</span> · Paiement sécurisé
          </p>
          <div className="flex items-center justify-center gap-3 mt-2">
            <span className="text-white/20 text-xs">🔒 256-bit SSL</span>
            <span className="text-white/20">·</span>
            <span className="text-white/20 text-xs">PCI Compliant</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-white/60">Chargement de l'interface de paiement...</p>
        </div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
