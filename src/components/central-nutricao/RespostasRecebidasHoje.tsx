import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, MessageSquare, AlertTriangle, CheckCircle2, XCircle, HelpCircle, Loader2 } from "lucide-react";
import { formatBRT } from "@/lib/brtTime";
import { useState } from "react";

interface Resposta {
  origem: "botao_meta" | "texto_meta" | "remetente_novo";
  quando: string;
  lead_id: string | null;
  nome: string | null;
  phone: string | null;
  texto: string;
  classificacao: "sim" | "nao" | "outro";
  acao: string;
  alerta: string | null;
}

// Heurística de classificação para texto livre — alinhada com whatsapp-webhook
function classifyText(txt: string): "sim" | "nao" | "outro" {
  const t = (txt || "").trim().toLowerCase();
  if (!t) return "outro";
  const NEG_START = /^(n[aã]o|nop|j[aá] comprei|stop|sair|cancela|cancelar|para|parar|remover|descadastrar|desisti)\b/;
  const NEG_PHRASE = /\b(n[aã]o\s+tenho\s+(mais\s+)?interesse|sem\s+interesse|n[aã]o\s+me\s+interess|por\s+(hora|enquanto)\s+n[aã]o|n[aã]o\s+quero\s+(mais|comprar|saber)|j[aá]\s+(comprei|fechei)|desisti|n[aã]o\s+pretendo)\b/;
  if (NEG_START.test(t) || NEG_PHRASE.test(t)) return "nao";
  const POS = /^(sim|s|claro|quero|aceito|ok|👍|✅|🙏)\b|\b(quero\s+(saber|conhecer|receber)|tenho\s+interesse|me\s+interessei|gostaria\s+de\s+(saber|conhecer|mais)|pode\s+(me\s+)?(enviar|passar|mandar)|me\s+envia|me\s+manda)\b/;
  // Verifica negação antes
  const m = POS.exec(t);
  if (m) {
    const before = t.slice(Math.max(0, m.index - 25), m.index);
    if (!/\b(n[aã]o|sem|nem|jamais|nunca)\b/.test(before)) return "sim";
  }
  return "outro";
}

