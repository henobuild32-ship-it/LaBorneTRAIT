'use client';

import { useAppStore } from '@/lib/store';
import type { PageView } from '@/lib/types';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

import { installSessionAutoRefresh } from '@/lib/auth/auto-refresh';

// Renouvellement automatique de la session : installé au chargement du bundle,
// avant toute requête /api (voir src/lib/auth/auto-refresh.ts).
installSessionAutoRefresh();

import AuthPage from '@/components/gradeup/auth-page';
import AppLayout, { pageTitles } from '@/components/gradeup/app-layout';

// Squelette affiché pendant le chargement différé (code-splitting) d'une page.
function PageSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-muted" />
      <div className="h-4 w-72 rounded bg-muted/70" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted/60" />
        ))}
      </div>
    </div>
  );
}

// Chargement différé (lazy-loading) de chaque page : le bundle initial ne contient
// que l'authentification et le layout. Chaque page n'est téléchargée qu'à la navigation.
const AdminDashboard = dynamic(() => import('@/components/gradeup/admin-dashboard'), { ssr: false, loading: () => <PageSkeleton /> });
const AdminUsers = dynamic(() => import('@/components/gradeup/admin-users'), { ssr: false, loading: () => <PageSkeleton /> });
const AdminClasses = dynamic(() => import('@/components/gradeup/admin-classes'), { ssr: false, loading: () => <PageSkeleton /> });
const AdminPayments = dynamic(() => import('@/components/gradeup/admin-payments'), { ssr: false, loading: () => <PageSkeleton /> });
const AdminConfig = dynamic(() => import('@/components/gradeup/admin-config'), { ssr: false, loading: () => <PageSkeleton /> });
const AdminReports = dynamic(() => import('@/components/gradeup/admin-reports'), { ssr: false, loading: () => <PageSkeleton /> });
const AdminNotifications = dynamic(() => import('@/components/gradeup/admin-notifications'), { ssr: false, loading: () => <PageSkeleton /> });
const AdminConferences = dynamic(() => import('@/components/gradeup/admin-conferences'), { ssr: false, loading: () => <PageSkeleton /> });
const MeetingsHub = dynamic(() => import('@/components/gradeup/meetings/meetings-hub'), { ssr: false, loading: () => <PageSkeleton /> });
const MeetingRoom = dynamic(() => import('@/components/gradeup/meetings/meeting-room'), { ssr: false, loading: () => <PageSkeleton /> });
const LibraryHub = dynamic(() => import('@/components/gradeup/library/library-hub'), { ssr: false, loading: () => <PageSkeleton /> });
const AdminCards = dynamic(() => import('@/components/gradeup/admin-cards'), { ssr: false, loading: () => <PageSkeleton /> });
const AdminAi = dynamic(() => import('@/components/gradeup/admin-ai'), { ssr: false, loading: () => <PageSkeleton /> });
const TuitionTracking = dynamic(() => import('@/components/gradeup/tuition-tracking'), { ssr: false, loading: () => <PageSkeleton /> });
const EndOfYear = dynamic(() => import('@/components/gradeup/end-of-year'), { ssr: false, loading: () => <PageSkeleton /> });
const TeacherReports = dynamic(() => import('@/components/gradeup/teacher-reports'), { ssr: false, loading: () => <PageSkeleton /> });
const AdminCourses = dynamic(() => import('@/components/gradeup/admin-courses'), { ssr: false, loading: () => <PageSkeleton /> });
const AdminPresence = dynamic(() => import('@/components/gradeup/admin-presence'), { ssr: false, loading: () => <PageSkeleton /> });
const AdminSchedules = dynamic(() => import('@/components/gradeup/admin-schedules'), { ssr: false, loading: () => <PageSkeleton /> });
const AutoReportSyncPanel = dynamic(() => import('@/components/gradeup/auto-report-sync-panel'), { ssr: false, loading: () => <PageSkeleton /> });
const AdminSchoolCalendar = dynamic(() => import('@/components/gradeup/admin-school-calendar'), { ssr: false, loading: () => <PageSkeleton /> });
const AdminCoefficients = dynamic(() => import('@/components/gradeup/admin-coefficients'), { ssr: false, loading: () => <PageSkeleton /> });
const AdminPassages = dynamic(() => import('@/components/gradeup/admin-passages'), { ssr: false, loading: () => <PageSkeleton /> });
const CahierCotation = dynamic(() => import('@/components/gradeup/cahier-cotation'), { ssr: false, loading: () => <PageSkeleton /> });
const TeacherDashboard = dynamic(() => import('@/components/gradeup/teacher-dashboard'), { ssr: false, loading: () => <PageSkeleton /> });
const TeacherCourses = dynamic(() => import('@/components/gradeup/teacher-courses'), { ssr: false, loading: () => <PageSkeleton /> });
const TeacherClasses = dynamic(() => import('@/components/gradeup/teacher-classes'), { ssr: false, loading: () => <PageSkeleton /> });
const TeacherLessons = dynamic(() => import('@/components/gradeup/teacher-lessons'), { ssr: false, loading: () => <PageSkeleton /> });
const TeacherGrades = dynamic(() => import('@/components/gradeup/teacher-grades'), { ssr: false, loading: () => <PageSkeleton /> });
const TeacherHomework = dynamic(() => import('@/components/gradeup/teacher-homework'), { ssr: false, loading: () => <PageSkeleton /> });
const TeacherDocuments = dynamic(() => import('@/components/gradeup/teacher-documents'), { ssr: false, loading: () => <PageSkeleton /> });
const TeacherAttendance = dynamic(() => import('@/components/gradeup/teacher-attendance'), { ssr: false, loading: () => <PageSkeleton /> });
const TeacherSchedules = dynamic(() => import('@/components/gradeup/schedules-page'), { ssr: false, loading: () => <PageSkeleton /> });
const TeacherAI = dynamic(() => import('@/components/gradeup/teacher-ai'), { ssr: false, loading: () => <PageSkeleton /> });
const TeacherNotifications = dynamic(() => import('@/components/gradeup/teacher-notifications'), { ssr: false, loading: () => <PageSkeleton /> });
const StudentDashboard = dynamic(() => import('@/components/gradeup/student-dashboard'), { ssr: false, loading: () => <PageSkeleton /> });
const StudentCourses = dynamic(() => import('@/components/gradeup/student-courses'), { ssr: false, loading: () => <PageSkeleton /> });
const StudentLessons = dynamic(() => import('@/components/gradeup/student-lessons'), { ssr: false, loading: () => <PageSkeleton /> });
const StudentGrades = dynamic(() => import('@/components/gradeup/student-grades'), { ssr: false, loading: () => <PageSkeleton /> });
const StudentBulletins = dynamic(() => import('@/components/gradeup/student-bulletins'), { ssr: false, loading: () => <PageSkeleton /> });
const StudentAttendance = dynamic(() => import('@/components/gradeup/student-attendance'), { ssr: false, loading: () => <PageSkeleton /> });
const StudentAI = dynamic(() => import('@/components/gradeup/student-ai'), { ssr: false, loading: () => <PageSkeleton /> });
const StudentSchedules = dynamic(() => import('@/components/gradeup/schedules-page'), { ssr: false, loading: () => <PageSkeleton /> });
const StudentHomework = dynamic(() => import('@/components/gradeup/student-homework'), { ssr: false, loading: () => <PageSkeleton /> });
const StudentNotifications = dynamic(() => import('@/components/gradeup/student-notifications'), { ssr: false, loading: () => <PageSkeleton /> });
const ParentDashboard = dynamic(() => import('@/components/gradeup/parent-dashboard'), { ssr: false, loading: () => <PageSkeleton /> });
const ParentGrades = dynamic(() => import('@/components/gradeup/parent-grades'), { ssr: false, loading: () => <PageSkeleton /> });
const ParentBulletins = dynamic(() => import('@/components/gradeup/parent-bulletins'), { ssr: false, loading: () => <PageSkeleton /> });
const ParentPayments = dynamic(() => import('@/components/gradeup/parent-payments'), { ssr: false, loading: () => <PageSkeleton /> });
const ParentNotifications = dynamic(() => import('@/components/gradeup/parent-notifications'), { ssr: false, loading: () => <PageSkeleton /> });
const ParentAI = dynamic(() => import('@/components/gradeup/parent-ai'), { ssr: false, loading: () => <PageSkeleton /> });
const ProfilePage = dynamic(() => import('@/components/gradeup/profile-page'), { ssr: false, loading: () => <PageSkeleton /> });
const MessageCenter = dynamic(() => import('@/components/gradeup/message-center'), { ssr: false, loading: () => <PageSkeleton /> });
const ChatPage = dynamic(() => import('@/components/gradeup/chat-page'), { ssr: false, loading: () => <PageSkeleton /> });
const SchoolCalendar = dynamic(() => import('@/components/gradeup/school-calendar'), { ssr: false, loading: () => <PageSkeleton /> });
const HelpPage = dynamic(() => import('@/components/gradeup/help-page'), { ssr: false, loading: () => <PageSkeleton /> });
const AnnouncementsPage = dynamic(() => import('@/components/gradeup/announcements'), { ssr: false, loading: () => <PageSkeleton /> });
const AdminHomework = dynamic(() => import('@/components/gradeup/admin-homework'), { ssr: false, loading: () => <PageSkeleton /> });

