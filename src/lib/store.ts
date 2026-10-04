import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserInfo, PageView, ChatMessage } from './types';

interface AppState {
  // Auth
  user: UserInfo | null;
  setUser: (user: UserInfo | null) => void;
  
  // Navigation
  currentPage: PageView;
  setCurrentPage: (page: PageView) => void;

  // Active meeting (Grada Vio)
  activeMeetingId: string | null;
  setActiveMeeting: (id: string | null) => void;

  // Session (JWT in HTTP-only cookie; user kept in memory only)
  hydrateSession: () => Promise<void>;
  logout: () => Promise<void>;
  
  // Chat
  chatMessages: Record<string, ChatMessage[]>;
  addChatMessage: (key: string, message: ChatMessage) => void;
  clearChatMessages: (key: string) => void;
  
  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Auth - do NOT override currentPage when setting user
      user: null,
      setUser: (user) => set({ user }),
      
      // Navigation
      currentPage: 'auth' as PageView,
      setCurrentPage: (currentPage) => set({ currentPage }),

      // Active meeting
      activeMeetingId: null,
      setActiveMeeting: (activeMeetingId) => set({ activeMeetingId }),

      // Session
      hydrateSession: async () => {
        const storedUser = useAppStore.getState().user;
        try {
          const res = await fetch('/api/auth/me', { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            if (data.user) {
              set({ user: data.user });
              // Restore user's last page instead of showing auth screen
              const stored = useAppStore.getState().currentPage;
              if (!stored || stored === 'auth') {
                const dashMap: Record<string, string> = {
                  ADMIN: 'admin-dashboard',
                  TEACHER: 'teacher-dashboard',
                  STUDENT: 'student-dashboard',
                  PARENT: 'parent-dashboard',
                };
                set({ currentPage: (dashMap[data.user.role] || 'admin-dashboard') as any });
              }
              return;
            }
          }
          const refreshed = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
          if (refreshed.ok) {
            const data = await refreshed.json();
            if (data.user) {
              set({ user: data.user });
              const stored = useAppStore.getState().currentPage;
              if (!stored || stored === 'auth') {
                const dashMap: Record<string, string> = {
                  ADMIN: 'admin-dashboard',
                  TEACHER: 'teacher-dashboard',
                  STUDENT: 'student-dashboard',
                  PARENT: 'parent-dashboard',
                };
                set({ currentPage: (dashMap[data.user.role] || 'admin-dashboard') as any });
              }
            }
          }
        } catch {
          // En mode hors ligne, conserver la dernière session locale et la
          // dernière page autorisée. La session sera revérifiée au retour réseau.
          if (typeof navigator !== 'undefined' && !navigator.onLine && storedUser) {
            set({ user: storedUser });
          }
        }
      },
      logout: async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
          /* ignore */
        }
        // Détacher l'external_id OneSignal au logout (empêche les push ciblés restaurs)
        try {
          if (typeof window !== 'undefined' && (window as any).OneSignal?.logout) {
            await (window as any).OneSignal.logout();
          }
        } catch {
          /* non bloquant */
        }
        set({ user: null, activeMeetingId: null, currentPage: 'auth' });
      },
      
      // Chat
      chatMessages: {},
      addChatMessage: (key, message) =>
        set((state) => ({
          chatMessages: {
            ...state.chatMessages,
            [key]: [...(state.chatMessages[key] || []), message],
          },
        })),
      clearChatMessages: (key) =>
        set((state) => ({
          chatMessages: { ...state.chatMessages, [key]: [] },
        })),
      
      // Sidebar
      sidebarOpen: true,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    {
      name: 'gradeup-storage',
      partialize: (state) => ({
        user: state.user,
        currentPage: state.currentPage,
        sidebarOpen: state.sidebarOpen,
        chatMessages: state.chatMessages,
      }),
    }
  )
);
