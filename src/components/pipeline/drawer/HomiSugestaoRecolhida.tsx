// ─────────────────────────────────────────────────────────────────
// HomiSugestaoRecolhida — sugestão do Homi dentro do card "Próximo passo".
// Começa RECOLHIDA (uma linha) para não poluir a ficha. Só chama a IA
// quando o corretor abre (economiza crédito e não atrasa a abertura do lead).
// Usa a mesma edge function do HomiLeadAssistant (homi-assistant).
// ─────────────────────────────────────────────────────────────────
import { useState } from "react";
import { ChevronDown, Copy, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EDGE_BASE_URL } from "@/lib/edgeBaseUrl";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { HomiIcon } from "@/components/brand/HomiAvatar";

interface Props {
  leadId: string;
  leadNome: string;
  leadTelefone?: string | null;
  empreendimento?: string | null;
  etapa: string;
  temperatura?: string | null;
  diasSemContato?: number | null;
  /** título da tarefa vencida, se houver (entra no contexto da IA) */
  tarefaAtrasada?: string | null;
  /** abre o painel completo do Homi que já existe na ficha */
  onAbrirHomi?: () => void;
}

interface Sugestao {
  passo: string;
  mensagem: string;
}

// Regras do Método Uhome para a mensagem: responder só ao interesse,
// nada de tabela/planta, terminar convidando para a visita com duas opções.
const OBJETIVO = [
  "Leia o histórico e diga qual é o próximo passo com este lead.",
  "Responda em português do Brasil, tratando o cliente por você, em exatamente duas seções:",
  "## Próximo passo",
  "Uma frase curta, começando por verbo (ex.: \"Oferecer uma opção com parcela menor e convidar para nova visita\").",
  "## 💬 Mensagem",
  "Uma mensagem curta de WhatsApp do corretor para o cliente, no Método Uhome:",
  "- responda só ao que o cliente demonstrou interesse ou à objeção registrada;",
  "- não ofereça o que não foi pedido e não mande tabela, planta ou valores;",
  "- termine com convite para visita presencial com duas opções de dia (\"sábado de manhã ou domingo?\").",
  "Sem emojis na mensagem. Sem outras seções.",
].join("\n");

