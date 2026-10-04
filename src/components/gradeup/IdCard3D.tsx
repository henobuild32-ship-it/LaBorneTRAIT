'use client';

import { useState, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  User, School, BookOpen, GraduationCap, Calendar,
  Shield, Phone, Mail, Hash, Download, RotateCw,
  Droplets, Heart, PhoneCall, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';

interface CardUser {
  id: string;
  fullName: string;
  email?: string;
  postName?: string;
  gender?: string;
  birthDate?: string;
  matricule?: string;
  ine?: string;
  phone?: string;
  parentPhone?: string;
  parentEmail?: string;
  academicYear?: string;
  section?: string;
  photoUrl?: string;
  cardId?: string;
  bloodType?: string;
  nationality?: string;
  tuteur?: string;
  contactTuteur?: string;
  allergies?: string;
  assurance?: string;
  role?: string;
  roleLabel?: string;
  className?: string;
  courseName?: string;
  specialty?: string;
  qualification?: string;
  address?: string;
  cardIssuedDate?: string;
  cardExpiryDate?: string;
}

interface CardSchool {
  name: string;
  logoUrl?: string | null;
  color?: string;
  email?: string;
  province?: string;
  city?: string;
  commune?: string;
  academicYear?: string;
}

interface IdCard3DProps {
  user: CardUser;
  school: CardSchool;
  role: 'STUDENT' | 'TEACHER';
}

function getAge(birthDateStr?: string): number | null {
  if (!birthDateStr) return null;
  const m = birthDateStr.match(/(\d{4})/);
  if (m) {
    const y = parseInt(m[1]);
    if (y > 1900 && y <= new Date().getFullYear()) return new Date().getFullYear() - y;
  }
  return null;
}

const CARD_W = 850;
const CARD_H = 530;
const BAND_H = 6;

export default function IdCard3D({ user, school, role }: IdCard3DProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  const validLogo = school.logoUrl && !logoError;
  const color = school.color || '#2563eb';
  const age = getAge(user.birthDate);
  const qrUrl = `${window.location.origin}/carte/${user.matricule || user.id}`;
  const genderLabel = user.gender === 'M' ? 'Masculin' : user.gender === 'F' ? 'Féminin' : user.gender || '';

  const handleFlip = () => setIsFlipped(!isFlipped);

  const handleDownload = useCallback(async () => {
    if (!frontRef.current || !backRef.current) return;
    setDownloading(true);
    try {
      const name = user.fullName.replace(/\s+/g, '-').toLowerCase();
      const id = user.matricule || user.cardId || user.id;
      const options = {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        fetchRequestInit: { mode: 'cors' as RequestMode, credentials: 'omit' as RequestCredentials },
        style: { transform: 'none', borderRadius: '0' },
      };
      const [front, back] = await Promise.all([toPng(frontRef.current, options), toPng(backRef.current, options)]);
      const frontImage = new Image();
      const backImage = new Image();
      await Promise.all([
        new Promise<void>((resolve, reject) => { frontImage.onload = () => resolve(); frontImage.onerror = () => reject(new Error('recto')); frontImage.src = front; }),
        new Promise<void>((resolve, reject) => { backImage.onload = () => resolve(); backImage.onerror = () => reject(new Error('verso')); backImage.src = back; }),
      ]);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(frontImage.width, backImage.width);
      canvas.height = frontImage.height + backImage.height + 24;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(frontImage, 0, 0);
      context.drawImage(backImage, 0, frontImage.height + 24);
      const combined = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `carte-${name}-${id}-recto-verso.png`;
      link.href = combined;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Carte recto-verso téléchargée en une seule image.');
    } catch (error) {
      console.error('[IdCard3D] download failed', error);
      toast.error('Téléchargement impossible. Vérifiez que les images de la carte sont accessibles.');
    } finally {
      setDownloading(false);
    }
  }, [user]);

  const Field = ({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) =>
    value ? (
      <div className="flex items-center gap-1.5 text-[10px]">
        <Icon className="w-3 h-3 shrink-0" style={{ color }} />
        <span className="text-slate-500 font-medium min-w-[60px]">{label} :</span>
        <span className="text-slate-800 font-semibold truncate">{value}</span>
      </div>
    ) : null;

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[640px] mx-auto">
      <div
        className="relative w-full cursor-pointer"
        style={{ perspective: '1200px', aspectRatio: `${CARD_W}/${CARD_H}` }}
        onClick={handleFlip}
      >
        <div
          className="relative w-full h-full transition-transform duration-700 ease-out"
          style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          {/* ────────── RECTO ────────── */}
          <div
            ref={frontRef}
            className="absolute inset-0 rounded-xl overflow-hidden shadow-2xl bg-white border border-slate-200 flex flex-col"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          >
            {/* Bandeau couleur */}
            <div className="shrink-0" style={{ height: BAND_H, backgroundColor: color }} />

            {/* Watermark logo */}
            {validLogo && (
              <div
                className="absolute inset-0 pointer-events-none opacity-[0.08] flex items-center justify-center bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${school.logoUrl})`, backgroundSize: '300px', top: BAND_H }}
              />
            )}

            <div className="flex-1 flex p-3 sm:p-5 gap-3 sm:gap-5 relative z-10 min-h-0">
              {/* Photo */}
              <div className="flex flex-col items-center gap-1.5 shrink-0 self-start">
                <div className="w-20 h-24 sm:w-28 sm:h-32 rounded-lg border-2 overflow-hidden bg-slate-100 flex items-center justify-center shadow-sm" style={{ borderColor: color + '40' }}>
                  {user.photoUrl ? (
                    <img crossOrigin="anonymous" src={user.photoUrl} alt={user.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-400">
                      <User className="w-8 h-8" />
                      <span className="text-[8px] font-semibold">{user.fullName?.charAt(0) || '?'}</span>
                    </div>
                  )}
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white text-center w-full" style={{ backgroundColor: color }}>
                  {user.roleLabel || (role === 'TEACHER' ? 'Enseignant' : 'Élève')}
                </span>
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0 flex flex-col justify-between gap-0.5">
                <div>
                    <h2 className="text-xs sm:text-sm font-black text-slate-900 leading-tight uppercase truncate">{user.fullName}</h2>
                    {user.postName && <p className="text-[9px] sm:text-[10px] text-slate-500 truncate">{user.postName}</p>}
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] mt-1">
                  {role === 'STUDENT' && user.className && (
                    <div className="flex items-center gap-1.5">
                      <GraduationCap className="w-3 h-3 shrink-0" style={{ color }} />
                      <span className="text-slate-500">Classe :</span>
                      <span className="text-slate-800 font-semibold truncate">{user.className}</span>
                    </div>
                  )}
                  {role === 'TEACHER' && user.specialty && (
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-3 h-3 shrink-0" style={{ color }} />
                      <span className="text-slate-500">Spécialité :</span>
                      <span className="text-slate-800 font-semibold truncate">{user.specialty}</span>
                    </div>
                  )}
                  {user.section && (
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-3 h-3 shrink-0" style={{ color }} />
                      <span className="text-slate-500">Section :</span>
                      <span className="text-slate-800 font-semibold truncate">{user.section}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-1 mt-0.5 grid grid-cols-2 gap-x-3 gap-y-0.5 max-h-[118px] overflow-hidden">
                  <Field icon={Calendar} label="Né(e) le" value={user.birthDate} />
                  {age !== null && <Field icon={Calendar} label="Âge" value={`${age} ans`} />}
                  <Field icon={User} label="Sexe" value={genderLabel} />
                  <Field icon={Hash} label="Matricule" value={user.matricule} />
                  <Field icon={Shield} label="INE" value={user.ine} />
                  <Field icon={Phone} label="Téléphone" value={user.phone} />
                  <Field icon={Mail} label="Email" value={user.email} />
                  {role === 'STUDENT' && <Field icon={Users} label="Tuteur" value={user.tuteur} />}
                  {role === 'STUDENT' && <Field icon={PhoneCall} label="Contact" value={user.contactTuteur || user.parentPhone} />}
                  {role === 'STUDENT' && <Field icon={Droplets} label="Sang" value={user.bloodType} />}
                  {role === 'STUDENT' && <Field icon={Heart} label="Allergies" value={user.allergies} />}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="shrink-0 flex items-center justify-between px-4 py-1.5 border-t border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-1.5 min-w-0">
                {validLogo ? (
                  <img crossOrigin="anonymous" src={school.logoUrl!} alt="" className="w-4 h-4 object-contain rounded" onError={() => setLogoError(true)} />
                ) : (
                  <School className="w-4 h-4 shrink-0" style={{ color }} />
                )}
                <span className="text-[8px] text-slate-600 font-semibold truncate max-w-[200px]">{school.name}</span>
              </div>
              <span className="text-[8px] text-slate-400 font-mono shrink-0">{school.academicYear || user.academicYear || new Date().getFullYear() + '-' + (new Date().getFullYear() + 1)}</span>
            </div>
          </div>

          {/* ────────── VERSO ────────── */}
          <div
            ref={backRef}
            className="absolute inset-0 rounded-xl overflow-hidden shadow-2xl bg-white border border-slate-200 flex flex-col"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="shrink-0 w-full" style={{ height: BAND_H, backgroundColor: color }} />

            <div className="relative flex-1 flex items-center gap-4 p-5 sm:p-8 pr-28 sm:pr-44">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl border border-slate-200 bg-white flex items-center justify-center p-3 shadow-lg">
                {validLogo ? (
                  <img crossOrigin="anonymous" src={school.logoUrl!} alt={school.name} className="max-w-full max-h-full object-contain" />
                ) : <School className="w-16 h-16 text-slate-300" />}
              </div>
              <div className="min-w-0 space-y-2 text-[10px] sm:text-[11px] text-slate-600">
                <h3 className="text-sm sm:text-lg font-black text-slate-800 uppercase tracking-wide">{school.name}</h3>
                <p>{[school.commune, school.city, school.province].filter(Boolean).join(', ') || 'Coordonnées de l’établissement disponibles auprès de l’administration.'}</p>
                {school.email && <p className="flex items-center gap-1.5"><Mail className="w-3 h-3" style={{ color }} />{school.email}</p>}
                <p className="flex items-center gap-1.5"><Shield className="w-3 h-3" style={{ color }} />Valide : {user.cardExpiryDate || school.academicYear || user.academicYear || 'année scolaire en cours'}</p>
                <p className="font-semibold text-slate-700">Vérification : {user.matricule || user.cardId || user.id}</p>
                {user.address && <p>Adresse : {user.address}</p>}
                {user.qualification && <p>Qualification : {user.qualification}</p>}
                {user.cardIssuedDate && <p>Émise le : {user.cardIssuedDate}</p>}
              </div>
              <div className="hidden sm:flex absolute right-6 top-1/2 -translate-y-1/2 flex-col items-center gap-1">
                <div className="bg-white p-1 rounded-lg shadow-md border border-slate-200">
                  <QRCodeSVG value={qrUrl} size={70} level="M" />
                </div>
                <span className="text-[7px] text-slate-400 text-center">Scanner pour vérifier</span>
              </div>
            </div>

            <div className="shrink-0 w-full" style={{ height: BAND_H, backgroundColor: color }} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 justify-center w-full max-w-[400px]">
        <Button variant="outline" size="sm" onClick={(event) => { event.stopPropagation(); handleFlip(); }} className="gap-1.5 border-slate-300">
          <RotateCw className="w-4 h-4" />
          Retourner
        </Button>
        <Button variant="default" size="sm" onClick={(event) => { event.stopPropagation(); void handleDownload(); }} disabled={downloading} className="gap-1.5" style={{ backgroundColor: color }}>
          <Download className="w-4 h-4" />
          {downloading ? 'Téléchargement...' : 'Télécharger PNG'}
        </Button>
      </div>
    </div>
  );
}
