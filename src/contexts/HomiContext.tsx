import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

export type HomiRole = "corretor" | "gestor" | "ceo";

export type Message = { role: "user" | "assistant"; content: string };

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
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
  isLoading: boolean;

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
}

const HomiContext = createContext<HomiContextType | null>(null);

const CHAT_URL_MAP: Record<HomiRole, string> = {
  corretor: "homi-chat",
  gestor: "uhome-ia-core",
  ceo: "uhome-ia-core",
};

export function HomiProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isAdmin, isGestor, isCorretor } = useUserRole();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);
  const [userName, setUserName] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [knowledgeSource, setKnowledgeSource] = useState<KnowledgeSourceInfo>(null);
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

  // Stream chat
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    const functionName = CHAT_URL_MAP[homiRole];
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;

    let assistantContent = "";

    try {
      const body: any = { messages: newMessages };
      if (functionName === "uhome-ia-core") {
        body.role = homiRole === "ceo" ? "admin" : "gestor";
        body.module = "general";
        body.context = { page: currentPage, userName };
      }

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) throw new Error("Rate limit. Aguarde alguns segundos.");
        if (resp.status === 402) throw new Error("Créditos esgotados.");
        throw new Error("Erro ao conectar com o HOMI");
      }

      // Parse knowledge source header (admin debug)
      try {
        const ksHeader = resp.headers.get("x-knowledge-source");
        if (ksHeader) setKnowledgeSource(JSON.parse(ksHeader));
      } catch { /* ignore */ }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch { /* partial */ }
        }
      }

      const finalMsgs = [...newMessages, { role: "assistant" as const, content: assistantContent }];
      setMessages(finalMsgs);
      const newId = await saveConversation(finalMsgs, conversationId);
      if (newId) setConversationId(newId);
    } catch (e: any) {
      console.error("HOMI chat error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: `Erro: ${e.message || "Tente novamente."}` }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, homiRole, currentPage, userName, conversationId, saveConversation]);

  // Handle pending message after panel opens
  useEffect(() => {
    if (isOpen && pendingMessageRef.current && !isLoading) {
      const msg = pendingMessageRef.current;
      pendingMessageRef.current = null;
      sendMessage(msg);
    }
  }, [isOpen, isLoading, sendMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setKnowledgeSource(null);
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
      messages, sendMessage, clearMessages, isLoading,
      alerts, addProactiveAlert, dismissAlert, unseenCount,
      currentPage, homiRole, userName,
      knowledgeSource,
      conversationId,
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
  isLoading: false,
  alerts: [],
  addProactiveAlert: () => {},
  dismissAlert: () => {},
  unseenCount: 0,
  currentPage: "/",
  homiRole: "gestor",
  userName: "",
  knowledgeSource: null,
  conversationId: null,
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
  } catch { /* ignore */ }

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
