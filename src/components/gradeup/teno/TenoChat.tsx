'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
} from 'react';
import {
  MessageSquare,
  Plus,
  Send,
  Paperclip,
  Trash2,
  X,
  ChevronLeft,
  Search,
  Star,
  Pin,
  Copy,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Download,
  RotateCcw,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Settings,
  Check,
  StopCircle,
  Share2,
  Archive,
  Edit2,
  Bot,
  Sparkles,
  MoreVertical,
  ThumbsUp,
  ThumbsDown,
  Globe,
  Camera,
  Music,
  Video,
  UserCheck,
  MapPin,
  Scan,
  Maximize2,
  RotateCw,
  Play,
  Pause,
  ChevronUp,
  History,
  CornerDownLeft,
  Loader2,
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';
import TenoWelcome from './TenoWelcome';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  media?: {
    type: 'image' | 'pdf' | 'audio' | 'video';
    url: string;
    name: string;
    size?: number;
    pageCount?: number;
  };
}

interface AiDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  summary: string;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: AiMessage[];
  documents: AiDocument[];
}

interface ConversationSummary {
  id: string;
  title: string;
  tags: string;
  favorite: boolean;
  pinned: boolean;
  archived?: boolean;
  read?: boolean;
  updatedAt: string;
  messageCount?: number;
  hasImage?: boolean;
  hasPdf?: boolean;
  hasAudio?: boolean;
  hasVideo?: boolean;
  messages: { content: string; role: string; createdAt: string }[];
}