function separarSecoes(texto: string): Sugestao {
  const secoes = texto
    .split(/^## /m)
    .filter((s) => s.trim())
    .map((s) => {
      const quebra = s.indexOf("\n");
      return quebra === -1
        ? { titulo: s.trim(), corpo: "" }
        : { titulo: s.slice(0, quebra).trim(), corpo: s.slice(quebra + 1).trim() };
    });
  const passo = secoes.find((s) => /pr[óo]ximo passo/i.test(s.titulo))?.corpo ?? "";
  const mensagem = secoes.find((s) => /mensagem|whats|💬/i.test(s.titulo))?.corpo ?? "";
  if (!passo && !mensagem) return { passo: texto.trim(), mensagem: "" };
  return { passo, mensagem };
}

async function montarHistorico(leadId: string): Promise<string> {
  const [at, an, hi] = await Promise.all([
    supabase.from("pipeline_atividades").select("tipo, titulo, descricao, created_at").eq("pipeline_lead_id", leadId).order("created_at", { ascending: false }).limit(10),
    supabase.from("pipeline_anotacoes").select("conteudo, created_at").eq("pipeline_lead_id", leadId).order("created_at", { ascending: false }).limit(5),
    supabase.from("pipeline_historico").select("observacao, created_at").eq("pipeline_lead_id", leadId).order("created_at", { ascending: false }).limit(5),
  ]);
  const linhas: string[] = ["HISTÓRICO (mais recente primeiro):"];
  for (const a of at.data ?? []) {
    linhas.push(`- [${String(a.created_at).slice(0, 10)}] ${a.tipo}: ${a.titulo ?? ""}${a.descricao ? ` — ${String(a.descricao).slice(0, 200)}` : ""}`);
  }
  for (const n of an.data ?? []) {
    linhas.push(`- [${String(n.created_at).slice(0, 10)}] anotação: ${String(n.conteudo).slice(0, 200)}`);
  }
  for (const h of hi.data ?? []) {
    if (h.observacao) linhas.push(`- [${String(h.created_at).slice(0, 10)}] mudança de etapa: ${String(h.observacao).slice(0, 200)}`);
  }
  return linhas.join("\n");
}

export default function HomiSugestaoRecolhida(p: Props) {
  const reduzirMovimento = useReducedMotion();
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [sugestao, setSugestao] = useState<Sugestao | null>(null);
  const [erro, setErro] = useState(false);

  const gerar = async () => {
    setCarregando(true);
    setErro(false);
    try {
      const historico = await montarHistorico(p.leadId);
      const contexto = [
        "DADOS DO LEAD:",
        `Nome: ${p.leadNome}`,
        `Empreendimento: ${p.empreendimento || "N/A"}`,
        `Etapa: ${p.etapa}`,
        `Temperatura: ${p.temperatura || "não definida"}`,
        `Dias sem contato: ${p.diasSemContato ?? "N/A"}`,
        `Tarefa vencida: ${p.tarefaAtrasada || "nenhuma"}`,
        "",
        historico,
      ].join("\n");

      const sessao = await supabase.auth.getSession();
      const token = sessao.data.session?.access_token;
      const resp = await fetch(`${EDGE_BASE_URL}/functions/v1/homi-assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          acao: "custom",
          empreendimento: p.empreendimento || "Geral",
          situacao: `${p.etapa} | Temp: ${p.temperatura || "não definida"} | ${p.diasSemContato ?? "?"} dias sem contato`,
          objetivo: OBJETIVO,
          role: "corretor",
          lead_context: contexto,
        }),
      });
      if (!resp.ok) {
        if (resp.status === 429) toast.error("O Homi está com muitas consultas agora. Tente de novo em instantes.");
        if (resp.status === 402) toast.error("Créditos de IA insuficientes.");
        throw new Error(`homi-assistant ${resp.status}`);
      }
      const data = (await resp.json()) as { content?: string };
      setSugestao(separarSecoes(data.content || ""));
    } catch (e) {
      console.error("[HomiSugestaoRecolhida]", e);
      setErro(true);
    } finally {
      setCarregando(false);
    }
  };

  const alternar = () => {
    const vaiAbrir = !aberto;
    setAberto(vaiAbrir);
    if (vaiAbrir && !sugestao && !carregando) void gerar();
  };

  const copiar = () => {
    if (!sugestao?.mensagem) return;
    void navigator.clipboard?.writeText(sugestao.mensagem).then(
      () => toast.success("Mensagem copiada"),
      () => toast.error("Não foi possível copiar"),
    );
  };

  const abrirWhatsApp = () => {
    if (!sugestao?.mensagem || !p.leadTelefone) return;
    const digitos = p.leadTelefone.replace(/\D/g, "");
    const fone = digitos.startsWith("55") ? digitos : `55${digitos}`;
    window.open(`https://wa.me/${fone}?text=${encodeURIComponent(sugestao.mensagem)}`, "_blank");
  };

  return (
    <div className="overflow-hidden rounded-xl border border-homi-border bg-homi-soft">
      <Button variant="ghost"
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        className="flex w-full justify-start items-center gap-2 px-3 py-1.5 text-left h-11 rounded-none hover:bg-homi-cyan/10 focus-visible:ring-primary focus-visible:ring-inset"
      >
        <span className="h-6 w-6 shrink-0"><HomiIcon size={24} /></span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] font-bold leading-5 text-homi-text whitespace-nowrap">Sugestão do Homi</span>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap text-[13px] font-semibold text-homi-text">
          {aberto ? "Recolher" : "Ver"}
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", aberto && "rotate-180")} />
        </span>
      </Button>

      <AnimatePresence initial={false}>
      {aberto && (
        <motion.div key="sugestao" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduzirMovimento ? 0 : 0.2 }} className="overflow-hidden">
        <div className="flex flex-col gap-3 px-4 pb-4 pt-0.5">
          {carregando && (
            <div className="flex items-center gap-2 py-3 text-[13px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none text-homi-text" /> Lendo o histórico do {p.leadNome.split(" ")[0]}…
            </div>
          )}

          {erro && !carregando && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
              <span className="text-[13px] text-muted-foreground">Não consegui gerar a sugestão agora.</span>
              <Button variant="link" onClick={() => void gerar()} className="h-auto p-0 gap-1 text-[13px] font-semibold text-homi-text">
                <RefreshCw className="h-3.5 w-3.5" /> Tentar de novo
              </Button>
            </div>
          )}

          {sugestao && !carregando && (
            <>
              {sugestao.passo && <p className="text-[14px] leading-[22px] text-foreground">{sugestao.passo}</p>}

              {sugestao.mensagem && (
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-homi-text">Mensagem pronta</span>
                  <p className="whitespace-pre-wrap rounded-lg border border-homi-border bg-card px-3.5 py-3 text-[14px] leading-[22px] text-muted-foreground">
                    {sugestao.mensagem}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {p.leadTelefone && (
                      <Button variant="outline" onClick={abrirWhatsApp} className="h-9 gap-2 border-homi-border bg-card px-3.5 text-[13px]">
                        <MessageCircle className="h-4 w-4" /> Abrir no WhatsApp
                      </Button>
                    )}
                    <Button variant="ghost" onClick={copiar} className="h-9 gap-2 px-3 text-[13px] text-homi-text hover:bg-card/60">
                      <Copy className="h-4 w-4" /> Copiar
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {p.onAbrirHomi && !carregando && (
            <Button variant="link" onClick={p.onAbrirHomi} className="self-start h-auto p-0 text-[13px] font-semibold text-homi-text">
              Abrir o Homi completo
            </Button>
          )}
        </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
