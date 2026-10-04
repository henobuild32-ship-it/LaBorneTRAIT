import webpush from 'web-push';
import { db } from '@/lib/db';

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const privateKey = process.env.VAPID_PRIVATE_KEY || '';

if (publicKey && privateKey) {
  webpush.setVapidDetails(
    'mailto:gradeupgradeup6@gmail.com',
    publicKey,
    privateKey
  );
} else {
  console.warn('[PushSender] Warning: VAPID security keys are not loaded inside environment variables.');
}

/**
 * Sends a background Web Push notification to all active devices of a given user.
 * Automatically handles cleaning up expired browser push subscriptions (returns 410/404).
 */
export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string; icon?: string; url?: string }
) {
  if (!publicKey || !privateKey) {
    console.warn('[PushSender] Skip push: VAPID public/private key pairs are not loaded.');
    return;
  }

  try {
    // 1. Fetch active push subscriptions for this profile
    const subscriptions = await db.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) return;

    // 2. Prepare payload JSON structure (parsed by sw.ts)
    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.png',
      data: {
        url: payload.url || '/',
      },
    });

    // 3. Dispatch to all devices in parallel
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          pushPayload
        );
      } catch (error: any) {
        // Prune database if the browser subscription is no longer valid (e.g. Chrome/iOS token expired)
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`[PushSender] Garbage-collecting expired token (${sub.id}) for user: ${userId}`);
          await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => { });
        } else {
          console.error('[PushSender] Error dispatching to browser device:', error);
        }
      }
    });

    await Promise.all(sendPromises);
  } catch (error) {
    console.error('[PushSender] Exception occurred during push notification run:', error);
  }
}
