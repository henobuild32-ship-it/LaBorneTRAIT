'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Shield, CheckCircle, ExternalLink } from 'lucide-react';

interface CardData {
  id: string;
  fullName: string;
  postName: string;
  roleLabel: string;
  className: string;
  matricule: string;
  photoUrl: string | null;
  school: { name: string; logoUrl: string | null; color: string };
}

export default function VerifyCardPage() {
  const params = useParams();
  const matricule = params.matricule as string;
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!matricule) return;
    fetch(`/api/carte/${matricule}`)
      .then(r => r.json())
      .then(data => {
        if (data.card) setCard(data.card);
        else setError('Carte introuvable');
      })
      .catch(() => setError('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [matricule]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Chargement...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white flex-col gap-4"><Shield className="w-16 h-16 text-red-400" /><p className="text-xl">{error}</p></div>;
  if (!card) return null;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-semibold">
            <CheckCircle className="w-4 h-4" />
            Carte valide
          </div>
          {card.photoUrl && (
            <img src={card.photoUrl} alt="" className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-slate-200" />
          )}
          <h1 className="text-2xl font-bold text-slate-900">{card.fullName}</h1>
          {card.postName && <p className="text-slate-500">{card.postName}</p>}
          <div className="flex justify-center gap-4 text-sm">
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">{card.roleLabel}</span>
            {card.className && <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-medium">{card.className}</span>}
          </div>
          {card.matricule && (
            <p className="text-xs text-slate-400 font-mono">Matricule : {card.matricule}</p>
          )}
          <div className="border-t pt-4 mt-4">
            <p className="text-sm text-slate-600 font-semibold">{card.school.name}</p>
            {card.school.logoUrl && (
              <img src={card.school.logoUrl} alt="Logo" className="h-10 mx-auto mt-2 object-contain" />
            )}
          </div>
        </div>
      </div>
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 text-blue-400 hover:text-blue-300 flex items-center gap-2 text-sm"
      >
        <ExternalLink className="w-4 h-4" />
        Plateforme LaBorneTRAIT
      </a>
    </div>
  );
}
