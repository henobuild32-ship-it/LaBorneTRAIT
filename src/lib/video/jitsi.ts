'use client';

declare global {
  interface Window {
    JitsiMeetExternalAPI?: any;
  }
}

const JITSI_DOMAIN = 'meet.jit.si';
const SCRIPT_URL = 'https://meet.jit.si/external_api.js';

let scriptPromise: Promise<void> | null = null;

export function loadJitsiScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('jitsi-external-api');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.id = 'jitsi-external-api';
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Échec du chargement de Jitsi.'));
    document.body.appendChild(script);
  });

  return scriptPromise;
}

export interface JitsiMeetingOptions {
  roomName: string;
  parentNode: HTMLElement;
  displayName: string;
  avatarUrl?: string;
  configOverwrite?: Record<string, unknown>;
  interfaceConfigOverwrite?: Record<string, unknown>;
  onReady?: (api: any) => void;
  onLeave?: () => void;
}

export function createJitsiMeeting(options: JitsiMeetingOptions): any {
  if (!window.JitsiMeetExternalAPI) {
    throw new Error('Jitsi n\'est pas chargé.');
  }

  const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
    roomName: options.roomName,
    parentNode: options.parentNode,
    width: '100%',
    height: '100%',
    userInfo: {
      displayName: options.displayName,
      avatarUrl: options.avatarUrl,
    },
    configOverwrite: {
      startWithAudioMuted: false,
      startWithVideoMuted: false,
      prejoinPageEnabled: false,
      disableDeepLinking: true,
      ...options.configOverwrite,
    },
    interfaceConfigOverwrite: {
      MOBILE_APP_PROMO: false,
      SHOW_JITSI_WATERMARK: false,
      ...options.interfaceConfigOverwrite,
    },
  });

  api.addEventListener('videoConferenceJoined', () => options.onReady?.(api));
  api.addEventListener('readyToClose', () => options.onLeave?.());

  return api;
}

export function getJitsiRoomName(roomUrl: string): string {
  const parts = roomUrl.split('/');
  return parts[parts.length - 1] || roomUrl;
}