function PageRouter({ page }: { page: PageView }) {
  const { user } = useAppStore();

  // Navigation is not an authorization boundary, but never render a role-specific
  // screen when a stale client state points at another user's module.
  if (user) {
    const prefix = user.role === 'ADMIN' ? 'admin-' : user.role === 'TEACHER' ? 'teacher-' : user.role === 'STUDENT' ? 'student-' : 'parent-';
    const shared = new Set<PageView>(['meetings', 'meeting-room', 'library', 'messages', 'calendar', 'profile', 'help', 'announcements']);
    const roleShared = (user.role === 'ADMIN' || user.role === 'TEACHER') && new Set<PageView>(['cahier-cotation', 'auto-report-sync']).has(page);
    const allowed = page === 'auth' || page === 'register' || shared.has(page) || roleShared || page === `${prefix}dashboard` || page.startsWith(prefix);
    if (!allowed) return <AuthPage />;
  }

  if (page === 'student-payments') {
    return <StudentDashboard />;
  }

  if (page === 'auth' || page === 'register') return <AuthPage />;
  if (page === 'admin-dashboard') return <AdminDashboard />;
  if (page === 'admin-users') return <AdminUsers />;
  if (page === 'admin-classes') return <AdminClasses />;
  if (page === 'admin-payments') return <AdminPayments />;
  if (page === 'admin-config') return <AdminConfig />;
  if (page === 'admin-reports') return <AdminReports />;
  if (page === 'admin-notifications') return <AdminNotifications />;
  if (page === 'admin-conferences') return <AdminConferences />;
  if (page === 'meetings') return <MeetingsHub />;
  if (page === 'meeting-room') return <MeetingRoom />;
  if (page === 'library') return <LibraryHub />;
  if (page === 'admin-cards') return <AdminCards />;
  if (page === 'admin-courses') return <AdminCourses />;
  if (page === 'admin-homework') return <AdminHomework />;
  if (page === 'admin-presence') return <AdminPresence />;
  if (page === 'admin-schedules') return <AdminSchedules />;
  if (page === 'admin-school-calendar') return <AdminSchoolCalendar />;
  if (page === 'admin-coefficients') return <AdminCoefficients />;
  if (page === 'admin-passages') return <AdminPassages />;
  if (page === 'auto-report-sync') return <AutoReportSyncPanel />;
  if (page === 'cahier-cotation') return <CahierCotation />;
  if (page === 'admin-tuition') return <TuitionTracking />;
  if (page === 'admin-end-of-year') return <EndOfYear />;
  if (page === 'admin-ai') return <AdminAi />;
  if (page === 'teacher-dashboard') return <TeacherDashboard />;
  if (page === 'teacher-reports') return <TeacherReports />;
  if (page === 'teacher-courses') return <TeacherCourses />;
  if (page === 'teacher-classes') return <TeacherClasses />;
  if (page === 'teacher-lessons') return <TeacherLessons />;
  if (page === 'teacher-grades') return <TeacherGrades />;
  if (page === 'teacher-homework') return <TeacherHomework />;
  if (page === 'teacher-documents') return <TeacherDocuments />;
  if (page === 'teacher-attendance') return <TeacherAttendance />;
  if (page === 'teacher-schedules') return <TeacherSchedules />;
  if (page === 'teacher-ai') return <TeacherAI />;
  if (page === 'teacher-notifications') return <TeacherNotifications />;
  if (page === 'teacher-end-of-year') return <EndOfYear />;
  if (page === 'student-dashboard') return <StudentDashboard />;
  if (page === 'student-courses') return <StudentCourses />;
  if (page === 'student-lessons') return <StudentLessons />;
  if (page === 'student-grades') return <StudentGrades />;
  if (page === 'student-bulletins') return <StudentBulletins />;
  if (page === 'student-attendance') return <StudentAttendance />;
  if (page === 'student-schedules') return <StudentSchedules />;
  if (page === 'student-ai') return <StudentAI />;
  if (page === 'student-homework') return <StudentHomework />;
  if (page === 'student-notifications') return <StudentNotifications />;
  if (page === 'parent-dashboard') return <ParentDashboard />;
  if (page === 'parent-grades') return <ParentGrades />;
  if (page === 'parent-bulletins') return <ParentBulletins />;
  if (page === 'parent-payments') return <ParentPayments />;
  if (page === 'parent-notifications') return <ParentNotifications />;
  if (page === 'parent-ai') return <ParentAI />;
  if (page === 'profile') return <ProfilePage />;
  if (page === 'messages') return <ChatPage />;
  if (page === 'calendar') return <SchoolCalendar />;
  if (page === 'help') return <HelpPage />;
  if (page === 'announcements') return <AnnouncementsPage />;
  return <AuthPage />;
}

