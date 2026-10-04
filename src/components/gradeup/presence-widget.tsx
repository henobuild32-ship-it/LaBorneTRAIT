'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle2,
  Clock,
  MapPin,
  AlertTriangle,
  Loader2,
  Navigation,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';

interface PresenceWidgetProps {
  compact?: boolean;
}

interface PresenceState {
  alreadyMarked: boolean;
  statut?: 'PRESENT' | 'RETARD' | 'JUSTIFIE';
  heureArrivee?: string;
}

export default function PresenceWidget({ compact = false }: PresenceWidgetProps) {
  const user = useAppStore((s) => s.user);
  const [state, setState] = useState<PresenceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [justification, setJustification] = useState('');
  const [showJustif, setShowJustif] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Check if already marked today
  const checkToday = useCallback(async () => {
    if (!user?.id || !user?.schoolId) return;
    try {
      const res = await fetch(`/api/presence/aujourdhui?schoolId=${user.schoolId}&userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.presence) {
          setState({
            alreadyMarked: true,
            statut: data.presence.statut,
            heureArrivee: data.presence.heureArrivee,
          });
        } else {
          setState({ alreadyMarked: false });
        }
      }
    } catch {
      setState({ alreadyMarked: false });
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.schoolId]);

  useEffect(() => {
    checkToday();
  }, [checkToday]);

  // Get geolocation in real-time
  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Géolocalisation non supportée par ce navigateur');
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast.success(`📍 Position obtenue (précision ±${Math.round(pos.coords.accuracy)}m)`);
      },
      (err) => {
        setLocating(false);
        switch (err.code) {
          case 1:
            setGeoError('Permission refusée. Autorisez la géolocalisation dans votre navigateur.');
            break;
          case 2:
            setGeoError('Position introuvable. Vérifiez votre connexion GPS/réseau.');
            break;
          case 3:
            setGeoError('Délai dépassé. Réessayez.');
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  const markPresence = async () => {
    if (!user?.id || !user?.schoolId) return;
    setMarking(true);
    try {
      const body: Record<string, unknown> = {
        userId: user.id,
        schoolId: user.schoolId,
      };
      if (coords) {
        body.latitude = coords.lat;
        body.longitude = coords.lng;
      }
      if (justification.trim()) {
        body.justification = justification.trim();
      }

      const res = await fetch('/api/presence/marquer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || 'Présence enregistrée !');
        setState({ alreadyMarked: true, statut: data.statut, heureArrivee: new Date().toISOString() });
      } else if (res.status === 409) {
        toast.info('Présence déjà marquée aujourd\'hui');
        setState({ alreadyMarked: true, statut: data.statut, heureArrivee: data.heureArrivee });
      } else if (res.status === 422) {
        toast.error(data.message || 'Hors périmètre de l\'école');
        setGeoError(data.message);
      } else {
        toast.error(data.error || 'Erreur lors du pointage');
      }
    } catch {
      toast.error('Erreur réseau. Réessayez.');
    } finally {
      setMarking(false);
    }
  };

  const isBefore8 = currentTime.getHours() < 8;
  const isAfter8 = !isBefore8;

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="h-24 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Already marked — show confirmation
  if (state?.alreadyMarked) {
    const statusMap = {
      PRESENT: { color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2, label: 'Présent(e) — À l\'heure ✅' },
      RETARD: { color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: Clock, label: 'Présent(e) — En retard ⚠️' },
      JUSTIFIE: { color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: Shield, label: 'Présence justifiée 📝' },
    };
    const cfg = statusMap[state.statut || 'PRESENT'];
    const Icon = cfg.icon;
    const time = state.heureArrivee
      ? new Date(state.heureArrivee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : '--:--';

    return (
      <Card className={`border ${cfg.bg}`}>
        <CardContent className={`flex items-center gap-3 p-4 ${compact ? 'py-3' : ''}`}>
          <Icon className={`w-8 h-8 ${cfg.color} shrink-0`} />
          <div>
            <p className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</p>
            <p className="text-xs text-muted-foreground">Pointage enregistré à {time}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Not yet marked — show pointage UI
  return (
    <Card className="border-2 border-blue-100 dark:border-blue-900/30">
      <CardContent className={`space-y-3 ${compact ? 'p-4' : 'p-5'}`}>
        {/* Clock + Status */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-xs text-muted-foreground">
              {currentTime.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <Badge
            className={`text-xs font-semibold ${
              isBefore8
                ? 'bg-emerald-100 text-emerald-700 border-0'
                : 'bg-amber-100 text-amber-700 border-0'
            }`}
          >
            {isBefore8 ? '✅ À l\'heure' : '⚠️ Après 8h00'}
          </Badge>
        </div>

        {/* Geolocation */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={getLocation}
              disabled={locating}
              className="flex-1 h-9 text-sm"
            >
              {locating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Navigation className="w-4 h-4 mr-2" />
              )}
              {locating ? 'Localisation...' : coords ? 'Actualiser position' : 'Obtenir ma position'}
            </Button>
            {coords && (
              <Badge className="bg-emerald-100 text-emerald-700 border-0 shrink-0">
                <MapPin className="w-3 h-3 mr-1" />
                Localisé
              </Badge>
            )}
          </div>

          {coords && (
            <p className="text-xs text-muted-foreground">
              📍 {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            </p>
          )}

          {geoError && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-2 border border-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{geoError}</span>
            </div>
          )}
        </div>

        {/* Justification (teacher or toggle) */}
        {(user?.role === 'TEACHER' || showJustif) && (
          <div>
            <Textarea
              placeholder="Justification (optionnelle)..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="text-sm h-16 resize-none"
            />
          </div>
        )}

        {user?.role === 'STUDENT' && !showJustif && (
          <button
            onClick={() => setShowJustif(true)}
            className="text-xs text-blue-600 hover:underline"
          >
            + Ajouter une justification
          </button>
        )}

        {/* Mark Button */}
        <Button
          onClick={markPresence}
          disabled={marking}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-md"
        >
          {marking ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Marquer ma présence
              {isAfter8 && <span className="ml-2 text-amber-200 text-xs">(retard)</span>}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
