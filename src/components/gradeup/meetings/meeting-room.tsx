'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { VideoConferenceInfo, ParticipantInfo } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Lock,
  LockOpen,
  Hand,
  Circle,
  Check,
  X,
  ChevronLeft,
  UserPlus,
  Shield,
  Send,
  MessageCircle,
} from 'lucide-react';
import { loadJitsiScript, createJitsiMeeting, getJitsiRoomName } from '@/lib/video/jitsi';
import { subscribeToTable, isRealtimeEnabled, supabase } from '@/lib/realtime';

export default function MeetingRoom() {
  const { user, activeMeetingId, setActiveMeeting, setCurrentPage } = useAppStore();
  const [meeting, setMeeting] = useState<VideoConferenceInfo | null>(null);
  const [myStatus, setMyStatus] = useState<string>('loading');
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [recording, setRecording] = useState<{ start: number } | null>(null);

  // Live in-meeting chat (Supabase Realtime broadcast — WebSocket, ephemeral)
  const [chatOpen, setChatOpen] = useState(true);
  const [chatMessages, setChatMessages] = useState<
    { id: string; senderId: string; senderName: string; text: string; ts: number }[]
  >([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchMeeting = useCallback(async () => {
    if (!activeMeetingId || !user) return;
    try {
      const res = await fetch(`/api/meetings/${activeMeetingId}`);
      if (!res.ok) return;
      const data = await res.json();
      const m: VideoConferenceInfo = data.meeting;
      setMeeting(m);
      const me = m.participants?.find((p) => p.userId === user.id);
      if (me) {
        setMyStatus(me.status);
        setIsHost(me.role === 'HOST' || me.role === 'COHOST');
      } else {
        setMyStatus('none');
        setIsHost(false);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [activeMeetingId, user]);

  useEffect(() => {
    fetchMeeting();

    // Real-time participant presence via Supabase Realtime (replaces 5s polling).
    const unsubscribe = subscribeToTable({
      table: 'Participant',
      channelName: `realtime-participants-${activeMeetingId}`,
      onEvent: (payload: any) => {
        const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
        if (row && row.meetingId === activeMeetingId) {
          fetchMeeting();
        }
      },
    });

    // Fallback / safety net polling.
    const pollMs = isRealtimeEnabled() ? 15000 : 5000;
    const interval = setInterval(fetchMeeting, pollMs);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [fetchMeeting, activeMeetingId]);

  // Live meeting chat over a Supabase Realtime broadcast channel (no DB needed).
  useEffect(() => {
    if (!activeMeetingId || !user) return;
    const channelName = `meeting-chat-${activeMeetingId}`;
    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'chat' }, ({ payload }: any) => {
        setChatMessages((prev) => [...prev, payload]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeMeetingId, user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !activeMeetingId || !user || sendingChat) return;
    setSendingChat(true);
    try {
      const payload = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        senderId: user.id,
        senderName: user.fullName,
        text: chatInput.trim(),
        ts: Date.now(),
      };
      // Optimistic local render
      setChatMessages((prev) => [...prev, payload]);
      setChatInput('');
      const channel = supabase.channel(`meeting-chat-${activeMeetingId}`);
      await channel.send({ type: 'broadcast', event: 'chat', payload });
    } catch {
      toast.error('Impossible d\'envoyer le message.');
    } finally {
      setSendingChat(false);
    }
  };

  const join = useCallback(async () => {
    if (!activeMeetingId || !user || !meeting) return;
    try {
      const res = await fetch(`/api/meetings/${activeMeetingId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, fullName: user.fullName, userRole: user.role }),
      });
      const data = await res.json();
      if (res.ok) {
        setMyStatus(data.participant.status);
        if (data.participant.status === 'approved') {
          setJoined(true);
        } else {
          toast.info('Vous êtes dans la salle d\'attente. L\'organisateur va vous admettre.');
        }
      } else if (res.status === 423) {
        toast.error('La salle est verrouillée.');
      } else if (res.status === 410) {
        toast.error('La réunion est terminée.');
      }
    } catch {
      toast.error('Erreur de connexion.');
    }
  }, [activeMeetingId, user, meeting]);

  useEffect(() => {
    if (myStatus === 'approved' && !joined && meeting && containerRef.current) {
      let cancelled = false;
      loadJitsiScript()
        .then(() => {
          if (cancelled || !containerRef.current) return;
          const api = createJitsiMeeting({
            roomName: getJitsiRoomName(meeting.roomUrl),
            parentNode: containerRef.current,
            displayName: user?.fullName || 'Participant',
            avatarUrl: user?.photoUrl,
            onLeave: () => leaveMeeting(),
          });
          apiRef.current = api;
          setJoined(true);
        })
        .catch(() => toast.error('Impossible de charger la visioconférence.'));
      return () => {
        cancelled = true;
        apiRef.current?.dispose();
        apiRef.current = null;
      };
    }
  }, [myStatus, joined, meeting, user]);

  const leaveMeeting = useCallback(() => {
    apiRef.current?.dispose();
    apiRef.current = null;
    setJoined(false);
    setActiveMeeting(null);
    setCurrentPage('meetings');
  }, [setActiveMeeting, setCurrentPage]);

  const toggleMute = () => {
    apiRef.current?.executeCommand('toggleAudio');
    setMuted((m) => !m);
  };
  const toggleCam = () => {
    apiRef.current?.executeCommand('toggleVideo');
    setCamOff((c) => !c);
  };
  const toggleShare = () => apiRef.current?.executeCommand('toggleShareScreen');

  const hostAction = async (action: string, participantId: string) => {
    if (!activeMeetingId || !user) return;
    const res = await fetch(`/api/meetings/${activeMeetingId}/participants`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, participantId, hostUserId: user.id }),
    });
    if (res.ok) {
      toast.success('Mise à jour effectuée.');
      fetchMeeting();
    } else {
      toast.error('Action refusée.');
    }
  };

  const toggleLock = async () => {
    if (!activeMeetingId) return;
    const res = await fetch(`/api/meetings/${activeMeetingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isLocked: !meeting?.isLocked }),
    });
    if (res.ok) {
      setMeeting((m) => (m ? { ...m, isLocked: !m.isLocked } : m));
      toast.success(meeting?.isLocked ? 'Salle déverrouillée.' : 'Salle verrouillée.');
    }
  };

  const toggleRecording = async () => {
    if (!activeMeetingId || !user) return;
    if (recording) {
      const duration = Math.round((Date.now() - recording.start) / 1000);
      await fetch(`/api/meetings/${activeMeetingId}/recordings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ createdById: user.id, durationSeconds: duration }),
      });
      setRecording(null);
      toast.success('Enregistrement sauvegardé.');
      fetchMeeting();
    } else {
      setRecording({ start: Date.now() });
      toast.info('Enregistrement démarré (métadonnées).');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Chargement de la réunion…</div>;
  }

  if (!meeting) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Réunion introuvable.</p>
        <Button onClick={() => { setActiveMeeting(null); setCurrentPage('meetings'); }}>Retour</Button>
      </div>
    );
  }

  const pending = myStatus === 'pending' || (myStatus === 'none' && !joined);
  const rejected = myStatus === 'rejected' || myStatus === 'removed';

  if (rejected) {
    return (
      <div className="p-8 text-center">
        <X className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-xl font-semibold mb-2">Accès refusé</h2>
        <p className="text-muted-foreground mb-4">L'organisateur a refusé ou retiré votre accès.</p>
        <Button onClick={() => { setActiveMeeting(null); setCurrentPage('meetings'); }}>Retour</Button>
      </div>
    );
  }

  if (pending && !joined) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center min-h-[60vh]">
        <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-4 animate-pulse">
          <Video className="w-10 h-10 text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold">Salle d'attente</h2>
        <p className="text-muted-foreground mt-1 max-w-sm">
          Vous avez demandé à rejoindre <strong>{meeting.title}</strong>. L'organisateur va vous admettre sous peu.
        </p>
        <div className="flex gap-2 mt-6">
          <Button onClick={join} className="bg-blue-600 hover:bg-blue-700">
            <UserPlus className="w-4 h-4 mr-2" /> Demander à rejoindre
          </Button>
          <Button variant="outline" onClick={() => { setActiveMeeting(null); setCurrentPage('meetings'); }}>
            Annuler
          </Button>
        </div>
      </div>
    );
  }

  const waitingParticipants = meeting.participants?.filter((p) => p.status === 'pending') || [];
  const activeParticipants = meeting.participants?.filter((p) => p.status === 'approved') || [];

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] p-2 gap-2">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setCurrentPage('meetings')}>
            <ChevronLeft className="w-4 h-4" /> Retour
          </Button>
          <div>
            <h2 className="font-semibold leading-tight">{meeting.title}</h2>
            <p className="text-xs text-muted-foreground">
              {meeting.date} à {meeting.time}
              {meeting.isLocked && <Badge variant="destructive" className="ml-2">Verrouillée</Badge>}
              {recording && <Badge variant="destructive" className="ml-2 animate-pulse"><Circle className="w-2 h-2 mr-1 fill-current" />REC</Badge>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isHost && (
            <>
              <Button variant="outline" size="icon" onClick={toggleLock} title="Verrouiller/Déverrouiller">
                {meeting.isLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={toggleRecording} className={recording ? 'text-red-600' : ''}>
                <Circle className="w-3 h-3 mr-1" /> {recording ? 'Arrêter' : 'Enregistrer'}
              </Button>
            </>
          )}
          <Button variant="destructive" size="sm" onClick={leaveMeeting}>
            <PhoneOff className="w-4 h-4 mr-1" /> Quitter
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-2 min-h-0">
        <div className="flex-1 bg-black rounded-lg overflow-hidden relative min-h-0">
          <div ref={containerRef} className="w-full h-full" />
          {!joined && (
            <div className="absolute inset-0 flex items-center justify-center text-white/70">
              Connexion à la visioconférence…
            </div>
          )}
        </div>

        {isHost && (
          <Card className="w-72 shrink-0 hidden md:flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4" /> Gestion ({activeParticipants.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-3 text-sm">
              {waitingParticipants.length > 0 && (
                <div>
                  <p className="font-medium text-amber-600 mb-1">En attente ({waitingParticipants.length})</p>
                  {waitingParticipants.map((p: ParticipantInfo) => (
                    <div key={p.id} className="flex items-center justify-between gap-1 py-1">
                      <span className="truncate">{p.fullName}</span>
                      <div className="flex gap-1">
                        <Button size="icon" className="h-6 w-6" onClick={() => hostAction('approve', p.id)}>
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => hostAction('reject', p.id)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <p className="font-medium mb-1">Dans la réunion</p>
                {activeParticipants.map((p: ParticipantInfo) => (
                  <div key={p.id} className="flex items-center justify-between gap-1 py-1">
                    <span className="truncate">
                      {p.fullName}
                      {p.role === 'HOST' && <Badge className="ml-1 text-[10px]">Hôte</Badge>}
                      {p.role === 'COHOST' && <Badge variant="secondary" className="ml-1 text-[10px]">Co-hôte</Badge>}
                    </span>
                    <div className="flex gap-1">
                      {p.role !== 'HOST' && (
                        <Button size="icon" variant="ghost" className="h-6 w-6" title="Co-hôte" onClick={() => hostAction('promote', p.id)}>
                          <Shield className="w-3 h-3" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => hostAction('remove', p.id)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {joined && (
          <Card className="w-72 shrink-0 hidden lg:flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" /> Chat en direct
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setChatOpen((o) => !o)}
                >
                  {chatOpen ? 'Masquer' : 'Afficher'}
                </Button>
              </CardTitle>
            </CardHeader>
            {chatOpen && (
              <CardContent className="flex-1 flex flex-col min-h-0 gap-2">
                <ScrollArea className="flex-1 pr-2">
                  <div className="space-y-2">
                    {chatMessages.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Les messages apparaissent ici en temps réel.
                      </p>
                    )}
                    {chatMessages.map((m) => {
                      const mine = m.senderId === user?.id;
                      return (
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[85%] px-3 py-2 rounded-xl text-sm shadow-sm ${
                              mine
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-br-md'
                                : 'bg-muted text-foreground rounded-bl-md'
                            }`}
                          >
                            {!mine && (
                              <p className="text-[10px] font-semibold text-blue-600 mb-0.5 truncate">
                                {m.senderName}
                              </p>
                            )}
                            <p className="leading-relaxed break-words whitespace-pre-wrap">{m.text}</p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Message…"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendChatMessage();
                      }
                    }}
                    className="flex-1 h-9 text-sm"
                    disabled={sendingChat}
                  />
                  <Button
                    size="icon"
                    className="h-9 w-9 shrink-0 bg-gradient-to-r from-blue-600 to-blue-500 text-white"
                    onClick={sendChatMessage}
                    disabled={!chatInput.trim() || sendingChat}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        )}
      </div>

      {joined && (
        <div className="flex items-center justify-center gap-2 py-1">
          <Button variant={muted ? 'destructive' : 'outline'} size="icon" onClick={toggleMute}>
            {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          <Button variant={camOff ? 'destructive' : 'outline'} size="icon" onClick={toggleCam}>
            {camOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={toggleShare} title="Partager l'écran">
            <MonitorUp className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" title="Lever la main" onClick={() => apiRef.current?.executeCommand('raiseHand')}>
            <Hand className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