export default function RespostasRecebidasHoje({
  from,
  to,
  periodLabel = "hoje",
}: {
  from?: string;
  to?: string;
  periodLabel?: string;
} = {}) {
  const [open, setOpen] = useState(true);
  const [filtroOrigem, setFiltroOrigem] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["respostas-recebidas-hoje", from ?? null, to ?? null],
    queryFn: async (): Promise<Resposta[]> => {
      let sinceIso = from;
      if (!sinceIso) {
        const startBRT = new Date();
        startBRT.setUTCHours(3, 0, 0, 0); // 00:00 BRT
        sinceIso = startBRT.toISOString();
      }
      const untilIso = to;

      // 1. Respostas via reengajamento_meta_disparos (botões e texto livre Meta)
      let disparosQ = supabase
        .from("reengajamento_meta_disparos")
        .select("lead_id, phone, button_response, response_text, responded_at, audience_source")
        .gte("responded_at", sinceIso)
        .order("responded_at", { ascending: false })
        .limit(500);
      if (untilIso) disparosQ = disparosQ.lte("responded_at", untilIso);
      const { data: disparos } = await disparosQ;

      // 2. Leads criados no período pela rota "remetente novo" (whatsapp-webhook)
      let novosQ = supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, observacoes, reativado_em")
        .eq("reativado_por_nutricao", true)
        .gte("reativado_em", sinceIso)
        .ilike("observacoes", "%remetente novo%")
        .order("reativado_em", { ascending: false })
        .limit(200);
      if (untilIso) novosQ = novosQ.lte("reativado_em", untilIso);
      const { data: novosReativados } = await novosQ;

      // Carrega nomes + status atual dos leads dos disparos
      const leadIds = Array.from(new Set((disparos ?? []).map((d) => d.lead_id).filter(Boolean))) as string[];
      const leadsMap: Record<string, { nome: string | null; reengajamento_status: string | null; tipo_descarte: string | null; reativado_por_nutricao: boolean | null }> = {};
      if (leadIds.length) {
        const { data: leads } = await supabase
          .from("pipeline_leads")
          .select("id, nome, reengajamento_status, tipo_descarte, reativado_por_nutricao")
          .in("id", leadIds);
        (leads ?? []).forEach((l: any) => (leadsMap[l.id] = l));
      }

      const respostas: Resposta[] = [];

      (disparos ?? []).forEach((d: any) => {
        const lead = d.lead_id ? leadsMap[d.lead_id] : null;
        const viaBotao = !!d.button_response;
        const classificacao: "sim" | "nao" | "outro" = viaBotao
          ? (d.button_response === "sim" ? "sim" : d.button_response === "nao" ? "nao" : "outro")
          : classifyText(d.response_text || "");

        // Ação efetiva baseada no estado do lead
        let acao = "—";
        let alerta: string | null = null;
        if (classificacao === "sim") {
          acao = lead?.reativado_por_nutricao ? "✅ Reativado e enviado à roleta" : "⚠️ SIM detectado mas lead não foi reativado";
          if (!lead?.reativado_por_nutricao) alerta = "Lead com resposta positiva não foi reativado";
        } else if (classificacao === "nao") {
          if (lead?.reengajamento_status?.startsWith("respondeu_nao")) acao = "✅ Marcado como descartado definitivo";
          else if (lead?.reengajamento_status === "enviado") { acao = "⚠️ Botão NÃO recebido mas status preso em 'enviado'"; alerta = "Status não atualizou"; }
          else acao = `Status: ${lead?.reengajamento_status || "—"}`;
        } else {
          acao = "❓ Resposta não-classificada — sem ação automática";
        }

        respostas.push({
          origem: viaBotao ? "botao_meta" : "texto_meta",
          quando: d.responded_at,
          lead_id: d.lead_id,
          nome: lead?.nome || null,
          phone: d.phone,
          texto: viaBotao ? `[botão] ${d.response_text || d.button_response}` : (d.response_text || "—"),
          classificacao,
          acao,
          alerta,
        });
      });

      (novosReativados ?? []).forEach((l: any) => {
        // Extrai a frase respondida da observação
        const m = /Respondeu:\s*"([^"]+)"/i.exec(l.observacoes || "");
        const texto = m?.[1] || "—";
        const classificacao = classifyText(texto);
        const alerta = classificacao === "nao"
          ? "🚨 Lead criado em cima de resposta NEGATIVA (falso positivo)"
          : classificacao === "outro"
          ? "⚠️ Lead criado a partir de resposta ambígua — revisar"
          : null;
        respostas.push({
          origem: "remetente_novo",
          quando: l.reativado_em,
          lead_id: l.id,
          nome: l.nome,
          phone: l.telefone,
          texto,
          classificacao,
          acao: classificacao === "sim" ? "✅ Lead novo criado e enviado à roleta" : "🚨 Lead novo criado e enviado à roleta",
          alerta,
        });
      });

      respostas.sort((a, b) => (b.quando || "").localeCompare(a.quando || ""));
      return respostas;
    },
    refetchInterval: 15000,
  });

  const respostas = data ?? [];
  const filtered = filtroOrigem === "all" ? respostas : respostas.filter((r) => r.origem === filtroOrigem);

  const stats = {
    total: respostas.length,
    sim: respostas.filter((r) => r.classificacao === "sim").length,
    nao: respostas.filter((r) => r.classificacao === "nao").length,
    outro: respostas.filter((r) => r.classificacao === "outro").length,
    alertas: respostas.filter((r) => r.alerta).length,
  };

  return (
    <Card className="border-emerald-200 bg-emerald-50/30">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full">
          <CardContent className="p-3 flex items-center justify-between hover:bg-emerald-100/40 rounded-t-lg transition">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-emerald-700" />
              <span className="text-sm font-semibold text-emerald-900">💬 Respostas recebidas ({periodLabel}) — auditoria</span>
              <Badge variant="outline" className="text-[10px]">{stats.total}</Badge>
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">✅ {stats.sim} SIM</Badge>
              <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">❌ {stats.nao} NÃO</Badge>
              {stats.outro > 0 && <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">❓ {stats.outro} outro</Badge>}
              {stats.alertas > 0 && (
                <Badge className="bg-red-200 text-red-900 border-red-300 text-[10px] animate-pulse">
                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> {stats.alertas} alerta(s)
                </Badge>
              )}
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-3 pt-0">
            <div className="flex items-center gap-2 mb-3 text-xs">
              <span className="text-muted-foreground">Filtrar por origem:</span>
              {[
                { v: "all", l: "Todas" },
                { v: "botao_meta", l: "🔘 Botão (template)" },
                { v: "texto_meta", l: "💬 Texto livre" },
                { v: "remetente_novo", l: "🆕 Remetente novo" },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => setFiltroOrigem(o.v)}
                  className={`px-2 py-0.5 rounded-full border text-[11px] ${filtroOrigem === o.v ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-muted-foreground border-neutral-200 hover:border-emerald-300"}`}
                >
                  {o.l}
                </button>
              ))}
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-emerald-600" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">Nenhuma resposta hoje neste filtro.</div>
            ) : (
              <div className="rounded-lg border bg-white overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px] text-[11px]">Hora BRT</TableHead>
                      <TableHead className="text-[11px]">Lead</TableHead>
                      <TableHead className="text-[11px]">Origem</TableHead>
                      <TableHead className="text-[11px]">Resposta</TableHead>
                      <TableHead className="text-[11px]">Class.</TableHead>
                      <TableHead className="text-[11px]">Ação efetiva</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r, i) => (
                      <TableRow key={i} className={r.alerta ? "bg-red-50/60" : ""}>
                        <TableCell className="text-[11px] font-mono">{r.quando ? formatBRT(r.quando, "HH:mm") : "—"}</TableCell>
                        <TableCell className="text-[11px]">
                          <div className="font-medium">{r.nome || "—"}</div>
                          <div className="text-muted-foreground font-mono text-[10px]">{r.phone || ""}</div>
                        </TableCell>
                        <TableCell className="text-[11px]">
                          {r.origem === "botao_meta" && <Badge variant="outline" className="text-[10px]">🔘 Botão</Badge>}
                          {r.origem === "texto_meta" && <Badge variant="outline" className="text-[10px]">💬 Texto</Badge>}
                          {r.origem === "remetente_novo" && <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">🆕 Novo</Badge>}
                        </TableCell>
                        <TableCell className="text-[11px] max-w-[260px]">
                          <div className="truncate" title={r.texto}>{r.texto}</div>
                        </TableCell>
                        <TableCell className="text-[11px]">
                          {r.classificacao === "sim" && <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><CheckCircle2 className="h-3 w-3" /> SIM</span>}
                          {r.classificacao === "nao" && <span className="inline-flex items-center gap-1 text-red-700 font-semibold"><XCircle className="h-3 w-3" /> NÃO</span>}
                          {r.classificacao === "outro" && <span className="inline-flex items-center gap-1 text-amber-700"><HelpCircle className="h-3 w-3" /> Outro</span>}
                        </TableCell>
                        <TableCell className="text-[11px]">
                          <div>{r.acao}</div>
                          {r.alerta && (
                            <div className="text-red-700 text-[10px] font-medium mt-0.5 flex items-center gap-1">
                              <AlertTriangle className="h-2.5 w-2.5" /> {r.alerta}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