interface TenoChatProps {
  userId: string;
  schoolId: string;
  userRole?: string;
  userName?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const LONG_MESSAGE_CHUNK_SIZE = 1500; // Chunk threshold for 5000+ line rendering

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isYesterday =
    new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
  if (isToday)
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (isYesterday) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function formatSize(bytes: number) {
  if (!bytes) return '0 o';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function groupConversationsByDate(convs: ConversationSummary[]) {
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const monthAgo = new Date(now.getTime() - 30 * 86400000);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const groups: Record<string, ConversationSummary[]> = {
    'Aujourd\'hui': [],
    'Hier': [],
    'Cette semaine': [],
    'Ce mois': [],
    'Cette année': [],
    'Plus ancien': [],
  };

  for (const c of convs) {
    if (c.archived) continue;
    const d = new Date(c.updatedAt);
    if (d.toDateString() === today) { groups['Aujourd\'hui'].push(c); continue; }
    if (d.toDateString() === yesterday) { groups['Hier'].push(c); continue; }
    if (d > weekAgo) { groups['Cette semaine'].push(c); continue; }
    if (d > monthAgo) { groups['Ce mois'].push(c); continue; }
    if (d >= yearStart) { groups['Cette année'].push(c); continue; }
    groups['Plus ancien'].push(c);
  }

  return Object.entries(groups).filter(([, v]) => v.length > 0);
}

// ─── Chunking for Long Messages (Sectioning 5000+ line texts) ────────────────

function chunkLongMessage(text: string) {
  if (text.length <= LONG_MESSAGE_CHUNK_SIZE) {
    return [{ id: 'section-1', title: 'Message', content: text }];
  }
  const chunks: Array<{ id: string; title: string; content: string }> = [];
  let currentPos = 0;
  let sectionIndex = 1;

  while (currentPos < text.length) {
    let endPos = currentPos + LONG_MESSAGE_CHUNK_SIZE;
    if (endPos < text.length) {
      const nextBreak = text.indexOf('\n\n', endPos - 200);
      if (nextBreak !== -1 && nextBreak < endPos + 200) {
        endPos = nextBreak + 2;
      }
    } else {
      endPos = text.length;
    }
    const chunkText = text.slice(currentPos, endPos);
    chunks.push({
      id: `section-${sectionIndex}`,
      title: `Section ${sectionIndex}`,
      content: chunkText,
    });
    currentPos = endPos;
    sectionIndex++;
  }
  return chunks;
}

// ─── Component: Sectioned Long Message Block ──────────────────────────────────

function SectionedMessageBlock({ text }: { text: string }) {
  const sections = chunkLongMessage(text);
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  const toggleSection = (id: string) => {
    setCollapsedMap(p => ({ ...p, [id]: !p[id] }));
  };

  const copySection = (content: string) => {
    navigator.clipboard?.writeText(content);
  };

  if (sections.length <= 1) {
    return (
      <div
        className="gradi-msg-text font-sans leading-relaxed"
        dangerouslySetInnerHTML={{
          __html: text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code class="inline-code">$1</code>')
            .replace(/\n/g, '<br/>'),
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {sections.map((sec, idx) => {
        const isCollapsed = collapsedMap[sec.id] ?? (idx > 0);
        return (
          <div key={sec.id} className="border border-white/10 rounded-2xl bg-white/5 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/5">
              <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                📌 {sec.title} <span className="text-[10px] text-white/40 font-normal">({sec.content.length} chars)</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => copySection(sec.content)}
                  className="p-1 text-white/40 hover:text-white rounded-lg hover:bg-white/10 text-xs"
                  title="Copier la section"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => toggleSection(sec.id)}
                  className="p-1 text-white/40 hover:text-white rounded-lg hover:bg-white/10 text-xs"
                  title={isCollapsed ? 'Déplier' : 'Replier'}
                >
                  {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {!isCollapsed && (
              <div className="p-3 text-sm leading-relaxed text-white/90 whitespace-pre-wrap font-sans">
                {sec.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Component: Media Viewers (Image HD, PDF, Audio, Video) ───────────────────

function MediaAttachment({ media }: { media: NonNullable<AiMessage['media']> }) {
  const [zoomed, setZoomed] = useState(false);
  const [rotation, setRotation] = useState(0);

  if (media.type === 'image') {
    return (
      <div className="mt-2 group relative max-w-xs sm:max-w-sm rounded-2xl overflow-hidden border border-white/10 shadow-lg">
        <img
          src={media.url}
          alt={media.name}
          className="w-full h-auto max-h-60 object-cover cursor-pointer transition-transform duration-200 hover:scale-105"
          onClick={() => setZoomed(true)}
        />
        <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setZoomed(true)}
            className="p-1.5 bg-black/60 backdrop-blur-md text-white rounded-lg text-xs"
            title="Agrandir"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Zoom HD */}
        {zoomed && (
          <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-gradi-fadein"
            onClick={() => setZoomed(false)}
          >
            <div className="absolute top-4 right-4 flex items-center gap-2 z-10" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setRotation(r => (r + 90) % 360)}
                className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl"
                title="Pivoter"
              >
                <RotateCw className="w-5 h-5" />
              </button>
              <a
                href={media.url}
                download={media.name}
                className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl"
                title="Télécharger"
              >
                <Download className="w-5 h-5" />
              </a>
              <button onClick={() => setZoomed(false)} className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={media.url}
              alt={media.name}
              style={{ transform: `rotate(${rotation}deg)` }}
              className="max-w-full max-h-[85vh] object-contain transition-transform duration-300 rounded-xl"
            />
          </div>
        )}
      </div>
    );
  }

  if (media.type === 'pdf') {
    return (
      <div className="mt-2 flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 max-w-sm">
        <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-xs truncate">{media.name}</p>
          <p className="text-white/40 text-[10px]">
            {media.pageCount ? `${media.pageCount} pages • ` : ''}{formatSize(media.size || 0)}
          </p>
        </div>
        <a
          href={media.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-xs"
        >
          <Download className="w-4 h-4" />
        </a>
      </div>
    );
  }

  if (media.type === 'audio') {
    return (
      <div className="mt-2 p-3 rounded-2xl bg-white/5 border border-white/10 max-w-sm">
        <div className="flex items-center gap-2 mb-1.5">
          <Music className="w-4 h-4 text-indigo-400" />
          <span className="text-white font-medium text-xs truncate">{media.name}</span>
        </div>
        <audio controls src={media.url} className="w-full h-8 rounded-lg outline-none" />
      </div>
    );
  }

  if (media.type === 'video') {
    return (
      <div className="mt-2 max-w-sm rounded-2xl overflow-hidden border border-white/10 shadow-lg">
        <video controls src={media.url} className="w-full max-h-60 rounded-2xl" />
      </div>
    );
  }

  return null;
}

// ─── Component: Bottom Sheet Menu (Trois points ⋮ - 14 options) ───────────────

interface MenuSheetProps {
  onClose: () => void;
  onNewChat: () => void;
  onOpenHistory: () => void;
  onOpenSearch: () => void;
  onOpenSearchHistory: () => void;
  onClearAll: () => void;
  onExport: () => void;
  onDeleteCurrent: () => void;
  activeTitle?: string;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  onOpenMemory?: () => void;
}

function ThreeDotsMenuSheet({
  onClose,
  onNewChat,
  onOpenHistory,
  onOpenSearch,
  onOpenSearchHistory,
  onClearAll,
  onExport,
  onDeleteCurrent,
  activeTitle,
  selectedModel = 'glm',
  onModelChange,
  onOpenMemory,
}: MenuSheetProps) {
  const [showModels, setShowModels] = useState(false);

  const models = [
    { id: 'glm', name: 'GLM 4.5 Flash', desc: 'Rapide & precis (Zhipu AI)', emoji: '⚡' },
    { id: 'deepseek', name: 'DeepSeek V3', desc: 'Puissant & gratuit (OpenRouter)', emoji: '🧠' },
    { id: 'gemma', name: 'Gemma 3 12B', desc: 'Leger & gratuit (Google)', emoji: '💎' },
    { id: 'llama', name: 'Llama 3.1 8B', desc: 'Rapide & gratuit (Meta)', emoji: '🦙' },
  ];

  const menuItems = [
    { label: 'Nouveau chat', icon: Plus, action: onNewChat, color: 'text-indigo-400' },
    { label: 'Historique', icon: MessageSquare, action: onOpenHistory, color: 'text-blue-400' },
    { label: 'Conversations épinglées', icon: Pin, action: onOpenHistory, color: 'text-amber-400' },
    { label: 'Conversations archivées', icon: Archive, action: onOpenHistory, color: 'text-purple-400' },
    { label: 'Rechercher dans les conversations', icon: Search, action: onOpenSearch, color: 'text-emerald-400' },
    { label: 'Historique de recherche', icon: History, action: onOpenSearchHistory, color: 'text-teal-400' },
    { label: 'Favoris', icon: Star, action: onOpenHistory, color: 'text-yellow-400' },
    { label: `Modèle IA : ${models.find(m => m.id === selectedModel)?.name || 'GLM'}`, icon: Bot, action: () => setShowModels(true), color: 'text-cyan-400' },
    { label: 'Mémoire de Teno', icon: Sparkles, action: () => { onOpenMemory?.(); onClose(); }, color: 'text-pink-400' },
    { label: 'Exporter la conversation', icon: Download, action: onExport, color: 'text-emerald-300' },
    { label: 'Supprimer cette conversation', icon: Trash2, action: onDeleteCurrent, color: 'text-rose-400' },
    { label: 'Vider tout l\'historique', icon: Trash2, action: onClearAll, color: 'text-red-500' },
    { label: 'Informations sur l\'IA', icon: Bot, action: () => { const m = models.find(x => x.id === selectedModel); toast.info(`Teno — ${m?.name || 'GLM'}\n\nAssistant scolaire intelligent. Mémorise vos faits via [MEM:], traite PDF/images, traduit en FR/EN/Lingala/Swahili.`); }, color: 'text-indigo-400' },
  ];

  if (showModels) {
    return (
      <>
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-gradi-fadein" onClick={onClose} />
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 animate-gradi-sheet-up w-[90vw] max-w-lg">
          <div className="bg-[#18181F] rounded-t-[24px] border border-white/10 max-h-[85vh] overflow-y-auto shadow-2xl pb-safe">
            <div className="pt-3 pb-2 flex justify-center sticky top-0 bg-[#18181F] border-b border-white/5 z-10">
              <div className="w-12 h-1.5 rounded-full bg-white/20" />
            </div>
            <div className="p-3 border-b border-white/5 flex items-center gap-2">
              <button onClick={() => setShowModels(false)} className="text-white/60 hover:text-white">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <p className="font-bold text-white text-base">Choisir le modèle IA</p>
            </div>
            <div className="p-3 space-y-2">
              {models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { onModelChange?.(m.id); onClose(); }}
                  className={`w-full p-4 rounded-xl border transition-all text-left ${
                    selectedModel === m.id
                      ? 'bg-indigo-500/20 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                      : 'bg-white/5 border-white/10 hover:bg-white/8'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{m.emoji}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-white">{m.name}</p>
                      <p className="text-xs text-white/50">{m.desc}</p>
                    </div>
                    {selectedModel === m.id && <CheckCircle2 className="w-5 h-5 text-indigo-400" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-gradi-fadein" onClick={onClose} />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 animate-gradi-sheet-up w-[90vw] max-w-lg">
        <div className="bg-[#18181F] rounded-t-[24px] border border-white/10 max-h-[85vh] overflow-y-auto shadow-2xl pb-safe">
          <div className="pt-3 pb-2 flex justify-center sticky top-0 bg-[#18181F] border-b border-white/5 z-10">
            <div className="w-12 h-1.5 rounded-full bg-white/20" />
          </div>
          <div className="p-3 border-b border-white/5">
            <p className="text-center font-bold text-white text-base">Option & Gestion Teno</p>
            {activeTitle && <p className="text-center text-white/40 text-xs truncate mt-0.5">{activeTitle}</p>}
          </div>
          <div className="py-2">
            {menuItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={idx}
                  onClick={() => { item.action(); onClose(); }}
                  className="w-full h-[56px] px-5 flex items-center gap-[16px] hover:bg-white/8 active:bg-white/12 transition-colors border-b border-white/5 last:border-0"
                >
                  <Icon className={`w-[24px] h-[24px] shrink-0 ${item.color}`} />
                  <span className="text-[16px] font-medium text-white/90 truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Component: Attachment Input Sheet (Bouton + à gauche) ────────────────────

function AttachmentSheet({ onClose, onSelect }: { onClose: () => void; onSelect: (type: string) => void }) {
  const options = [
    { label: 'Photos', icon: ImageIcon, color: 'from-purple-500 to-indigo-600', type: 'image' },
    { label: 'Caméra', icon: Camera, color: 'from-blue-500 to-cyan-600', type: 'camera' },
    { label: 'Fichiers', icon: Paperclip, color: 'from-emerald-500 to-teal-600', type: 'file' },
    { label: 'PDF', icon: FileText, color: 'from-red-500 to-rose-600', type: 'pdf' },
    { label: 'Audio', icon: Music, color: 'from-amber-500 to-orange-600', type: 'audio' },
    { label: 'Vidéo', icon: Video, color: 'from-pink-500 to-rose-500', type: 'video' },
    { label: 'Contacts', icon: UserCheck, color: 'from-indigo-500 to-purple-500', type: 'contact' },
    { label: 'Localisation', icon: MapPin, color: 'from-emerald-600 to-green-600', type: 'location' },
    { label: 'Scanner', icon: Scan, color: 'from-amber-600 to-yellow-500', type: 'scanner' },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-gradi-fadein" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-gradi-sheet-up max-w-lg mx-auto">
        <div className="bg-[#1C1C24] rounded-t-[28px] border-t border-white/10 p-5 shadow-2xl">
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
          <h3 className="text-white font-bold text-base text-center mb-4">Joindre un document ou un média</h3>
          <div className="grid grid-cols-3 gap-3">
            {options.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.label}
                  onClick={() => { onSelect(opt.type); onClose(); }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all"
                >
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${opt.color} flex items-center justify-center text-white mb-2 shadow-md`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-white text-xs font-medium">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Component: Search Conversations Bar ──────────────────────────────────────

function SearchBarOverlay({ search, setSearch, onClose }: { search: string; setSearch: (v: string) => void; onClose: () => void }) {
  return (
    <div className="px-4 py-3 bg-[#16161D] border-b border-white/10 flex items-center gap-3 animate-gradi-fadein">
      <div className="flex-1 h-[52px] rounded-[18px] bg-white/8 border border-white/10 px-[16px] flex items-center gap-2">
        <Search className="w-5 h-5 text-white/40 shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une conversation (titre, code, PDF, mot)..."
          autoFocus
          className="w-full bg-transparent text-white text-sm outline-none placeholder:text-white/30"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-white/40 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <button onClick={onClose} className="text-white/60 hover:text-white text-xs font-semibold px-2">
        Fermer
      </button>
    </div>
  );
}

// ─── Component: Action Bar under AI Messages (9 actions 40x40px) ──────────────

function AiMessageActions({
  content,
  onRegenerate,
  onSpeak,
  isSpeaking,
}: {
  content: string;
  onRegenerate: () => void;
  onSpeak: () => void;
  isSpeaking: boolean;
}) {
  const [liked, setLiked] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTranslate = async () => {
    if (translating) return;
    setTranslating(true);
    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, targetLang: 'fr' }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTranslated(data.translation || content);
      setShowActions(true);
    } catch {
      toast.error('Traduction indisponible pour le moment.');
    } finally {
      setTranslating(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teno-message-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const actions = [
    { id: 'like', icon: ThumbsUp, color: liked === true ? 'text-emerald-400' : 'text-white/50', action: () => setLiked(liked === true ? null : true), title: 'J\'aime' },
    { id: 'dislike', icon: ThumbsDown, color: liked === false ? 'text-rose-400' : 'text-white/50', action: () => setLiked(liked === false ? null : false), title: 'Je n\'aime pas' },
    { id: 'copy', icon: copied ? Check : Copy, color: copied ? 'text-emerald-400' : 'text-white/50', action: handleCopy, title: 'Copier' },
    { id: 'share', icon: Share2, color: 'text-white/50', action: () => navigator.share?.({ text: content }).catch(() => {}), title: 'Partager' },
    { id: 'speak', icon: isSpeaking ? VolumeX : Volume2, color: isSpeaking ? 'text-indigo-400' : 'text-white/50', action: onSpeak, title: 'Lire à voix haute' },
    { id: 'translate', icon: translating ? Loader2 : Globe, color: 'text-white/50', action: handleTranslate, title: 'Traduire' },
    { id: 'export', icon: Download, color: 'text-white/50', action: handleExport, title: 'Exporter' },
    { id: 'regen', icon: RotateCcw, color: 'text-white/50', action: onRegenerate, title: 'Régénérer' },
  ];

  return (
    <div className="mt-2 pt-2 border-t border-white/5">
      <div className="flex flex-wrap items-center gap-1.5">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.id}
              onClick={act.action}
              className="w-[40px] h-[40px] rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center transition-all"
              title={act.title}
            >
              <Icon className={`w-4 h-4 ${act.color} ${act.id === 'translate' && translating ? 'animate-spin' : ''}`} />
            </button>
          );
        })}
      </div>
      {showActions && translated && translated !== content && (
        <div className="mt-2 rounded-xl bg-white/5 border border-white/10 p-3 text-sm text-white/90">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-white/50 font-semibold">Traduction (FR)</span>
            <button onClick={() => setShowActions(false)} className="text-white/40 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="whitespace-pre-wrap">{translated}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component: TenoChat ───────────────────────────────────────────────

export default function TenoChat({ userId, schoolId, userRole, userName }: TenoChatProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showMenuSheet, setShowMenuSheet] = useState(false);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [listening, setListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [stopRequested, setStopRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('glm');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [memories, setMemories] = useState<Array<{ id: string; content: string; category: string; tags: string; importance: number; createdAt: string }>>([]);
  const [memorySearch, setMemorySearch] = useState('');
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState<Array<{ id: string; query: string; resultSummary: string; createdAt: string }>>([]);
  const [searchHistoryLoading, setSearchHistoryLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const stopRequestedRef = useRef(false);
  const activeConversationIdKey = `gradeup-teno-active-${userId}`;

  // ── Attach / upload document ─────────────────────────────────────────────────
  const handleAttachFile = async (file: File) => {
    if (!file) return;
    let convId = activeConversation?.id;
    if (!convId) {
      const res = await fetch('/api/ai/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = await res.json();
        convId = data.conversation.id;
      }
    }
    if (!convId) {
      toast.error('Impossible de créer la conversation pour joindre le fichier.');
      return;
    }

    setUploadingDoc(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('userId', userId);
      fd.append('conversationId', convId);
      const res = await fetch('/api/ai/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Échec du téléversement');
      }
      await loadConversation(convId);
      toast.success(`Fichier « ${file.name} » analysé par Teno.`);
    } catch (err: any) {
      toast.error(err?.message || 'Échec du téléversement du fichier.');
    } finally {
      setUploadingDoc(false);
    }
  };

  // ── Auto scroll ─────────────────────────────────────────────────────────────
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    scrollToBottom(!isStreaming);
  }, [activeConversation?.messages, streamingContent, isStreaming, scrollToBottom]);

  // ── Load conversations ──────────────────────────────────────────────────────
  const loadConversations = useCallback(async (q?: string) => {
    try {
      const params = new URLSearchParams({ userId });
      if (q?.trim()) params.set('search', q.trim());
      const res = await fetch(`/api/ai/conversations?${params}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch { /* silent */ }
  }, [userId]);

  useEffect(() => {
    const timer = setTimeout(() => loadConversations(search), 250);
    return () => clearTimeout(timer);
  }, [loadConversations, search]);

  // ── Load memories ──────────────────────────────────────────────────────────
  const loadMemories = useCallback(async (q?: string) => {
    try {
      const params = new URLSearchParams({ userId });
      if (q?.trim()) params.set('search', q.trim());
      const res = await fetch(`/api/ai/memory?${params}`);
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories || []);
      }
    } catch { /* silent */ }
  }, [userId]);

  useEffect(() => { if (showMemoryPanel) loadMemories(memorySearch); }, [showMemoryPanel, memorySearch, loadMemories]);

  const deleteMemory = async (id: string) => {
    await fetch(`/api/ai/memory?id=${id}&userId=${userId}`, { method: 'DELETE' });
    setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  const deleteAllMemories = async () => {
    if (!confirm('Supprimer toute la mémoire de Teno ?')) return;
    await fetch(`/api/ai/memory?userId=${userId}&deleteAll=true`, { method: 'DELETE' });
    setMemories([]);
  };

  // ── Search history (historique de recherche consultable) ───────────────
  const loadSearchHistory = useCallback(async () => {
    setSearchHistoryLoading(true);
    try {
      const res = await fetch(`/api/ai/search-history?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setSearchHistory(data.history || []);
      }
    } catch { /* silent */ } finally { setSearchHistoryLoading(false); }
  }, [userId]);

  useEffect(() => { if (showSearchHistory) loadSearchHistory(); }, [showSearchHistory, loadSearchHistory]);

  const recordSearch = (query: string) => {
    fetch('/api/ai/search-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, schoolId, query }),
    }).catch(() => {});
  };

  const deleteSearchHistory = async (id: string) => {
    await fetch(`/api/ai/search-history?id=${id}&userId=${userId}`, { method: 'DELETE' });
    setSearchHistory((prev) => prev.filter((h) => h.id !== id));
  };

  const deleteAllSearchHistory = async () => {
    if (!confirm('Vider tout l\'historique de recherche ?')) return;
    await fetch(`/api/ai/search-history?userId=${userId}&deleteAll=true`, { method: 'DELETE' });
    setSearchHistory([]);
  };

  const reuseSearch = (query: string) => {
    setShowSearchHistory(false);
    setInput(query);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  // ── Load single conversation ────────────────────────────────────────────────
  const loadConversation = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/ai/conversations/${id}?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveConversation(data.conversation);
        localStorage.setItem(activeConversationIdKey, id);
      }
    } catch { setError('Impossible de charger la conversation.'); }
    finally { setIsLoading(false); }
  }, [userId, activeConversationIdKey]);

  // Restore the open conversation after a refresh instead of showing an empty chat.
  useEffect(() => {
    const savedId = localStorage.getItem(activeConversationIdKey);
    if (savedId) loadConversation(savedId);
  }, [activeConversationIdKey, loadConversation]);

  // ── Create conversation ─────────────────────────────────────────────────────
  const createNewConversation = async () => {
    try {
      const res = await fetch('/api/ai/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = await res.json();
        await loadConversations();
        await loadConversation(data.conversation.id);
      }
    } catch { setError('Impossible de créer la conversation.'); }
  };

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = async (override?: string) => {
    const msg = (override ?? input).trim();
    if (!msg || isStreaming) return;
    setInput('');
    setError(null);
    setStopRequested(false);
    stopRequestedRef.current = false;
    recordSearch(msg);

    let convId = activeConversation?.id;
    if (!convId) {
      const res = await fetch('/api/ai/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = await res.json();
        convId = data.conversation.id;
        await loadConversation(convId!);
      }
    }

    const userMsg: AiMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: msg,
      createdAt: new Date().toISOString(),
    };
    setActiveConversation((p) => p ? { ...p, messages: [...p.messages, userMsg] } : null);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          schoolId,
          userId,
          conversationId: convId,
          model: selectedModel,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Erreur lors de la génération.');
        setIsStreaming(false);
        return;
      }

      if (!res.body || typeof res.body.getReader !== 'function') {
        const text = await res.text();
        const parsed = text ? JSON.parse(text) : null;
        const reply = parsed?.reply || parsed?.message || text;
        const am: AiMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: reply || 'Réponse générée.',
          createdAt: new Date().toISOString(),
        };
        setActiveConversation((p) => p ? { ...p, messages: [...p.messages, am] } : null);
        setStreamingContent('');
        await loadConversations();
        return;
      }

      const reader = res.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let acc = '';
      let pendingSse = '';
      let lastRenderAt = 0;
      let renderTimer: ReturnType<typeof setTimeout> | undefined;
      const publishStreaming = (value: string, immediate = false) => {
        const now = Date.now();
        if (immediate || now - lastRenderAt >= 50) {
          lastRenderAt = now;
          setStreamingContent(value);
          return;
        }
        if (!renderTimer) {
          renderTimer = setTimeout(() => {
            renderTimer = undefined;
            lastRenderAt = Date.now();
            setStreamingContent(value);
          }, 50 - (now - lastRenderAt));
        }
      };

      while (true) {
        if (stopRequestedRef.current) { await reader.cancel(); break; }
        const { done, value } = await reader.read();
        if (done) break;
        pendingSse += decoder.decode(value, { stream: true });
        const lines = pendingSse.split('\n');
        pendingSse = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const json = line.replace(/^data:\s*/, '').trim();
          try {
            const p = JSON.parse(json);
            if (p.token) { acc += p.token; publishStreaming(acc); }
            // Handle action results — append summary to response
            if (p.actions && Array.isArray(p.actions)) {
              for (const act of p.actions) {
                const r = act.result as any;
                let summary = '';
                if (act.error) {
                  summary = `\n\n❌ **Erreur** : ${act.error}`;
                } else if (act.action === 'create_classes') {
                  const created = r?.created || [];
                  const errors = r?.errors || [];
                  summary = `\n\n---\n✅ **${created.length} classe(s) créée(s)** : ${created.map((c: any) => `${c.name} (${c.level})`).join(', ')}`;
                  if (errors.length > 0) summary += `\n⚠️ ${errors.map((e: any) => `${e.name}: ${e.error}`).join(', ')}`;
                } else if (act.action === 'list_classes') {
                  const classes = r?.classes || [];
                  summary = `\n\n---\n📋 **${classes.length} classe(s)** dans l'établissement :\n${classes.map((c: any) => `• ${c.name} (${c.level}) — ${c._count?.enrollments || 0} élèves, ${c._count?.courses || 0} cours`).join('\n')}`;
                } else if (act.action === 'list_courses') {
                  const courses = r?.courses || [];
                  summary = `\n\n---\n📚 **${courses.length} cours** trouvés :\n${courses.map((c: any) => `• ${c.name} — ${c.class?.name || '?'} — Prof: ${c.teacher?.fullName || '?'}`).join('\n')}`;
                } else if (act.action === 'bulk_create_schedule') {
                  const created = r?.created || [];
                  const errors = r?.errors || [];
                  summary = `\n\n---\n✅ **${created.length} créneau(x) ajouté(s)** à l'emploi du temps`;
                  if (errors.length > 0) summary += `\n⚠️ ${errors.map((e: any) => e.error).join(', ')}`;
                } else if (act.action === 'delete_schedule') {
                  summary = `\n\n---\n🗑️ Créneau supprimé`;
                } else if (act.action === 'update_schedule') {
                  summary = `\n\n---\n✏️ Créneau modifié`;
                }
                if (summary) {
                  acc += summary;
                  publishStreaming(acc);
                }
              }
            }
            if (p.done) {
              const am: AiMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: acc,
                createdAt: new Date().toISOString(),
              };
              setActiveConversation((p) => p ? { ...p, messages: [...p.messages, am] } : null);
              setStreamingContent('');
            }
          } catch { continue; }
        }
      }

      if (renderTimer) clearTimeout(renderTimer);
      publishStreaming(acc, true);

      await loadConversations();
    } catch { setError('Erreur de réseau lors de la communication avec Teno.'); }
    finally { setIsStreaming(false); setStopRequested(false); readerRef.current = null; }
  };

  const stopGeneration = () => {
    setStopRequested(true);
    stopRequestedRef.current = true;
    readerRef.current?.cancel().catch(() => {});
  };

  // ── Voice Dictation ────────────────────────────────────────────────────────
  const startVoice = () => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'fr-FR';
    rec.onresult = (e: any) => setInput(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  // ── TTS ────────────────────────────────────────────────────────────────────
  const speakMessage = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text.replace(/[*`#]/g, ''));
    utter.lang = 'fr-FR';
    utter.onend = () => { setIsSpeaking(false); setSpeakingMsgId(null); };
    window.speechSynthesis.speak(utter);
    setIsSpeaking(true);
  };

  const virtualizer = useVirtualizer({
    count: activeConversation?.messages?.length ?? 0,
    getScrollElement: () => messagesContainerRef.current,
    estimateSize: () => 100,
    overscan: 10,
  });

  return (
    <div className="flex flex-col h-dvh bg-[#0B0B0F] text-white overflow-hidden relative font-sans">
      {/* ── 1. HEADER (Android: 64px, iOS: 88px + Safe Area) ───────────────── */}
      <header
        className="flex items-center justify-between px-[20px] bg-[#12121A]/90 backdrop-blur-md border-b border-white/5 shrink-0 z-20"
        style={{
          height: 'max(64px, env(safe-area-inset-top, 0px) + 64px)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        {/* Left: Avatar (40px) + Name (20px SemiBold) + Subtitle (13px) */}
        <div className="flex items-center gap-[8px] flex-1 min-w-0">
          <div className="w-[40px] h-[40px] rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold tracking-tight truncate leading-none text-white">
              Teno
            </h1>
            <p className="text-[13px] text-emerald-400 font-medium leading-tight mt-0.5 flex items-center gap-1.5">
              {isStreaming ? 'En train d\'écrire...' : 'En ligne'}
              <span className="text-[10px] bg-white/10 text-white/50 px-1.5 py-0.5 rounded-full font-normal">
                {selectedModel === 'glm' ? 'GLM' : selectedModel === 'deepseek' ? 'DeepSeek' : selectedModel === 'gemma' ? 'Gemma' : 'Llama'}
              </span>
            </p>
          </div>
        </div>

        {/* Right: 3 Icons (24x24px, 16px gap) */}
        <div className="flex items-center gap-[16px] shrink-0">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="w-[24px] h-[24px] text-white/70 hover:text-white transition-colors"
            title="Recherche"
          >
            <Search className="w-[24px] h-[24px]" />
          </button>
          <button
            onClick={createNewConversation}
            className="w-[24px] h-[24px] text-white/70 hover:text-white transition-colors"
            title="Nouveau chat"
          >
            <Plus className="w-[24px] h-[24px]" />
          </button>
          <button
            onClick={() => setShowMenuSheet(true)}
            className="w-[24px] h-[24px] text-white/70 hover:text-white transition-colors"
            title="Menu"
          >
            <MoreVertical className="w-[24px] h-[24px]" />
          </button>
        </div>
      </header>

      {/* ── 3. SEARCH OVERLAY ─────────────────────────────────────────────── */}
      {showSearch && (
        <SearchBarOverlay
          search={search}
          setSearch={setSearch}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* ── 2. THREE DOTS MENU BOTTOM SHEET ──────────────────────────────── */}
      {showMenuSheet && (
        <ThreeDotsMenuSheet
          onClose={() => setShowMenuSheet(false)}
          onNewChat={createNewConversation}
          onOpenHistory={() => setShowSearch(true)}
          onOpenSearch={() => setShowSearch(true)}
          onOpenSearchHistory={() => setShowSearchHistory(true)}
          onClearAll={() => {
            if (!confirm('Vider tout l\'historique ?')) return;
            (async () => {
              let cleared = 0;
              for (const c of conversations) {
                const res = await fetch(`/api/ai/conversations/${c.id}?userId=${userId}`, { method: 'DELETE' });
                if (res.ok) cleared++;
              }
              setConversations([]);
              setActiveConversation(null);
              localStorage.removeItem(activeConversationIdKey);
              if (cleared > 0) toast.success(`${cleared} conversation(s) supprimée(s).`);
              else toast.error('Aucune conversation supprimée.');
            })();
          }}
          onExport={() => {
            if (!activeConversation) return;
            const md = [
              `# ${activeConversation.title}`,
              `Modèle : ${selectedModel}`,
              `Exporté le : ${new Date().toLocaleString('fr-FR')}`,
              '',
              ...activeConversation.messages.map(m =>
                `## ${m.role === 'user' ? '👤 Utilisateur' : '🤖 Teno'}\n\n${m.content}`
              ),
            ].join('\n\n');
            const blob = new Blob(['\uFEFF' + md], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `teno-${activeConversation.title.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.md`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          onDeleteCurrent={() => {
            if (!activeConversation) return;
            if (!confirm('Supprimer cette conversation ?')) return;
            (async () => {
              const res = await fetch(`/api/ai/conversations/${activeConversation.id}?userId=${userId}`, { method: 'DELETE' });
              if (res.ok) {
                setConversations(p => p.filter(c => c.id !== activeConversation.id));
                setActiveConversation(null);
                localStorage.removeItem(activeConversationIdKey);
                toast.success('Conversation supprimée.');
              } else {
                toast.error('Échec de la suppression de la conversation.');
              }
            })();
          }}
          activeTitle={activeConversation?.title}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          onOpenMemory={() => setShowMemoryPanel(true)}
        />
      )}

      {/* ── 12. ATTACHMENT SHEET ─────────────────────────────────────────── */}
      {showAttachmentSheet && (
        <AttachmentSheet
          onClose={() => setShowAttachmentSheet(false)}
          onSelect={() => attachInputRef.current?.click()}
        />
      )}

      <input
        ref={attachInputRef}
        type="file"
        accept="application/pdf,.docx,text/plain,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleAttachFile(file);
          e.target.value = '';
        }}
      />

      {/* ── 7. CENTRAL MESSAGES AREA (Desktop max 860px, Mobile 100%, Padding 20px) ─ */}
      <main className="flex-1 min-h-0 overflow-hidden relative">
        <div
          ref={messagesContainerRef}
          className="h-full overflow-y-auto px-[20px] py-4 gradi-scrollbar max-w-[860px] mx-auto"
        >
          {/* Welcome Screen when empty */}
          {!activeConversation && !isLoading && (
            <TenoWelcome
              userName={userName}
              onSelectPrompt={(p) => { setInput(p); sendMessage(p); }}
              onSelectAssistant={(n, pr) => { setInput(pr + ' '); }}
            />
          )}

          {/* Messages list */}
          {activeConversation && activeConversation.messages.length > 0 && (
            <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
              {virtualizer.getVirtualItems().map((vRow) => {
                const msg = activeConversation.messages[vRow.index];
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={vRow.key}
                    data-index={vRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${vRow.start}px)`,
                    }}
                    className={`flex flex-col mb-4 ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    {/* ── 8. BULLES (User max 82%, radius 26px, padding 16h/12v | IA max 88%, radius 26px) ── */}
                    <div
                      style={{
                        maxWidth: isUser ? '82%' : '88%',
                        borderRadius: '26px',
                      }}
                      className={`px-[16px] py-[12px] shadow-sm ${
                        isUser
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-br-md'
                          : 'bg-white/8 border border-white/10 text-white/90 rounded-bl-md backdrop-blur-md'
                      }`}
                    >
                      {/* ── 9. LONG MESSAGES DECOUPES EN SECTIONS ── */}
                      <SectionedMessageBlock text={msg.content} />

                      {/* ── 15. MEDIA ATTACHMENTS ── */}
                      {msg.media && <MediaAttachment media={msg.media} />}

                      {/* ── 14. IA ACTIONS (40x40px) ── */}
                      {!isUser && (
                        <AiMessageActions
                          content={msg.content}
                          onRegenerate={() => sendMessage(msg.content)}
                          onSpeak={() => { setSpeakingMsgId(msg.id); speakMessage(msg.content); }}
                          isSpeaking={speakingMsgId === msg.id && isSpeaking}
                        />
                      )}
                    </div>

                    <span className={`text-[11px] text-white/30 mt-1 ${isUser ? 'mr-2' : 'ml-2'}`}>
                      {formatDate(msg.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── 13. PENDANT QUE L'IA REPOND ("L'IA réfléchit...", ■ Arrêter) ── */}
          {isStreaming && (
            <div className="flex flex-col items-start gap-2 my-3">
              <div className="max-w-[88%] bg-white/8 border border-white/10 rounded-[26px] p-4 flex items-center gap-3">
                <div className="flex gap-1 items-center">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping delay-150" />
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping delay-300" />
                </div>
                <span className="text-xs font-semibold text-indigo-300">L'IA réfléchit...</span>
              </div>
              <button
                onClick={stopGeneration}
                className="flex items-center gap-2 bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-2 rounded-full text-xs font-semibold hover:bg-red-500/30 transition-all"
              >
                <StopCircle className="w-4 h-4 text-red-400" />
                ■ Arrêter la génération
              </button>
            </div>
          )}

          <div ref={messagesEndRef} className="h-4" />
        </div>
      </main>

      {/* ── 11. CHAMP DE SAISIE (Fixé en bas, min 56px, max 180px, coins 28px, padding 16px) ── */}
      <footer
        className="shrink-0 bg-[#12121A]/95 border-t border-white/5 px-[16px] pt-3 z-20"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="max-w-[860px] mx-auto flex items-end gap-2">
          {/* ── 12. BOUTON + A GAUCHE ── */}
          <button
            onClick={() => setShowAttachmentSheet(true)}
            className="w-[48px] h-[48px] rounded-[24px] bg-white/8 hover:bg-white/12 text-white/70 hover:text-white flex items-center justify-center shrink-0 transition-all"
            title="Joindre un média"
          >
            <Plus className="w-[24px] h-[24px]" />
          </button>

          {/* Champ de texte au centre */}
          <div className="flex-1 min-h-[56px] max-h-[180px] bg-white/8 border border-white/10 rounded-[28px] px-[16px] py-3 flex items-center">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Écrivez votre message..."
              disabled={isStreaming}
              rows={1}
              className="w-full bg-transparent text-white placeholder:text-white/30 text-sm outline-none resize-none max-h-[150px] leading-relaxed"
            />
          </div>

          {/* ── 12. BOUTONS A DROITE (Micro, Pièce jointe, Envoyer) ── */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={listening ? () => recognitionRef.current?.stop() : startVoice}
              className={`w-[48px] h-[48px] rounded-[24px] flex items-center justify-center transition-all ${
                listening ? 'bg-red-500 text-white animate-pulse' : 'bg-white/8 text-white/70 hover:text-white'
              }`}
              title="Dictée vocale"
            >
              <Mic className="w-[24px] h-[24px]" />
            </button>

            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() && !isStreaming}
              className={`w-[48px] h-[48px] rounded-[24px] flex items-center justify-center transition-all shadow-lg ${
                input.trim()
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-indigo-500/30'
                  : 'bg-white/5 text-white/20 cursor-not-allowed'
              }`}
              title="Envoyer"
            >
              <Send className="w-[24px] h-[24px]" />
            </button>
          </div>
        </div>
      </footer>

      {/* ── MEMORY PANEL ─────────────────────────────────────────────── */}
      {showMemoryPanel && (
        <>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-gradi-fadein" onClick={() => setShowMemoryPanel(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 animate-gradi-sheet-up max-h-[85vh]">
            <div className="bg-[#18181F] rounded-t-[24px] border border-white/10 flex flex-col h-full max-h-[85vh] shadow-2xl">
              <div className="pt-3 pb-2 flex justify-center sticky top-0 bg-[#18181F] border-b border-white/5 z-10">
                <div className="w-12 h-1.5 rounded-full bg-white/20" />
              </div>
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-white text-lg">Mémoire de Teno</h2>
                  <p className="text-white/40 text-xs">{memories.length} souvenir{memories.length !== 1 ? 's' : ''} stocké{memories.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={deleteAllMemories} className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg bg-red-500/10">Tout supprimer</button>
                  <button onClick={() => setShowMemoryPanel(false)} className="text-white/60 hover:text-white p-1"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    placeholder="Rechercher dans la mémoire..."
                    value={memorySearch}
                    onChange={(e) => setMemorySearch(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {memories.length === 0 ? (
                  <div className="text-center py-12">
                    <Sparkles className="w-12 h-12 text-white/10 mx-auto mb-3" />
                    <p className="text-white/40 text-sm">Aucune mémoire enregistrée</p>
                    <p className="text-white/20 text-xs mt-1">Teno se souviendra des informations importantes que vous partagez</p>
                  </div>
                ) : memories.map((mem) => (
                  <div key={mem.id} className="bg-white/5 border border-white/10 rounded-xl p-3 group hover:bg-white/8 transition-colors">
                    <p className="text-sm text-white/80 leading-relaxed">{mem.content}</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        {mem.tags && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">{mem.tags}</span>}
                        <span className="text-[10px] text-white/30">{new Date(mem.createdAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                      <button onClick={() => deleteMemory(mem.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── SEARCH HISTORY PANEL ─────────────────────────────────────── */}
      {showSearchHistory && (
        <>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-gradi-fadein" onClick={() => setShowSearchHistory(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 animate-gradi-sheet-up max-h-[85vh]">
            <div className="bg-[#18181F] rounded-t-[24px] border border-white/10 flex flex-col h-full max-h-[85vh] shadow-2xl">
              <div className="pt-3 pb-2 flex justify-center sticky top-0 bg-[#18181F] border-b border-white/5 z-10">
                <div className="w-12 h-1.5 rounded-full bg-white/20" />
              </div>
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-white text-lg flex items-center gap-2">
                    <History className="w-5 h-5 text-teal-400" />
                    Historique de recherche
                  </h2>
                  <p className="text-white/40 text-xs mt-0.5">{searchHistory.length} recherche{searchHistory.length !== 1 ? 's' : ''} effectuée{searchHistory.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={deleteAllSearchHistory} className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg bg-red-500/10">Tout supprimer</button>
                  <button onClick={() => setShowSearchHistory(false)} className="text-white/60 hover:text-white p-1"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {searchHistoryLoading ? (
                  <div className="space-y-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : searchHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <Search className="w-12 h-12 text-white/10 mx-auto mb-3" />
                    <p className="text-white/40 text-sm">Aucune recherche enregistrée</p>
                    <p className="text-white/20 text-xs mt-1">Vos questions posées à Teno apparaîtront ici</p>
                  </div>
                ) : searchHistory.map((h) => (
                  <div key={h.id} className="bg-white/5 border border-white/10 rounded-xl p-3 group hover:bg-white/8 transition-colors">
                    <div className="flex items-start gap-2">
                      <Search className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/85 leading-relaxed line-clamp-2">{h.query}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-white/30">{new Date(h.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => reuseSearch(h.query)} className="p-2 text-teal-400 hover:bg-teal-500/10 rounded-lg transition-colors" title="Répéter cette recherche">
                          <CornerDownLeft className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteSearchHistory(h.id)} className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-300 transition-all" title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}