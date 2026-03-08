import { useState } from "react";
import { Loader2, Copy, X, Bot, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const EMPREENDIMENTOS = [
  "Alfa", "Orygem", "Las Casas", "Casa Tua", "Lake Eyre", "Open Bosque",
  "Casa Bastian", "Shift", "Seen Menino Deus", "Botanique", "Me Day",
  "Go Carlos Gomes", "Go Carlos Bosque", "Vista Menino Deus", "Nilo Square",
  "High Garden Iguatemi", "High Garden Rio Branco", "Vértice", "Essenza Club",
  "Prime Wish", "Alto Lindóia", "San Andreas", "Supreme", "Boa Vista",
  "Pontal", "Avulso Canoas",
];

interface HomiResponse {
  id: number;
  empreendimento: string;
  text: string;
}

interface Props {
  leadNome: string;
  leadEmpreendimento?: string;
  selectedEmp: string;
  onEmpChange: (emp: string) => void;
  /** Callback to inject a response block into the left column */
  onResponseGenerated?: (response: HomiResponse) => void;
}

export default function HomiObjectionHelper({ leadNome, leadEmpreendimento, selectedEmp, onEmpChange, onResponseGenerated }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [situacao, setSituacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [responses, setResponses] = useState<HomiResponse[]>([]);
  const [nextId, setNextId] = useState(0);

  const handleGenerate = async () => {
    if (!situacao.trim() || loading) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const prompt = `Contexto: Estou em uma ligação de vendas.\nLead: ${leadNome}\nEmpreendimento sendo oferecido: ${selectedEmp}\nSituação/Objeção do cliente: ${situacao.trim()}\n\nMe dê uma resposta curta e persuasiva (máximo 3 frases) para usar AGORA na ligação.\nSeja direto, prático e focado em conversão.`;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homi-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }],
            mode: "arena_objection",
          }),
        }
      );

      if (!res.ok) throw new Error("Erro na resposta");

      const data = await res.json();
      const reply = data.reply || data.content || data.message || "Sem resposta";

      const newResponse: HomiResponse = { id: nextId, empreendimento: selectedEmp, text: reply };
      setResponses(prev => [...prev, newResponse]);
      onResponseGenerated?.(newResponse);
      setNextId(prev => prev + 1);
      setSituacao("");
    } catch (err) {
      console.error("Homi objection error:", err);
      toast.error("Erro ao gerar resposta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const removeResponse = (id: number) => {
    setResponses(prev => prev.filter(r => r.id !== id));
  };

  const copyResponse = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Resposta copiada!");
  };

  return (
    <>
      {/* Compact trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-2 rounded-lg text-sm font-semibold transition-all hover:bg-cyan-600/25 active:scale-[0.98]"
        style={{
          height: 36,
          padding: "0 12px",
          background: "rgba(6,182,212,0.12)",
          border: "1px solid rgba(6,182,212,0.2)",
          color: "#22D3EE",
        }}
      >
        <span className="flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5" />
          Pedir ajuda ao HOMI
        </span>
        <ChevronRight className="h-3.5 w-3.5" />
      </button>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-md border-0"
          style={{
            background: "#1C2128",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#E2E8F0",
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-cyan-400 flex items-center gap-2 text-sm">
              <Bot className="h-4 w-4" />
              Pedir ajuda ao HOMI
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Empreendimento dropdown */}
            <div>
              <label className="text-[10px] uppercase tracking-wider" style={{ color: "#6B7280" }}>
                Empreendimento:
              </label>
              <select
                value={selectedEmp}
                onChange={e => onEmpChange(e.target.value)}
                className="w-full mt-0.5 text-sm rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                style={{
                  background: "#0f1628",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#E2E8F0",
                  height: 32,
                }}
              >
                {EMPREENDIMENTOS.map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>

            {/* Free text */}
            <textarea
              value={situacao}
              onChange={e => setSituacao(e.target.value)}
              placeholder='Ex: "Cliente quer saber sobre financiamento do Me Day, como argumento?"'
              rows={3}
              className="w-full text-sm rounded-md px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              style={{
                background: "#0f1628",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#E2E8F0",
                lineHeight: 1.5,
              }}
            />

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!situacao.trim() || loading}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
              style={{
                height: 36,
                background: loading ? "#155E75" : "#0891B2",
                color: "#FFFFFF",
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando...
                </>
              ) : (
                <>⚡ Gerar Resposta</>
              )}
            </button>

            {/* Responses inside modal */}
            {responses.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                {responses.map(r => (
                  <div
                    key={r.id}
                    className="p-3 rounded-lg relative"
                    style={{
                      background: "rgba(6,182,212,0.08)",
                      border: "1px solid rgba(6,182,212,0.2)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-1 pr-5">
                      <span className="text-xs font-bold" style={{ color: "#22D3EE" }}>
                        🤖 HOMI · {r.empreendimento}
                      </span>
                      <div className="flex items-center gap-1 absolute top-2 right-2">
                        <button
                          onClick={() => copyResponse(r.text)}
                          className="text-neutral-500 hover:text-cyan-300 transition-colors p-0.5"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => removeResponse(r.id)}
                          className="text-neutral-500 hover:text-white transition-colors p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm leading-snug" style={{ color: "#D1D5DB" }}>
                      {r.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
