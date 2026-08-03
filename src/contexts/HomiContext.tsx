import { EDGE_BASE_URL } from "@/lib/edgeBaseUrl";
import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

export type HomiRole = "corretor" | "gestor" | "ceo";

export type HomiAction = { tipo: string; lead_id?: string; lead_nome?: string; campos?: Record<string, any> } & Record<string, any>;
export type HomiResult = { tipo: string } & Record<string, any>;

/** Anexo enviado ao HOMI. `dataUrl` só trafega na requisição; o histórico guarda nome/tipo/url. */
export type HomiAnexo = { nome: string; tipo: string; url?: string; dataUrl?: string };

export type Message = { role: "user" | "assistant"; content: string; actions?: HomiAction[]; results?: HomiResult[]; anexos?: HomiAnexo[]; _composerLabel?: string };


export type KnowledgeSourceInfo = {
  source: "db" | "fallback" | "partial";
  db: number;
  fallback: number;
  partial: number;
  total: number;
} | null;

export type ProactiveAlert = {
  id: string;
  priority: "critical" | "normal" | "info";
  message: string;
  actions: { label: string; action: () => void }[];
  ttl?: number; // ms
  createdAt: number;
  seen?: boolean;
  dismissed?: boolean;
};

interface HomiContextType {
  // Panel
  isOpen: boolean;
  openHomi: (initialMessage?: string) => void;
  closeHomi: () => void;
  toggleHomi: () => void;

  // Chat
  messages: Message[];
  sendMessage: (text: string, anexos?: HomiAnexo[]) => Promise<void>;
  clearMessages: () => void;
  isLoading: boolean;

  // Inject a local action card (composer) without calling the AI
  openComposer: (tipo: "criar_tarefa" | "criar_visita" | "buscar_imovel", lead?: { lead_id: string; lead_nome: string; campos?: Record<string, any> }) => void;

  // Proactive alerts
  alerts: ProactiveAlert[];
  addProactiveAlert: (alert: Omit<ProactiveAlert, "id" | "createdAt">) => void;
  dismissAlert: (id: string) => void;
  unseenCount: number;

  // Context awareness
  currentPage: string;
  homiRole: HomiRole;
  userName: string;

  // Debug (admin only)
  knowledgeSource: KnowledgeSourceInfo;

  // Conversation persistence
  conversationId: string | null;
  // Carrega uma conversa existente (workspace /homi)
  loadConversation: (id: string, msgs: Message[]) => void;
  // Começa uma conversa nova (limpa mensagens e id)
  startNewConversation: () => void;

  // Produto em foco (seleção explícita, só na sessão — não persiste)
  empreendimentoFoco: string | null;
  setEmpreendimentoFoco: (nome: string | null) => void;



  // Floating launcher visibility (hidden while a fullscreen drawer is open on mobile)
  launcherHidden: boolean;
  setLauncherHidden: (hidden: boolean) => void;
}

const HomiContext = createContext<HomiContextType | null>(null);

// Cérebro único: todos os papéis usam homi-chat (RAG + ferramentas).
// O foco por papel é enviado no body (`perfil`).
const CHAT_URL_MAP: Record<HomiRole, string> = {
  corretor: "homi-chat",
  gestor: "homi-chat",
  ceo: "homi-chat",
};

