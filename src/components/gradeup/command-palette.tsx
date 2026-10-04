'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { PageView, UserRole } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  LayoutDashboard,
  Users,
  School,
  CreditCard,
  Settings,
  BarChart3,
  Bell,
  BookOpen,
  FileText,
  ClipboardList,
  ClipboardCheck,
  Calendar,
  Bot,
  Video,
  GraduationCap,
  DollarSign,
  MessageSquare,
  CalendarDays,
  User,
  Lightbulb,
  Search,
  Megaphone,
} from 'lucide-react';

interface PaletteItem {
  label: string;
  page: PageView;
  icon: React.ElementType;
}

const navItemsByRole: Record<UserRole, PaletteItem[]> = {
  ADMIN: [
    { label: 'Tableau de bord', page: 'admin-dashboard', icon: LayoutDashboard },
    { label: 'Utilisateurs', page: 'admin-users', icon: Users },
    { label: 'Classes', page: 'admin-classes', icon: School },
    { label: 'Paiements', page: 'admin-payments', icon: CreditCard },
    { label: 'Configuration', page: 'admin-config', icon: Settings },
    { label: 'Rapports', page: 'admin-reports', icon: BarChart3 },
    { label: 'Notifications', page: 'admin-notifications', icon: Bell },
    { label: 'Visioconférences', page: 'admin-conferences', icon: Video },
    { label: 'Cartes Élèves', page: 'admin-cards', icon: GraduationCap },
    { label: 'Frais scolaires', page: 'admin-tuition', icon: DollarSign },
    { label: 'Présence', page: 'admin-presence', icon: ClipboardCheck },
    { label: 'Cours', page: 'admin-courses', icon: BookOpen },
    { label: 'Devoirs', page: 'admin-homework', icon: ClipboardCheck },
    { label: 'Emploi du temps', page: 'admin-schedules', icon: Calendar },
    { label: 'IA Teno', page: 'admin-ai', icon: Bot },
    { label: 'Fin du cursus', page: 'admin-end-of-year', icon: FileText },
    { label: 'Messagerie', page: 'messages', icon: MessageSquare },
    { label: 'Communiqués', page: 'announcements', icon: Megaphone },
    { label: 'Calendrier', page: 'calendar', icon: CalendarDays },
    { label: 'Profil', page: 'profile', icon: User },
    { label: 'Aide', page: 'help', icon: Search },
  ],
  TEACHER: [
    { label: 'Tableau de bord', page: 'teacher-dashboard', icon: LayoutDashboard },
    { label: 'Cours', page: 'teacher-courses', icon: BookOpen },
    { label: 'Emploi du temps', page: 'teacher-schedules', icon: Calendar },
    { label: 'Leçons', page: 'teacher-lessons', icon: FileText },
    { label: 'Notes', page: 'teacher-grades', icon: ClipboardList },
    { label: 'Devoirs', page: 'teacher-homework', icon: ClipboardCheck },
    { label: 'Documents', page: 'teacher-documents', icon: FileText },
    { label: 'Absences', page: 'teacher-attendance', icon: Calendar },
    { label: 'IA Teno', page: 'teacher-ai', icon: Bot },
    { label: 'Messagerie', page: 'messages', icon: MessageSquare },
    { label: 'Communiqués', page: 'announcements', icon: Megaphone },
    { label: 'Calendrier', page: 'calendar', icon: CalendarDays },
    { label: 'Profil', page: 'profile', icon: User },
    { label: 'Aide', page: 'help', icon: Search },
  ],
  STUDENT: [
    { label: 'Tableau de bord', page: 'student-dashboard', icon: LayoutDashboard },
    { label: 'Cours', page: 'student-courses', icon: BookOpen },
    { label: 'Emploi du temps', page: 'student-schedules', icon: Calendar },
    { label: 'Leçons', page: 'student-lessons', icon: FileText },
    { label: 'Notes', page: 'student-grades', icon: ClipboardList },
    { label: 'Devoirs', page: 'student-homework', icon: ClipboardCheck },
    { label: 'Absences', page: 'student-attendance', icon: Calendar },
    { label: 'IA Teno', page: 'student-ai', icon: Bot },
    { label: 'Notifications', page: 'student-notifications', icon: Bell },
    { label: 'Messagerie', page: 'messages', icon: MessageSquare },
    { label: 'Communiqués', page: 'announcements', icon: Megaphone },
    { label: 'Calendrier', page: 'calendar', icon: CalendarDays },
    { label: 'Profil', page: 'profile', icon: User },
    { label: 'Aide', page: 'help', icon: Search },
  ],
  PARENT: [
    { label: 'Tableau de bord', page: 'parent-dashboard', icon: LayoutDashboard },
    { label: 'Suivi scolaire', page: 'parent-grades', icon: BarChart3 },
    { label: 'Paiements', page: 'parent-payments', icon: CreditCard },
    { label: 'Notifications', page: 'parent-notifications', icon: Bell },
    { label: 'Messagerie', page: 'messages', icon: MessageSquare },
    { label: 'Communiqués', page: 'announcements', icon: Megaphone },
    { label: 'Profil', page: 'profile', icon: User },
    { label: 'Aide', page: 'help', icon: Lightbulb },
  ],
};

