import { supabase } from '@/lib/supabase';

export interface SubscribeParams {
  userId: string;
  role: string;
  schoolId: string;
  onNotification: (notification: any) => void;
}

/**
 * Subscribes the client frontend to real-time notifications.
 * Connects to Supabase Realtime channels for production instant notifications,
 * with a smart EventSource (SSE) fallback for local environments
 * where Supabase keys might not be configured.
 */
export function subscribeToNotifications({
  userId,
  role,
  schoolId,
  onNotification,
}: SubscribeParams): () => void {
  if (typeof window === 'undefined') return () => {};

  // Check if Supabase client environment variables are loaded
  const hasSupabase = 
    process.env.NEXT_PUBLIC_SUPABASE_URL && 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (hasSupabase) {
    console.log('[NotificationListener] Initializing native Supabase Realtime stream...');
    
    // Create a unique channel to isolate events for this subscriber session
    const channelName = `realtime-notifications-${schoolId}-${userId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Notification',
        },
        (payload) => {
          const newNotif = payload.new;
          
          // Multi-tenant check: ensure the notification belongs to this school
          if (newNotif.schoolId !== schoolId) return;

          // Client-side filtering check for matching role or targeted user ID
          const targetsThisUser = 
            newNotif.userId === userId || 
            newNotif.targetRole === 'ALL' || 
            newNotif.targetRole === role;

          if (targetsThisUser) {
            console.log('[NotificationListener] Real-time notification received via Supabase:', newNotif);
            
            // 1. Invoke local component callback
            onNotification(newNotif);

            // 2. Dispatch global custom event for live lists background reloading without refreshing
            const customEvent = new CustomEvent('gradeup-notification', { detail: newNotif });
            window.dispatchEvent(customEvent);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[NotificationListener] Successfully connected to Supabase channel: ${channelName}`);
        }
      });

    // Return cleanup/unsubscribe function
    return () => {
      supabase.removeChannel(channel);
      console.log(`[NotificationListener] Unsubscribed and closed Supabase channel: ${channelName}`);
    };
  } else {
    // FALLBACK: Use Server-Sent Events (SSE) stream
    console.log('[NotificationListener] Supabase credentials not found. Falling back to EventSource (SSE)...');
    
    const queryParams = new URLSearchParams({
      userId,
      role,
      schoolId,
    });

    const url = `/api/notifications/stream?${queryParams.toString()}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.heartbeat) return; // Keepalive ping, ignore

        // 1. Fire component callback
        onNotification(data);

        // 2. Broadcast custom event
        const customEvent = new CustomEvent('gradeup-notification', { detail: data });
        window.dispatchEvent(customEvent);
      } catch (error) {
        console.error('[NotificationListener] Error parsing SSE payload:', error);
      }
    };

    eventSource.onerror = () => {
      console.warn('[NotificationListener] SSE disconnected. Reconnecting automatically...');
    };

    return () => {
      eventSource.close();
      console.log('[NotificationListener] Closed SSE fallback stream.');
    };
  }
}