export function HomiProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isAdmin, isGestor, isCorretor } = useUserRole();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [launcherHidden, setLauncherHidden] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);
  const [userName, setUserName] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [knowledgeSource, setKnowledgeSource] = useState<KnowledgeSourceInfo>(null);
  // Produto em foco: começa vazio, vive só na sessão (não vai para o banco).
  const [empreendimentoFoco, setEmpreendimentoFoco] = useState<string | null>(null);
  const pendingMessageRef = useRef<string | null>(null);


  const homiRole: HomiRole = isAdmin ? "ceo" : isCorretor ? "corretor" : "gestor";
  const currentPage = location.pathname;

  // Fetch user name
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome").eq("user_id", user.id).single().then(({ data }) => {
      if (data?.nome) setUserName(data.nome.split(" ")[0]);
    });
  }, [user]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // "/" to open (only if not typing in an input)
      if (e.key === "/" && !isOpen) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if ((e.target as HTMLElement)?.isContentEditable) return;
        e.preventDefault();
        setIsOpen(true);
      }
      // Esc to close
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  const openHomi = useCallback((initialMessage?: string) => {
    setIsOpen(true);
    if (initialMessage) {
      pendingMessageRef.current = initialMessage;
    }
  }, []);

  const closeHomi = useCallback(() => setIsOpen(false), []);
  const toggleHomi = useCallback(() => setIsOpen(prev => !prev), []);

  // Injeta um cartão de ação (composer) localmente, sem chamar a IA.
  const openComposer = useCallback((
    tipo: "criar_tarefa" | "criar_visita" | "buscar_imovel",
    lead?: { lead_id: string; lead_nome: string; campos?: Record<string, any> },
  ) => {
    setIsOpen(true);
    const action: HomiAction = {
      tipo,
      lead_id: lead?.lead_id,
      lead_nome: lead?.lead_nome,
      campos: lead?.campos || {},
      needsLead: tipo !== "buscar_imovel" && !lead?.lead_id,
    };
    const label = tipo === "criar_tarefa" ? "Nova tarefa" : tipo === "criar_visita" ? "Marcar visita" : "Buscar imóvel";
    setMessages(prev => [...prev, { role: "assistant", content: "", actions: [action], _composerLabel: label } as Message]);
  }, []);


  // Save conversation
  const saveConversation = useCallback(async (msgs: Message[], convId: string | null) => {
    if (!user || msgs.length < 2) return convId;
    const titulo = msgs[0]?.content?.slice(0, 80) || "Chat";
    try {
      if (convId) {
        await supabase.from("homi_conversations").update({
          mensagens: msgs as any,
          titulo,
          updated_at: new Date().toISOString(),
        }).eq("id", convId);
        return convId;
      } else {
        const { data } = await supabase.from("homi_conversations").insert({
          user_id: user.id,
          tipo: "chat",
          titulo,
          mensagens: msgs as any,
        }).select("id").single();
        if (data) return data.id;
      }
    } catch (e) {
      console.error("Save conversation error:", e);
    }
    return convId;
  }, [user]);

  // Stream chat (aceita anexos multimodais: imagens e PDF)
  const sendMessage = useCallback(async (text: string, anexos?: HomiAnexo[]) => {
    const temAnexo = !!anexos?.length;
    if ((!text.trim() && !temAnexo) || isLoading) return;
    const userMsg: Message = {
      role: "user",
      content: text.trim() || (temAnexo ? "Analisa esse arquivo" : ""),
      anexos: temAnexo ? anexos!.map(({ nome, tipo, url }) => ({ nome, tipo, url })) : undefined,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    const functionName = CHAT_URL_MAP[homiRole];
    const url = `${EDGE_BASE_URL}/functions/v1/${functionName}`;

    // ── Copilot mode (todos os papéis): non-streaming tool-calling ──
    {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        // Os anexos (base64) vão só nesta requisição — a conversa salva guarda apenas nome/tipo/url.
        const payloadMessages = newMessages.map((m, i) =>
          i === newMessages.length - 1 && temAnexo ? { ...m, anexos } : m
        );
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            messages: payloadMessages,
            enableTools: true,
            stream: false,
            perfil: homiRole,
            // Produto em foco explícito; o backend valida e ignora valor inválido.
            empreendimento: empreendimentoFoco,
          }),

        });

        if (!resp.ok) {
          if (resp.status === 429) throw new Error("Rate limit. Aguarde alguns segundos.");
          if (resp.status === 402) throw new Error("Créditos esgotados.");
          throw new Error("Erro ao conectar com o HOMI");
        }
        const data = await resp.json();
        const assistantMsg: Message = {
          role: "assistant",
          content: data.content || "",
          actions: Array.isArray(data.actions) && data.actions.length ? data.actions : undefined,
          results: Array.isArray(data.results) && data.results.length ? data.results : undefined,
        };
        const finalMsgs = [...newMessages, assistantMsg];
        setMessages(finalMsgs);
        const newId = await saveConversation(finalMsgs, conversationId);
        if (newId) setConversationId(newId);
      } catch (e: any) {
        console.error("HOMI copilot error:", e);
        setMessages(prev => [...prev, { role: "assistant", content: `Erro: ${e.message || "Tente novamente."}` }]);
      } finally {
        setIsLoading(false);
      }
      return;
    }
  }, [messages, isLoading, homiRole, currentPage, userName, conversationId, saveConversation, empreendimentoFoco]);

  // Handle pending message after panel opens
  useEffect(() => {
    if (isOpen && pendingMessageRef.current && !isLoading) {
      const msg = pendingMessageRef.current;
      pendingMessageRef.current = null;
      sendMessage(msg);
    }
  }, [isOpen, isLoading, sendMessage]);

  // Sem briefing automático: o Homi abre apenas com a saudação.
  // O corretor pede o resumo do dia sob demanda (atalho "⏰ Atrasados").


  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setKnowledgeSource(null);
    setEmpreendimentoFoco(null);
  }, []);

  const loadConversation = useCallback((id: string, msgs: Message[]) => {
    setConversationId(id);
    setMessages(Array.isArray(msgs) ? msgs : []);
    setKnowledgeSource(null);
    setEmpreendimentoFoco(null);
  }, []);

  const startNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setKnowledgeSource(null);
    setEmpreendimentoFoco(null);
  }, []);




  // Proactive alerts
  const addProactiveAlert = useCallback((alert: Omit<ProactiveAlert, "id" | "createdAt">) => {
    const id = crypto.randomUUID();
    setAlerts(prev => [...prev, { ...alert, id, createdAt: Date.now() }]);

    // Auto-dismiss based on TTL
    if (alert.ttl) {
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== id));
      }, alert.ttl);
    }
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, dismissed: true } : a));
  }, []);

  const unseenCount = alerts.filter(a => !a.seen && !a.dismissed).length;

  return (
    <HomiContext.Provider value={{
      isOpen, openHomi, closeHomi, toggleHomi,
      messages, sendMessage, clearMessages, isLoading, openComposer,
      alerts, addProactiveAlert, dismissAlert, unseenCount,
      currentPage, homiRole, userName,
      knowledgeSource,
      conversationId, loadConversation, startNewConversation,
      empreendimentoFoco, setEmpreendimentoFoco,


      launcherHidden, setLauncherHidden,
    }}>
      {children}
    </HomiContext.Provider>
  );
}

