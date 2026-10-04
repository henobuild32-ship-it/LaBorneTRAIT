import { EventEmitter } from 'events';

class NotificationEmitter extends EventEmitter {}

// Support a global singleton in Next.js development (prevents duplicating emitters on hot-reload)
const globalForEmitter = global as unknown as {
  notificationEmitter: NotificationEmitter;
};

export const notificationEmitter =
  globalForEmitter.notificationEmitter || new NotificationEmitter();

if (process.env.NODE_ENV !== 'production') {
  globalForEmitter.notificationEmitter = notificationEmitter;
}