function fuzzyMatch(query: string, text: string): boolean {
  const lowerQuery = query.toLowerCase().replace(/\s+/g, '');
  const lowerText = text.toLowerCase().replace(/\s+/g, '');

  let qi = 0;
  for (let ti = 0; ti < lowerText.length && qi < lowerQuery.length; ti++) {
    if (lowerText[ti] === lowerQuery[qi]) {
      qi++;
    }
  }
  return qi === lowerQuery.length;
}

export default function CommandPalette() {
  const { user, setCurrentPage, currentPage } = useAppStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items = user ? navItemsByRole[user.role] : [];

  const filteredItems = query.trim() === ''
    ? items
    : items.filter((item) => fuzzyMatch(query, item.label));

  const handleNavigate = useCallback((page: PageView) => {
    setCurrentPage(page);
    setOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, [setCurrentPage]);

  const handleOpen = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, []);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        handleOpen(!open);
      }
      // Ctrl+/ to navigate to help page
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        handleNavigate('help');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleOpen, handleNavigate]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredItems.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredItems.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleNavigate(filteredItems[selectedIndex].page);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden rounded-xl border border-border/50 shadow-2xl shadow-blue-500/5 bg-background/95 backdrop-blur-xl">
        <DialogTitle className="sr-only">Rechercher une page</DialogTitle>

        {/* Search input */}
        <div className="flex items-center border-b border-border/50 px-4">
          <Search className="w-4 h-4 shrink-0 text-muted-foreground/70" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher..."
            className="flex-1 h-12 bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/50 bg-muted/60 rounded border border-border/50">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          className="max-h-72 overflow-y-auto py-2"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'hsl(var(--border)) transparent',
          }}
        >
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/60">
              <Search className="w-8 h-8 mb-2" />
              <p className="text-sm">Aucun résultat trouvé</p>
              <p className="text-xs mt-1">Essayez un autre terme de recherche</p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isActive = index === selectedIndex;
              const isCurrent = currentPage === item.page;
              const Icon = item.icon;
              return (
                <button
                  key={item.page}
                  data-active={isActive}
                  onClick={() => handleNavigate(item.page)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`
                    flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm transition-all duration-100
                    ${isActive
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                      : 'text-foreground/80 hover:bg-muted/50'
                    }
                  `}
                >
                  <div className={`
                    flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-all duration-100
                    ${isActive
                      ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                      : 'bg-muted text-muted-foreground/60'
                    }
                  `}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="flex-1 truncate font-medium">{item.label}</span>
                  {isCurrent && (
                    <span className="text-[10px] font-medium text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
                      Page actuelle
                    </span>
                  )}
                  {isActive && (
                    <kbd className="text-[10px] font-mono text-blue-400/70 bg-blue-100/60 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                      ↵
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border/50 px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground/50">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 font-mono bg-muted rounded border border-border/50">↑</kbd>
            <kbd className="px-1 py-0.5 font-mono bg-muted rounded border border-border/50">↓</kbd>
            Naviguer
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 font-mono bg-muted rounded border border-border/50">↵</kbd>
            Ouvrir
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 font-mono bg-muted rounded border border-border/50">Esc</kbd>
            Fermer
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
