import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone, MessageCircle, CheckCircle2, PhoneMissed, XCircle, Shuffle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatBRT } from "@/lib/brtTime";

export type PortaBolsao = "estagnados" | "descartados";

interface BolsaoLead {
  id: string;
  nome: string;
  telefone: string | null;
  origem: string | null;
  entrou_em: string;
  empreendimento: string;
  reservado_ate: string;
}

const TEXTO_PORTA: Record<PortaBolsao, string> = {
  estagnados: "Cliente que não teve sequência. Se você aproveitar, ele é seu.",
  descartados: "Cliente descartado há algum tempo. Pode ter mudado de ideia: se aproveitar, ele é seu.",
};

function soDigitos(t: string | null) {
  return (t ?? "").replace(/\D/g, "");
}

export default function BolsaoDiscador({ porta }: { porta: PortaBolsao }) {
  const qc = useQueryClient();
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [lead, setLead] = useState<BolsaoLead | null>(null);
  const [vazio, setVazio] = useState(false);
  const [busy, setBusy] = useState(false);

  const contagens = useQuery({
    queryKey: ["bolsao-contagens", porta],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("bolsao_contagens", { p_porta: porta });
      if (error) throw error;
      return (data ?? []) as { empreendimento: string; total: number }[];
    },
    staleTime: 60_000,
  });

  const total = (contagens.data ?? []).reduce((s, c) => s + Number(c.total), 0);

  const toggle = (emp: string) =>
    setSelecionados((prev) => (prev.includes(emp) ? prev.filter((e) => e !== emp) : [...prev, emp]));

  const puxar = async () => {
    setBusy(true);
    setVazio(false);
    try {
      const { data, error } = await supabase.rpc("bolsao_puxar", {
        p_porta: porta,
        p_empreendimentos: selecionados.length ? selecionados : null,
      });
      if (error) throw error;
      const res = data as { ok: boolean; lead: BolsaoLead | null; error?: string };
      if (!res.ok) throw new Error(res.error ?? "Erro ao puxar cliente");
      setLead(res.lead);
      if (!res.lead) setVazio(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const registrar = async (resultado: "nao_atendeu" | "sem_interesse" | "liberar") => {
    if (!lead) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("bolsao_registrar", { p_lead_id: lead.id, p_resultado: resultado });
    setBusy(false);
    const res = data as { ok: boolean; error?: string } | null;
    if (error || !res?.ok) {
      toast.error(res?.error === "reserva_nao_encontrada" ? "A reserva expirou. Puxe outro cliente." : "Erro ao registrar.");
      setLead(null);
      return;
    }
    if (resultado === "nao_atendeu") toast.success("Ok, ele volta para a lista amanhã.");
    if (resultado === "sem_interesse") toast.success("Cliente marcado como sem interesse.");
    setLead(null);
    qc.invalidateQueries({ queryKey: ["bolsao-contagens", porta] });
    if (resultado !== "liberar") puxar();
  };

  const aproveitar = async () => {
    if (!lead) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("bolsao-aproveitar", {
      body: { pipeline_lead_id: lead.id },
    });
    setBusy(false);
    const res = data as { ok?: boolean; error?: string } | null;
    if (error || !res?.ok) {
      const msg =
        res?.error === "DUPLICATE_ACTIVE"
          ? "Esse telefone já está ativo com outro corretor."
          : res?.error === "RESERVA_EXPIRADA"
            ? "A reserva expirou. Puxe outro cliente."
            : "Não foi possível aproveitar.";
      toast.error(msg);
      setLead(null);
      return;
    }
    toast.success(`${lead.nome} agora está no seu pipeline, em Novo Lead.`);
    setLead(null);
    qc.invalidateQueries({ queryKey: ["bolsao-contagens", porta] });
  };

  if (lead) {
    const fone = soDigitos(lead.telefone);
    return (
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-xl font-bold">{lead.nome}</div>
            <div className="text-sm text-muted-foreground">
              {lead.telefone ?? "Sem telefone"} · {lead.empreendimento}
              {lead.origem ? ` · ${lead.origem}` : ""} · entrou em {formatBRT(lead.entrou_em, "dd/MM/yyyy")}
            </div>
          </div>
          <span className="rounded-md bg-warning/15 px-2 py-1 text-xs font-medium text-warning-foreground">
            Pode ser seu
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {TEXTO_PORTA[porta]} Reservado para você até {formatBRT(lead.reservado_ate, "HH:mm")}.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" disabled={!fone}>
            <a href={`tel:+${fone}`}><Phone className="mr-1 h-4 w-4" /> Ligar</a>
          </Button>
          <Button asChild variant="outline" size="sm" disabled={!fone}>
            <a href={`https://wa.me/${fone}`} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
            </a>
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button onClick={aproveitar} disabled={busy} className="gap-1">
            <CheckCircle2 className="h-4 w-4" /> Aproveitar
          </Button>
          <Button variant="outline" onClick={() => registrar("nao_atendeu")} disabled={busy} className="gap-1">
            <PhoneMissed className="h-4 w-4" /> Não atendeu
          </Button>
          <Button variant="outline" onClick={() => registrar("sem_interesse")} disabled={busy} className="gap-1 text-destructive">
            <XCircle className="h-4 w-4" /> Sem interesse
          </Button>
          <Button variant="ghost" onClick={() => registrar("liberar")} disabled={busy}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="text-sm font-semibold">Empreendimento</div>
      {contagens.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelecionados([])}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium ${
              selecionados.length === 0 ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
            }`}
          >
            <Shuffle className="h-3 w-3" /> Aleatório · {total}
          </button>
          {(contagens.data ?? []).map((c) => (
            <button
              key={c.empreendimento}
              onClick={() => toggle(c.empreendimento)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                selecionados.includes(c.empreendimento)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {c.empreendimento} · {c.total}
            </button>
          ))}
        </div>
      )}
      {vazio && <p className="text-sm text-muted-foreground">Nenhum cliente disponível com esse filtro agora.</p>}
      <Button onClick={puxar} disabled={busy || total === 0} className="gap-1">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />} Começar a ligar
      </Button>
    </div>
  );
}
