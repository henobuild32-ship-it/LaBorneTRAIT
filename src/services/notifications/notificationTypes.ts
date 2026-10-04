export type NotificationType =
  | 'INFO'
  | 'SYSTEM'
  | 'CONFERENCE'
  | 'CARD'
  | 'GRADE'
  | 'CLASS'
  | 'MESSAGE'
  | 'PROFILE'
  | 'LESSON'
  | 'HOMEWORK'
  | 'HOMEWORK_SUBMISSION'
  | 'ATTENDANCE'
  | 'PAYMENT'
  | 'REPORT_CARD'
  | 'ANNOUNCEMENT';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface CreateNotificationInput {
  schoolId: string;
  userId?: string | null;
  senderId?: string;
  title?: string;
  message: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  metadata?: Record<string, any> | string;
  targetRole?: string;
  targetClassId?: string;
}

export interface NotificationPayload {
  id: string;
  schoolId: string;
  userId: string | null;
  senderId: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  read: boolean;
  metadata: string;
  targetRole: string;
  targetClassId: string;
  createdAt: Date | string;
}
