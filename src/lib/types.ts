export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';
export type PaymentStatus = 'paid' | 'pending' | 'overdue';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'justified';
export type ClassLevel = 'Maternelle' | 'Primaire' | 'Secondaire';

export interface SchoolInfo {
  id: string;
  name: string;
  email: string;
  currency: string;
  logoUrl?: string;
  inviteCode?: string;
  subscriptionStatus?: string;
  subscriptionExpiry?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  color?: string;
  academicYear?: string;
}

export interface UserInfo {
  id: string;
  schoolId: string;
  fullName: string;
  email: string;
  role: UserRole;
  photoUrl: string;
  parentId?: string;
  parentCode?: string;
  phone?: string;
  parentPhone?: string;
  parentPhone2?: string;
  cardId?: string;
  postName?: string;
  gender?: string;
  birthDate?: string;
  matricule?: string;
  academicYear?: string;
  section?: string;
  active?: boolean;
  isTitulaire?: boolean;
  titulaireClassIds?: string[];
  school?: SchoolInfo;
  classEnrollments?: EnrolledClassInfo[];
  children?: UserInfo[];
}

export interface EnrolledClassInfo {
  id: string;
  userId: string;
  classId: string;
  class: ClassInfo;
}

export interface ClassInfo {
  id: string;
  schoolId: string;
  name: string;
  level: string;
  fees: number;
  _count?: {
    enrollments: number;
    courses: number;
  };
}

export interface CourseInfo {
  id: string;
  schoolId: string;
  classId: string;
  teacherId: string;
  name: string;
  description: string;
  status?: string;
  coefficient?: number;
  class?: ClassInfo;
  teacher?: UserInfo;
  _count?: {
    lessons: number;
    grades: number;
    homework: number;
  };
}

export interface LessonInfo {
  id: string;
  schoolId: string;
  courseId: string;
  teacherId: string;
  title: string;
  content: string;
  fileUrl: string;
  fileName: string;
  createdAt: string;
  course?: CourseInfo;
  teacher?: UserInfo;
}

export interface GradeInfo {
  id: string;
  schoolId: string;
  courseId: string;
  studentId: string;
  teacherId: string;
  score: number;
  maxScore: number;
  trimester: string;
  status?: 'DRAFT' | 'SUBMITTED' | 'VALIDATED' | string;
  evaluationDate?: string;
  month?: number | null;
  week?: number | null;
  comment: string;
  createdAt: string;
  course?: CourseInfo;
  student?: UserInfo;
  teacher?: UserInfo;
  effectiveCoefficient?: number;
}

export interface HomeworkInfo {
  id: string;
  schoolId: string;
  courseId: string;
  teacherId: string;
  title: string;
  description: string;
  dueDate: string;
  gradingType: string;
  fileUrl: string;
  fileName: string;
  createdAt: string;
  course?: CourseInfo;
  teacher?: UserInfo;
}

export interface AttendanceInfo {
  id: string;
  schoolId: string;
  studentId: string;
  teacherId: string;
  courseId: string;
  date: string;
  status: AttendanceStatus;
  reason: string;
  student?: UserInfo;
}

export interface SubmissionInfo {
  id: string;
  homeworkId: string;
  studentId: string;
  schoolId: string;
  fileUrl: string;
  fileName: string;
  content: string;
  submittedAt: string;
  score: number | null;
  maxScore: number | null;
  gradedAt: string | null;
  gradedBy: string | null;
  status: string;
  student?: UserInfo;
  homework?: HomeworkInfo;
}

export interface PaymentInfo {
  id: string;
  schoolId: string;
  studentId: string;
  amount: number;
  status: PaymentStatus;
  month: string;
  method: string;
  createdAt: string;
  student?: UserInfo;
}

