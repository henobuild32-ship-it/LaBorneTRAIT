'use client';

import { Construction, Sparkles } from 'lucide-react';

/** Affiche « en construction » remplaçant temporairement l'assistant IA. */
export default function AiComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col h-full gap-3">
      <div className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 text-white shadow-lg shadow-blue-500/20 shrink-0">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm text-base">
            🤖
          </span>
          {title}
        </h1>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex min-h-[320px] h-full items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border-2 border-dashed border-amber-400/70 bg-amber-50 dark:bg-amber-950/30 p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-600 dark:text-amber-400">
              <Construction className="h-8 w-8" />
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              <Sparkles className="h-3.5 w-3.5" />
              Travaux en cours
            </span>

            <h2 className="mt-3 text-xl font-bold text-slate-800 dark:text-slate-100">
              En construction
            </h2>
            <p className="mt-1 text-2xl font-extrabold text-amber-600 dark:text-amber-400">
              Bientôt disponible
            </p>

            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Notre assistant IA est en cours de préparation. Il ouvrira ses portes très bientôt.
            </p>

            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-amber-200/70 dark:bg-amber-900/50">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-amber-500" />
            </div>

            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              En attendant : notes, devoirs, présences et bulletins restent bien disponibles.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
