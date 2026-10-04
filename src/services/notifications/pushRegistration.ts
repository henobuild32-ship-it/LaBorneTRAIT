function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerPushNotifications(userId: string) {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return;
  }

  try {
    const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicVapidKey) return;

    let registration: ServiceWorkerRegistration;
    try {
      registration = await navigator.serviceWorker.ready;
    } catch {
      return;
    }

    let permission: NotificationPermission;
    try {
      permission = await Notification.requestPermission();
    } catch {
      return;
    }
    if (permission !== 'granted') {
      return;
    }

    const convertedKey = urlBase64ToUint8Array(publicVapidKey);
    const subscribeOptions = {
      userVisibleOnly: true,
      applicationServerKey: convertedKey,
    };

    let subscription: PushSubscription | null = null;
    try {
      subscription = await registration.pushManager.getSubscription();
    } catch {
      return;
    }

    if (!subscription) {
      try {
        subscription = await registration.pushManager.subscribe(subscribeOptions);
      } catch {
        return;
      }
    }

    // Toujours envoyer la subscription au backend (même si elle existe déjà)
    // pour garantir qu'elle est à jour et active
    try {
      const response = await fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          subscription,
        }),
      });

      if (!response.ok) return;
    } catch {
      return;
    }
  } catch {
    // Catch-all
  }
}
