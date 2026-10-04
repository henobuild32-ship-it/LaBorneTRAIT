'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Send, Bot, User, Trash2, Loader2, Sparkles, MessageSquare,
  Lightbulb, GraduationCap, BookOpen, StopCircle, Copy, Check,
} from 'lucide-react';
import type { ChatMessage } from '@/lib/types';
import { toast } from 'sonner';

interface AiChatProps {
  schoolId: string;
  userId: string;
  role: string;
}

const suggestedPrompts: Record<string, { icon: typeof BookOpen; text: string }[]> = {
  ADMIN: [
    { icon: BookOpen, text: 'Donne-moi un résumé de l\'état de l\'école' },
    { icon: Lightbulb, text: 'Comment améliorer le taux de paiement ?' },
    { icon: Sparkles, text: 'Quels élèves sont en difficulté ?' },
    { icon: GraduationCap, text: 'Aide-moi à préparer une réunion pédagogique' },
  ],
  TEACHER: [
    { icon: BookOpen, text: 'Comment améliorer la moyenne de mes élèves ?' },
    { icon: Lightbulb, text: 'Donne-moi des idées de cours interactifs' },
    { icon: GraduationCap, text: 'Quels élèves sont en difficulté ?' },
    { icon: Sparkles, text: 'Aide-moi à préparer une leçon' },
  ],
  STUDENT: [
    { icon: BookOpen, text: 'Explique-moi ce cours simplement' },
    { icon: GraduationCap, text: 'Fais-moi un quiz sur ma matière' },
    { icon: Lightbulb, text: 'Aide-moi à mémoriser cette leçon' },
    { icon: Sparkles, text: 'Crée des exercices pour moi' },
  ],
  PARENT: [
    { icon: BookOpen, text: 'Comment se porte mon enfant ?' },
    { icon: Lightbulb, text: 'Comment l\'aider à mieux travailler à la maison ?' },
    { icon: GraduationCap, text: 'Y a-t-il des paiements en retard ?' },
    { icon: Sparkles, text: 'Donne-moi des conseils parentaux' },
  ],
};

// ── Markdown renderer ──────────────────────────────────────────────────────────
function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: ReactNode[] = [];
  let i = 0;

  const parseInline = (text: string): ReactNode => {
    text = text.trim();
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={idx} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      if (part.startsWith('*') && part.endsWith('*'))
        return <em key={idx}>{part.slice(1, -1)}</em>;
      if (part.startsWith('`') && part.endsWith('`'))
        return <code key={idx} className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
      return part;
    });
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') { i++; continue; }
    if (/^[-*_]{3,}$/.test(line.trim())) {
      elements.push(<hr key={i} className="border-slate-200 dark:border-slate-600 my-2" />);
      i++; continue;
    }
    const h1Match = line.match(/^#\s+(.+)/);
    const h2Match = line.match(/^##\s+(.+)/);
    const h3Match = line.match(/^###\s+(.+)/);
    if (h1Match) { elements.push(<p key={i} className="font-bold text-base text-foreground mt-2 mb-1">{parseInline(h1Match[1])}</p>); i++; continue; }
    if (h2Match) { elements.push(<p key={i} className="font-semibold text-sm text-foreground mt-2 mb-1">{parseInline(h2Match[1])}</p>); i++; continue; }
    if (h3Match) { elements.push(<p key={i} className="font-medium text-sm text-foreground mt-1.5 mb-0.5">{parseInline(h3Match[1])}</p>); i++; continue; }
    if (/^[-*+]\s/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(<li key={i} className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" /><span>{parseInline(lines[i].replace(/^[-*+]\s/, ''))}</span></li>);
        i++;
      }
      elements.push(<ul key={`ul-${i}`} className="space-y-1 my-1.5 pl-1">{items}</ul>);
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items: ReactNode[] = [];
      let num = 1;
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(<li key={i} className="flex items-start gap-2"><span className="mt-0.5 text-xs font-bold text-blue-500 shrink-0 min-w-[1.2rem]">{num}.</span><span>{parseInline(lines[i].replace(/^\d+\.\s/, ''))}</span></li>);
        i++; num++;
      }
      elements.push(<ol key={`ol-${i}`} className="space-y-1 my-1.5 pl-1">{items}</ol>);
      continue;
    }
    elements.push(<p key={i} className="mb-1">{parseInline(line)}</p>);
    i++;
  }
  return <div className="space-y-0.5 text-sm leading-relaxed">{elements}</div>;
}

