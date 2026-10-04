'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { CheckCircle2, CheckCircle, X } from 'lucide-react';
import type { PageView } from '@/lib/types';

interface WelcomeBannerProps {
  totalStudents: number;
}

const onboardingSteps = [
  {
    id: 'classes',
    title: 'Créer des classes',
    description: 'Organisez votre établissement en classes et niveaux',
    page: 'admin-classes' as PageView,
  },
  {
    id: 'teachers',
    title: 'Ajouter des professeurs',
    description: 'Invitez vos enseignants à rejoindre la plateforme',
    page: 'admin-users' as PageView,
  },
  {
    id: 'students',
    title: 'Inscrire des élèves',
    description: 'Ajoutez vos élèves et assignez-les aux classes',
    page: 'admin-users' as PageView,
  },
];

export default function WelcomeBanner({ totalStudents }: WelcomeBannerProps) {
  const { setCurrentPage } = useAppStore();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('gradeup-welcome-dismissed') === 'true';
  });
  const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem('gradeup-onboarding-completed');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return [];
      }
    }
    return [];
  });

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('gradeup-welcome-dismissed', 'true');
  };

  const handleCompleteStep = (stepId: string) => {
    const updated = [...completedSteps, stepId];
    setCompletedSteps(updated);
    localStorage.setItem('gradeup-onboarding-completed', JSON.stringify(updated));
  };

  const handleNavigate = (page: PageView, stepId: string) => {
    handleCompleteStep(stepId);
    setCurrentPage(page);
  };

  if (dismissed || totalStudents > 0) return null;

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-6 text-white animate-fade-in">
      {/* Decorative circles */}
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">
              Bienvenue sur LaBorneTRAIT ! 🎓
            </h2>
            <p className="text-blue-100 mt-1 text-sm">
              Configurez votre établissement en suivant ces 3 étapes simples
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-white/70 hover:text-white hover:bg-white/10 shrink-0"
            onClick={handleDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="mt-5 space-y-3">
          {onboardingSteps.map((step, index) => {
            const isCompleted = completedSteps.includes(step.id);
            return (
              <div
                key={step.id}
                className="flex items-center gap-3 rounded-lg bg-white/10 backdrop-blur-sm p-3 transition-colors hover:bg-white/15"
              >
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/20 shrink-0 text-sm font-bold">
                  {isCompleted ? (
                    <CheckCircle className="h-5 w-5 text-green-300" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-white/60" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-blue-200">
                      Étape {index + 1}
                    </span>
                    {isCompleted && (
                      <span className="text-xs bg-green-500/20 text-green-200 px-2 py-0.5 rounded-full">
                        Terminé
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-white">{step.title}</p>
                  <p className="text-xs text-blue-200/80 hidden sm:block">{step.description}</p>
                </div>
                <Button
                  size="sm"
                  className="bg-white text-blue-700 hover:bg-blue-50 shrink-0 font-medium"
                  onClick={() => handleNavigate(step.page, step.id)}
                >
                  Commencer
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
