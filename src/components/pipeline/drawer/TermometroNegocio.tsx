import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import TemperaturaChip from "../TemperaturaChip";
import { RESULTADO_LABELS } from "@/components/visitas/VisitaResultadoDialog";
import { formatBRT } from "@/lib/brtTime";

const fmtData = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : null);

/** Termômetro do negócio: temperatura, situação, próximo passo e última visita — lidos do Pipeline (fonte única). */
export function TermometroNegocio({ leadId, situacao }: { leadId: string; situacao?: string | null }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["termometro-negocio", leadId],
    queryFn: async () => {
      const [lead, visita] = await Promise.all([
        supabase.from("pipeline_leads").select("temperatura,proxima_acao,data_proxima_acao,updated_at").eq("id", leadId).maybeSingle(),
        supabase.from("visitas").select("data_visita,resultado_visita,objecao,observacoes,status")
          .eq("pipeline_lead_id", leadId).in("status", ["realizada", "no_show"])
          .order("data_visita", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (lead.error) throw lead.error;
      return { lead: lead.data, visita: visita.data };
    },
  });
  const [temp, setTemp] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [passo, setPasso] = useState("");
  const [quando, setQuando] = useState("");
  useEffect(() => { setTemp(q.data?.lead?.temperatura ?? null); }, [q.data?.lead?.temperatura]);

  if (q.isPending) return null;
  const lead = q.data?.lead;
  const v = q.data?.visita;
  const objecao = v?.objecao || v?.observacoes?.match(/Objeção: ([^|·]+)/)?.[1]?.trim();

  const salvarPasso = async () => {
    if (passo.trim().length < 3 || !quando) { toast.error("Informe o próximo passo e quando."); return; }
    const { error } = await supabase.from("pipeline_leads")
      .update({ proxima_acao: passo.trim(), data_proxima_acao: quando, ultima_acao_at: new Date().toISOString() }).eq("id", leadId);
    if (error) { toast.error("Não foi possível salvar o próximo passo."); return; }
    toast.success("Próximo passo atualizado");
    setEditando(false);
    void qc.invalidateQueries({ queryKey: ["termometro-negocio", leadId] });
  };

  return (
    <section aria-label="Termômetro do negócio" className="space-y-3 rounded-xl border border-border bg-muted/30 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Termômetro</h3>
        {lead?.updated_at && <span className="text-[11px] text-muted-foreground">Atualizado {formatBRT(lead.updated_at, "dd/MM HH:mm")}</span>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><p className="mb-1 text-[11px] text-muted-foreground">Temperatura</p><TemperaturaChip leadId={leadId} value={temp} onChange={setTemp} /></div>
        <div><p className="mb-1 text-[11px] text-muted-foreground">Situação</p><p className="text-sm font-semibold">{situacao || "—"}</p></div>
      </div>
      <div>
        <p className="mb-1 text-[11px] text-muted-foreground">Próximo passo</p>
        {editando ? (
          <div className="space-y-2">
            <input value={passo} onChange={e => setPasso(e.target.value)} placeholder="Ex.: enviar proposta ajustada"
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm" />
            <div className="flex items-center gap-2">
              <input type="date" aria-label="Quando" value={quando} onChange={e => setQuando(e.target.value)}
                className="flex h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm" />
              <button type="button" aria-label="Salvar próximo passo" onClick={salvarPasso} className="text-primary"><Check className="size-4" /></button>
              <button type="button" aria-label="Cancelar" onClick={() => setEditando(false)} className="text-muted-foreground"><X className="size-4" /></button>
            </div>
          </div>
        ) : (
          <button type="button" className="group flex items-center gap-1.5 text-left text-sm font-semibold hover:text-primary"
            onClick={() => { setPasso(lead?.proxima_acao ?? ""); setQuando(lead?.data_proxima_acao?.slice(0, 10) ?? ""); setEditando(true); }}>
            {lead?.proxima_acao ? `${lead.proxima_acao}${lead.data_proxima_acao ? ` · ${fmtData(lead.data_proxima_acao)}` : ""}` : "Definir próximo passo"}
            <Pencil className="size-3 opacity-50 group-hover:opacity-100" />
          </button>
        )}
      </div>
      {v && (
        <div className="border-t border-border pt-2.5 text-sm">
          <p className="text-[11px] text-muted-foreground">Última visita · {fmtData(v.data_visita)}</p>
          <p className="font-medium">{v.resultado_visita ? RESULTADO_LABELS[v.resultado_visita] || v.resultado_visita : v.status === "no_show" ? "No Show" : "Realizada"}</p>
          {objecao && <p className="text-xs text-muted-foreground">Objeção: {objecao}</p>}
        </div>
      )}
    </section>
  );
}
