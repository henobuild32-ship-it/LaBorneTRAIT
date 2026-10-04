import { notificationEmitter } from './notificationEmitter';
import { NotificationPayload } from './notificationTypes';

/**
 * Emits a notification payload in real-time.
 * In a future phase, this can be updated to write to a Supabase Realtime channel
 * or trigger WebSockets, without modifying any calling code.
 */
export function emitNotification(notification: NotificationPayload) {
  notificationEmitter.emit('notification', notification);
}