export interface NotificationInfo {
  id: string;
  schoolId: string;
  senderId: string;
  targetRole: string;
  targetClassId: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface VideoConferenceInfo {
  id: string;
  schoolId: string;
  title: string;
  description: string;
  date: string;
  time: string;
  roomUrl: string;
  targetRole: string;
  targetClassId: string;
  type: string;
  status: string;
  isLocked: boolean;
  creatorId: string;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt: string;
  participants?: ParticipantInfo[];
  recordings?: RecordingInfo[];
}

export interface ParticipantInfo {
  id: string;
  meetingId: string;
  schoolId: string;
  userId: string;
  fullName: string;
  role: string; // HOST | COHOST | PARTICIPANT
  status: string; // pending | approved | rejected | removed
  isCoHost: boolean;
  joinedAt?: string | null;
  leftAt?: string | null;
  createdAt: string;
}

export interface RecordingInfo {
  id: string;
  meetingId: string;
  schoolId: string;
  createdById: string;
  url: string;
  note: string;
  durationSeconds: number;
  createdAt: string;
}

export interface RessourceInfo {
  id: string;
  schoolId: string;
  title: string;
  description: string;
  category: string;
  matiere: string;
  niveau: string;
  author: string;
  url: string;
  fileUrl: string;
  type: string; // LIEN | PDF | VIDEO | FICHIER
  visibility: string; // PUBLIC | ROLE | CLASS
  targetRole: string;
  targetClassId: string;
  createdById: string;
  createdAt: string;
  isFavorite?: boolean;
  isPublished?: boolean;
}

export interface TeacherDocumentVersionInfo {
  id: string;
  updatedAt: string;
  summary: string;
  content: string;
  fileUrl: string;
  fileName: string;
}

export interface TeacherDocumentInfo {
  id: string;
  schoolId: string;
  teacherId: string;
  title: string;
  description: string;
  category: string;
  subject: string;
  level: string;
  period: string;
  content: string;
  fileUrl: string;
  fileName: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  versions: TeacherDocumentVersionInfo[];
}

export interface FavoriteInfo {
  id: string;
  userId: string;
  ressourceId: string;
  createdAt: string;
}

export type PageView = 
  | 'auth'
  | 'register'
  | 'admin-dashboard'
  | 'admin-users'
  | 'admin-classes'
  | 'admin-payments'
  | 'admin-config'
  | 'admin-reports'
  | 'admin-notifications'
  | 'admin-conferences'
  | 'meetings'
  | 'meeting-room'
  | 'library'
  | 'admin-cards'
  | 'admin-courses'
  | 'admin-homework'
  | 'admin-ai'
  | 'admin-tuition'
  | 'admin-end-of-year'
  | 'teacher-reports'
  | 'teacher-end-of-year'
  | 'teacher-dashboard'
  | 'teacher-courses'
  | 'teacher-classes'
  | 'teacher-lessons'
  | 'teacher-grades'
  | 'teacher-homework'
  | 'teacher-documents'
  | 'teacher-attendance'
  | 'teacher-schedules'
  | 'teacher-ai'
  | 'teacher-notifications'
  | 'student-dashboard'
  | 'student-courses'
  | 'student-lessons'
  | 'student-grades'
  | 'student-bulletins'
  | 'student-attendance'
  | 'student-schedules'
  | 'student-ai'
  | 'student-homework'
  | 'student-notifications'
  | 'student-payments'
  | 'parent-dashboard'
  | 'parent-grades'
  | 'parent-bulletins'
  | 'parent-payments'
  | 'parent-notifications'
  | 'parent-ai'
  | 'admin-presence'
  | 'admin-schedules'
  | 'admin-school-calendar'
  | 'admin-coefficients'
  | 'admin-passages'
  | 'admin-grade-validation'
  | 'auto-report-sync'
  | 'cahier-cotation'
  | 'admin-cotation-rules'
  | 'profile'
  | 'messages'
  | 'calendar'
  | 'announcements'
  | 'help';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface MessageInfo {
  id: string;
  schoolId: string;
  senderId: string;
  recipientId: string;
  content: string;
  messageType: string;
  attachmentUrl: string;
  attachmentName: string;
  attachmentType: string;
  replyToId: string | null;
  editedAt: string | null;
  read: boolean;
  createdAt: string;
  sender?: { id: string; fullName: string; role: string; photoUrl?: string };
  recipient?: { id: string; fullName: string; role: string; photoUrl?: string };
  replyTo?: MessageInfo;
}

export interface ConversationInfo {
  partnerId: string;
  partnerName: string;
  partnerRole: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}