// No-op defaults for when useHomi is called outside HomiProvider (e.g. lazy load race)
const NOOP_CONTEXT: HomiContextType = {
  isOpen: false,
  openHomi: () => {},
  closeHomi: () => {},
  toggleHomi: () => {},
  messages: [],
  sendMessage: async () => {},
  clearMessages: () => {},
  openComposer: () => {},
  isLoading: false,
  alerts: [],
  addProactiveAlert: () => {},
  dismissAlert: () => {},
  unseenCount: 0,
  currentPage: "/",
  homiRole: "gestor",
  userName: "",
  knowledgeSource: null,
  loadConversation: () => {},
  startNewConversation: () => {},

  conversationId: null,
  launcherHidden: false,
  setLauncherHidden: () => {},
};

// Throttled warning: max 3 unique callers, then suppress
const _warnedCallers = new Set<string>();
let _warnCount = 0;
const MAX_WARNINGS = 3;

function emitFallbackWarning() {
  if (_warnCount >= MAX_WARNINGS) return;

  // Extract caller hint from stack trace
  let callerHint = "unknown";
  try {
    const stack = new Error().stack || "";
    // Walk up: emitFallbackWarning → useHomi → actual caller
    const lines = stack.split("\n").filter(l => l.includes("/src/"));
    const callerLine = lines.find(l => !l.includes("HomiContext")) || lines[0] || "";
    const match = callerLine.match(/\/src\/(.+?)(?:\?|:)/);
    if (match) callerHint = match[1];
  } catch (e) { console.warn("[HomiContext] Failed to extract caller hint:", e); }

  // Deduplicate by caller
  if (_warnedCallers.has(callerHint)) return;
  _warnedCallers.add(callerHint);
  _warnCount++;

  const route = typeof window !== "undefined" ? window.location.pathname : "?";
  const isSuspense = new Error().stack?.includes("mountLazyComponent") || false;

  console.warn(
    `[HomiContext] useHomi() called outside HomiProvider — returning no-op defaults\n` +
    `  caller: ${callerHint}\n` +
    `  route:  ${route}\n` +
    `  lazy/suspense: ${isSuspense ? "yes (likely transient)" : "no"}\n` +
    (_warnCount >= MAX_WARNINGS ? `  (further warnings suppressed)` : "")
  );
}

export function useHomi() {
  const ctx = useContext(HomiContext);
  if (!ctx) {
    emitFallbackWarning();
    return NOOP_CONTEXT;
  }
  return ctx;
}
