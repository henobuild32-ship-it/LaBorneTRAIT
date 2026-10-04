'use client';

import React from 'react';
import { 
  Sparkles, 
  FileText, 
  BookOpen, 
  Lightbulb, 
  BarChart3, 
  Calculator, 
  FlaskConical, 
  Landmark, 
  Code, 
  Globe, 
  Bot,
  MessageSquare,
  ArrowRight
} from 'lucide-react';

interface TenoWelcomeProps {
  userName?: string;
  onSelectPrompt: (prompt: string) => void;
  onSelectAssistant: (assistantName: string, promptPrefix: string) => void;
}

export default function TenoWelcome({
  userName,
  onSelectPrompt,
  onSelectAssistant,
}: TenoWelcomeProps) {
  const suggestions = [
    {
      icon: <FileText className="w-4 h-4 text-blue-400" />,
      text: 'Résumer un document',
      prompt: 'Peux-tu me faire un résumé clair et synthétique du document que je vais te partager ?',
    },
    {
      icon: <BookOpen className="w-4 h-4 text-emerald-400" />,
      text: 'Expliquer un concept',
      prompt: 'Explique-moi ce concept de manière simple et pédagogique avec un exemple concret :',
    },
    {
      icon: <Lightbulb className="w-4 h-4 text-amber-400" />,
      text: 'Générer des idées',
      prompt: 'Aide-moi à trouver des idées originales et structurées pour :',
    },
    {
      icon: <BarChart3 className="w-4 h-4 text-purple-400" />,
      text: 'Analyser des données',
      prompt: 'Aide-moi à analyser et interpréter les données ou le tableau suivant :',
    },
  ];

  const assistants = [
    {
      id: 'maths',
      name: 'Mathématiques',
      icon: <Calculator className="w-4 h-4 text-cyan-400" />,
      emoji: '📐',
      color: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-300',
      prefix: 'En tant qu\'expert en Mathématiques, aide-moi à résoudre ou comprendre :',
    },
    {
      id: 'francais',
      name: 'Français',
      icon: <BookOpen className="w-4 h-4 text-emerald-400" />,
      emoji: '📖',
      color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-300',
      prefix: 'En tant qu\'expert en Langue et Littérature française, révise ou explique :',
    },
    {
      id: 'sciences',
      name: 'Sciences',
      icon: <FlaskConical className="w-4 h-4 text-purple-400" />,
      emoji: '🔬',
      color: 'from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-300',
      prefix: 'En tant qu\'assistant scientifique (Physique, Chimie, SVT), explique-moi :',
    },
    {
      id: 'histoire',
      name: 'Histoire-Géo',
      icon: <Landmark className="w-4 h-4 text-amber-400" />,
      emoji: '🏛️',
      color: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-300',
      prefix: 'En tant qu\'historien et géographe, présente-moi les faits ou repères sur :',
    },
    {
      id: 'informatique',
      name: 'Informatique',
      icon: <Code className="w-4 h-4 text-blue-400" />,
      emoji: '💻',
      color: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-300',
      prefix: 'En tant qu\'expert en Informatique et Programmation, conseille-moi sur :',
    },
    {
      id: 'langues',
      name: 'Langues',
      icon: <Globe className="w-4 h-4 text-rose-400" />,
      emoji: '🌍',
      color: 'from-rose-500/20 to-red-500/20 border-rose-500/30 text-rose-300',
      prefix: 'En tant que tuteur en Langues vivantes, aide-moi à traduire ou pratiquer :',
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-full py-8 px-4 sm:px-6 text-center max-w-3xl mx-auto animate-ios-fade-in select-none">
      {/* Animated Avatar Icon */}
      <div className="relative mb-6 group cursor-pointer">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-indigo-500 via-blue-600 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30 group-hover:scale-105 transition-all duration-300">
          <Bot className="w-10 h-10 sm:w-12 sm:h-12 text-white animate-pulse" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 border-2 border-[#0A0A0F] flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
      </div>

      {/* Welcome Title */}
      <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
        👋 Bonjour{userName ? ` ${userName}` : ''} !
      </h1>
      <p className="text-base sm:text-lg text-white/70 font-medium mb-8 max-w-md">
        Que voulez-vous faire ou apprendre aujourd&apos;hui ?
      </p>

      {/* Suggested Chips Section */}
      <div className="w-full mb-8 text-left">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3 px-1 flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" /> Suggestions personnalisées
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {suggestions.map((item, i) => (
            <button
              key={i}
              onClick={() => onSelectPrompt(item.prompt)}
              className="flex items-center gap-3 bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 rounded-2xl p-3.5 transition-all text-left group"
            >
              <div className="p-2 rounded-xl bg-white/5 group-hover:bg-white/10 shrink-0">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors truncate">
                  {item.text}
                </p>
                <p className="text-xs text-white/40 truncate mt-0.5">{item.prompt}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Specialized Assistants Section */}
      <div className="w-full mb-8 text-left">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3 px-1 flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5" /> Assistants spécialisés
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {assistants.map((ast) => (
            <button
              key={ast.id}
              onClick={() => onSelectAssistant(ast.name, ast.prefix)}
              className={`flex items-center gap-2.5 bg-gradient-to-r ${ast.color} border rounded-2xl p-3 text-left hover:scale-[1.02] active:scale-[0.98] transition-all`}
            >
              <span className="text-base shrink-0">{ast.emoji}</span>
              <span className="text-xs font-bold truncate">{ast.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Discreet Context Reminder */}
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/40 text-xs">
        <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <span>Gradi se souvient du contexte de chaque conversation</span>
      </div>
    </div>
  );
}