// ── Streaming message bubble (live token display) ──────────────────────────────
function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex gap-2 sm:gap-3 justify-start animate-fade-in">
      <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white mt-1 shadow-sm">
        <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </div>
      <div className="max-w-[80%] sm:max-w-[75%] rounded-2xl rounded-bl-md px-3 sm:px-4 py-2.5 sm:py-3 text-sm leading-relaxed shadow-sm bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700">
        <MarkdownMessage content={content || '...'} />
        <span className="inline-block w-0.5 h-4 bg-blue-500 animate-pulse ml-0.5 align-middle" />
      </div>
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-foreground"
      title="Copier"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AiChat({ schoolId, userId, role }: AiChatProps) {
  const { chatMessages, addChatMessage, clearChatMessages } = useAppStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const chatKey = `ai-${role}-${userId}`;
  const messages = chatMessages[chatKey] || [];
  const prompts = suggestedPrompts[role] || suggestedPrompts.STUDENT;

  // Auto-resize textarea
  const adjustTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => { adjustTextarea(); }, [input, adjustTextarea]);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, streamingContent, scrollToBottom]);

  // ── Send with SSE Streaming ────────────────────────────────────────────────
  const handleSend = useCallback(async (customMessage?: string) => {
    const messageContent = customMessage || input.trim();
    if (!messageContent || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date().toISOString(),
    };

    addChatMessage(chatKey, userMessage);
    setInput('');
    setLoading(true);
    setStreamingContent('');
    adjustTextarea();

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          userId,
          role,
          message: messageContent,
          conversationId,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erreur serveur ${res.status}`);
      }

      // ── SSE Streaming ────────────────────────────────────────────────────
      const reader = res.body?.getReader();
      if (!reader) throw new Error('Streaming non supporté');

      const decoder = new TextDecoder();
      let fullReply = '';
      let newConvId = conversationId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((l) => l.trim().startsWith('data:'));

        for (const line of lines) {
          const data = line.replace(/^data:\s*/, '').trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.done) {
              newConvId = parsed.conversationId || newConvId;
              continue;
            }
            if (parsed.conversationId && !newConvId) {
              newConvId = parsed.conversationId;
            }
            if (parsed.token) {
              fullReply += parsed.token;
              setStreamingContent(fullReply);
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      if (newConvId) setConversationId(newConvId);

      // Finalize message
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fullReply || 'Désolé, je n\'ai pas pu générer de réponse.',
        timestamp: new Date().toISOString(),
      };
      addChatMessage(chatKey, assistantMessage);

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User stopped generation — save what we have
        if (streamingContent) {
          const partialMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: streamingContent + '\n\n*(Génération interrompue)*',
            timestamp: new Date().toISOString(),
          };
          addChatMessage(chatKey, partialMessage);
        }
      } else {
        const errMsg = err instanceof Error ? err.message : 'Erreur inconnue';
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `⚠️ Impossible de joindre Teno. ${errMsg}`,
          timestamp: new Date().toISOString(),
        };
        addChatMessage(chatKey, errorMessage);
        if (!errMsg.includes('AbortError')) {
          toast.error('Teno est temporairement indisponible');
        }
      }
    } finally {
      setLoading(false);
      setStreamingContent('');
      setAbortController(null);
      textareaRef.current?.focus();
    }
  }, [input, loading, chatKey, schoolId, userId, role, conversationId, streamingContent, addChatMessage, adjustTextarea]);

  const handleStop = () => {
    abortController?.abort();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    clearChatMessages(chatKey);
    setConversationId(undefined);
    setStreamingContent('');
  };

  return (
    <div className="flex flex-col bg-card rounded-2xl shadow-lg border border-blue-100 dark:border-blue-900/30 overflow-hidden transition-all duration-300 hover:shadow-xl relative"
      style={{ height: 'calc(100dvh - 10rem)' }}
    >
      {/* Loading bar at top */}
      {loading && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-indigo-400 to-blue-500 animate-gradient-bg z-30" />
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shrink-0">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Teno</p>
          <p className="text-xs text-blue-200 flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            <span className="truncate">{loading ? 'Génération en cours...' : 'En ligne — prêt à vous aider'}</span>
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="shrink-0 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
            title="Effacer la conversation"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Messages ──────────────────────────────────────────────────────── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          {/* Empty state */}
          {messages.length === 0 && !streamingContent && (
            <div className="text-center py-8 sm:py-12">
              <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center mb-4 shadow-sm">
                <Bot className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
              </div>
              <p className="text-base sm:text-lg font-bold mb-1">Bonjour ! Je suis Teno</p>
              <p className="text-xs sm:text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                Votre assistant IA intelligent pour l'école. Posez-moi n'importe quelle question.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md mx-auto">
                {prompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handleSend(prompt.text)}
                    disabled={loading}
                    className="flex items-center gap-2.5 p-3 rounded-xl text-left text-xs sm:text-sm font-medium border border-blue-100 dark:border-blue-900/30 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:shadow-md hover:border-blue-200 hover:scale-[1.02] active:scale-[0.98] transition-all text-blue-700 dark:text-blue-400"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50 shrink-0">
                      <prompt.icon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="line-clamp-2 leading-snug">{prompt.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 sm:gap-3 group ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              {msg.role === 'assistant' && (
                <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white mt-1 shadow-sm">
                  <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
              )}

              <div className={`max-w-[82%] sm:max-w-[75%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm leading-relaxed shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-md'
                      : 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 rounded-bl-md'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  ) : (
                    <MarkdownMessage content={msg.content} />
                  )}
                </div>
                <div className={`flex items-center gap-1.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.role === 'assistant' && <CopyButton text={msg.content} />}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white mt-1 shadow-sm">
                  <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
              )}
            </div>
          ))}

          {/* Streaming bubble */}
          {loading && streamingContent && (
            <StreamingBubble content={streamingContent} />
          )}

          {/* Loading indicator (before first token) */}
          {loading && !streamingContent && (
            <div className="flex gap-2 sm:gap-3 justify-start animate-fade-in">
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white mt-1 shadow-sm">
                <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1.5 items-center">
                  <div className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="text-xs text-muted-foreground ml-1">Teno réfléchit...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input ─────────────────────────────────────────────────────────── */}
      <div className="border-t bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-900/80 p-3 shrink-0"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
            <textarea
              ref={textareaRef}
              placeholder={loading ? 'Teno génère une réponse...' : 'Écrivez votre message... (Entrée pour envoyer)'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              rows={1}
              className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none min-h-[42px] max-h-[120px] disabled:opacity-60 leading-relaxed"
              style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
            />
          </div>

          {loading ? (
            <Button
              onClick={handleStop}
              size="icon"
              variant="outline"
              className="shrink-0 h-10 w-10 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400 transition-all"
              title="Arrêter la génération"
            >
              <StopCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              className="shrink-0 h-10 w-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:scale-[1.05] active:scale-[0.97] transition-all duration-200 shadow-md shadow-blue-500/20"
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              size="icon"
              title="Envoyer"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          Entrée pour envoyer · Maj+Entrée pour saut de ligne · Teno peut se tromper
        </p>
      </div>
    </div>
  );
}