export default function HomePage() {
  const { currentPage, user, setCurrentPage, hydrateSession } = useAppStore();
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    hydrateSession().finally(() => setHydrating(false));
  }, [hydrateSession]);

  // Deep links reçus au clic d'une notification push (`/?page=...`).
  useEffect(() => {
    if (hydrating || !user) return;
    const param = new URLSearchParams(window.location.search).get('page');
    if (!param || param === 'auth' || param === 'register') return;

    const prefix = user.role === 'ADMIN' ? 'admin-' : user.role === 'TEACHER' ? 'teacher-' : user.role === 'STUDENT' ? 'student-' : 'parent-';
    const aliases: Record<string, string[]> = { bulletins: ['admin-reports', 'teacher-reports'] };
    const candidates = [param, `${prefix}${param}`, ...(aliases[param] || [])];
    const target = candidates.find((candidate) => candidate in pageTitles);

    if (target) setCurrentPage(target as PageView);
    window.history.replaceState({}, '', window.location.pathname);
  }, [hydrating, user, setCurrentPage]);

  // Reset unauthorized pages for student users after session restoration
  useEffect(() => {
    if (user?.role === 'STUDENT' && currentPage === 'student-payments') {
      setCurrentPage('student-dashboard');
    }
  }, [user, currentPage, setCurrentPage]);

  // Show nothing while hydrating to prevent auth page flash
  if (hydrating) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <img src="/trait-logo.png" alt="LaBorneTRAIT" className="w-12 h-12 rounded-xl object-contain" />
          <div className="h-2 w-24 rounded-full bg-muted" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <AppLayout>
      <PageRouter page={currentPage} />
    </AppLayout>
  );
}

