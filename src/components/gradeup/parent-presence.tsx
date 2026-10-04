'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, CheckCircle2, XCircle, Clock, RefreshCw, Navigation } from 'lucide-react';

interface PresenceRecord {
  id: string;
  statut: string;
  date: string;
  heureArrivee: string;
  justification?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  user?: {
    fullName: string;
    photoUrl?: string;
  };
}

interface ChildInfo {
  id: string;
  fullName: string;
  photoUrl: string;
}

export default function ParentPresence() {
  const { user } = useAppStore();
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [presences, setPresences] = useState<Record<string, PresenceRecord | null>>({});
  const [loading, setLoading] = useState(true);
  const [selectedMapChildId, setSelectedMapChildId] = useState<string | null>(null);
  const schoolId = user?.schoolId || '';
  const userId = user?.id || '';

  const fetchChildren = useCallback(async () => {
    if (!userId || !schoolId) return;
    try {
      const res = await fetch(`/api/users?schoolId=${schoolId}&role=STUDENT&parentId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.users) ? data.users : [];
        setChildren(list);
        return list;
      }
    } catch { /* silent */ }
    return [];
  }, [userId, schoolId]);

  const fetchPresence = useCallback(async (childId: string) => {
    try {
      const res = await fetch(`/api/presence/aujourdhui?schoolId=${schoolId}&userId=${childId}`);
      if (res.ok) {
        const data = await res.json();
        return data.presence || null;
      }
    } catch { /* silent */ }
    return null;
  }, [schoolId]);

  const [liveLocations, setLiveLocations] = useState<Record<string, { latitude: number; longitude: number; updatedAt: string } | null>>({});

  const fetchLiveLocation = useCallback(async (childId: string) => {
    try {
      const res = await fetch(`/api/location?userId=${childId}`);
      if (res.ok) {
        const data = await res.json();
        return data.location || null;
      }
    } catch { /* silent */ }
    return null;
  }, []);

  const fetchAllPresences = useCallback(async () => {
    setLoading(true);
    const childList = await fetchChildren();
    const results: Record<string, PresenceRecord | null> = {};
    const locResults: Record<string, { latitude: number; longitude: number; updatedAt: string } | null> = {};
    for (const child of childList) {
      results[child.id] = await fetchPresence(child.id);
      locResults[child.id] = await fetchLiveLocation(child.id);
    }
    setPresences(results);
    setLiveLocations(locResults);
    setLoading(false);
  }, [fetchChildren, fetchPresence, fetchLiveLocation]);

  useEffect(() => {
    let active = true;
    const loadPresences = async () => {
      if (!active) return;
      await fetchAllPresences();
    };

    loadPresences();
    const interval = setInterval(loadPresences, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [fetchAllPresences]);

  const getStatusIcon = (statut: string) => {
    switch (statut) {
      case 'PRESENT': return <CheckCircle2 className="size-5 text-emerald-500" />;
      case 'RETARD': return <Clock className="size-5 text-amber-500" />;
      case 'JUSTIFIE': return <Navigation className="size-5 text-blue-500" />;
      default: return <XCircle className="size-5 text-red-500" />;
    }
  };

  const getStatusBadge = (statut: string) => {
    switch (statut) {
      case 'PRESENT': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Présent</Badge>;
      case 'RETARD': return <Badge className="bg-amber-100 text-amber-700 border-amber-200">En retard</Badge>;
      case 'JUSTIFIE': return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Justifié</Badge>;
      default: return <Badge className="bg-red-100 text-red-700 border-red-200">Absent</Badge>;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  if (!user) return null;

  const schoolCoords = user?.school?.latitude && user?.school?.longitude
    ? { lat: user.school.latitude, lng: user.school.longitude }
    : null;

  const mapChildId = selectedMapChildId && liveLocations[selectedMapChildId] ? selectedMapChildId : children.find(c => liveLocations[c.id])?.id || null;
  const liveLoc = mapChildId ? liveLocations[mapChildId] : null;
  const mapChildName = mapChildId ? children.find(c => c.id === mapChildId)?.fullName || "l'enfant" : null;
  const mapLat = liveLoc?.latitude || schoolCoords?.lat || 0;
  const mapLng = liveLoc?.longitude || schoolCoords?.lng || 0;
  const showMap = !!(schoolCoords || liveLoc);
  const mapPadding = 0.005;
  const mapSrc = showMap
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${mapLng - mapPadding}%2C${mapLat - mapPadding}%2C${mapLng + mapPadding}%2C${mapLat + mapPadding}&layer=mapnik&marker=${mapLat}%2C${mapLng}`
    : null;

  return (
    <Card className="shadow-sm border border-border">
      <CardContent className="pt-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="size-5 text-blue-600" />
            <h2 className="text-base font-bold">Présence en temps réel</h2>
          </div>
          <button
            onClick={fetchAllPresences}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>

        {loading && children.length === 0 ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : children.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucun enfant lié à votre compte.
          </p>
        ) : (
          <div className="space-y-3">
            {children.map((child) => {
              const presence = presences[child.id];
              return (
                <div
                  key={child.id}
                  className={'flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all hover:shadow-sm ' + (mapChildId === child.id ? 'bg-blue-50 border-blue-200' : 'bg-muted/10 border-border/50')}
                  onClick={() => setSelectedMapChildId(mapChildId === child.id ? null : child.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-bold text-foreground">
                      {child.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{child.fullName}</p>
                      {presence ? (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Arrivée : {formatTime(presence.heureArrivee)}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Pas encore arrivé
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {presence ? (
                      <>
                        {getStatusIcon(presence.statut)}
                        {getStatusBadge(presence.statut)}
                      </>
                    ) : (
                      <>
                        <XCircle className="size-5 text-red-500" />
                        <Badge className="bg-red-100 text-red-700 border-red-200">Absent</Badge>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Carte de localisation en temps réel */}
        {mapSrc ? (
          <div className="rounded-xl overflow-hidden border border-border/50">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/20 text-xs text-muted-foreground">
              <MapPin className="size-3.5 text-blue-500" />
              {liveLoc
                ? `Position de ${mapChildName || "l'enfant"} (GPS en temps réel)`
                : `Localisation de l'école : ${user.school?.name || ''}`
              }
            </div>
            <iframe
              title="Localisation en temps réel"
              src={mapSrc}
              width="100%"
              height="250"
              className="border-0 w-full"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            {liveLoc && (
              <div className="flex items-center justify-between px-3 py-2 bg-emerald-50/50 text-xs text-muted-foreground border-t border-border/50">
                <span className="flex items-center gap-1">
                  <Navigation className="size-3 text-emerald-500" />
                  Dernière position mise à jour
                </span>
                <span className="font-mono text-emerald-600">
                  {new Date(liveLoc.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-muted/10 border border-dashed border-muted p-6 text-center">
            <Navigation className="size-6 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              Coordonnées non disponibles. L&apos;élève n&apos;a pas encore partagé sa position.
            </p>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/50 text-center">
          Mise à jour automatique toutes les 30 secondes
        </p>
      </CardContent>
    </Card>
  );
}
