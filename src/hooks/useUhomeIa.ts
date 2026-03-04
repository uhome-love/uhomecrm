import { useState, useCallback } from "react";
import { useUserRole } from "@/hooks/useUserRole";

type Message = { role: "user" | "assistant"; content: string };

/**
 * Hook for module-specific UHOME IA CORE calls (non-streaming, single response).
 */
export function useUhomeIa() {
  const { isAdmin } = useUserRole();
  const [loading, setLoading] = useState(false);

  const analyze = useCallback(async (options: {
    module: string;
    prompt: string;
    context?: any;
  }): Promise<string> => {
    setLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/uhome-ia-core`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: options.prompt }],
          role: isAdmin ? "admin" : "gestor",
          module: options.module,
          context: options.context,
        }),
      });

      if (!resp.ok) throw new Error("AI request failed");

      // Parse SSE stream to full text
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result = "";

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
            if (content) result += content;
          } catch { /* partial */ }
        }
      }

      return result;
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  return { analyze, loading };
}
