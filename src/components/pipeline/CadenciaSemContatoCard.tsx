import { useEffect, useState } from "react";
import { Phone, MessageCircle, RefreshCcw, AlertTriangle, CheckCircle2, Repeat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { nowBRT } from "@/lib/brtTime";

interface CadenciaSemContatoCardProps {
  leadId: string;
  stageTipo?: string | null;
  leadNome?: string | null;
  leadEmpreendimento?: string | null;
}

interface CadenciaRow {
  tentativa_atual: number;
  proxima_em: string | null;
  status: string;
}

interface PassoRow {
  numero: number;
  acao: string;
  canal: string;
  texto_app: string;
}

const TOTAL_PASSOS = 7;

function canalIcon(canal: string) {
  if (canal === "ligacao") return <Phone className="h-3.5 w-3.5" />;
  if (canal === "whatsapp") return <MessageCircle className="h-3.5 w-3.5" />;
  return <RefreshCcw className="h-3.5 w-3.5" />;
}

function aplicarPlaceholders(texto: string, nome?: string | null, emp?: string | null): string {
  return (texto || "")
    .replace(/\{nome\}/g, (nome || "o lead").trim() || "o lead")
    .replace(/\{empreendimento\}/g, (emp || "o empreendimento").trim() || "o empreendimento");
}

function formatRelativo(target: string): string {
  const diffMs = new Date(target).getTime() - nowBRT().getTime();
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60000);
  const horas = Math.floor(mins / 60);
  const dias = Math.floor(horas / 24);
  let unidade: string;
  if (dias >= 1) unidade = `${dias} dia${dias > 1 ? "s" : ""}`;
  else if (horas >= 1) unidade = `${horas}h`;
  else unidade = `${Math.max(mins, 1)}min`;
  return diffMs >= 0 ? `vence em ${unidade}` : `atrasado há ${unidade}`;
}

export default function CadenciaSemContatoCard({ leadId, stageTipo, leadNome, leadEmpreendimento }: CadenciaSemContatoCardProps) {
  const [cadencia, setCadencia] = useState<CadenciaRow | null>(null);
  const [passos, setPassos] = useState<PassoRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const isSemContato = stageTipo === "sem_contato";

  useEffect(() => {
    if (!isSemContato || !leadId) return;
    let active = true;
    (async () => {
      const [cad, ps] = await Promise.all([
        supabase
          .from("lead_cadencia_sem_contato")
          .select("tentativa_atual, proxima_em, status")
          .eq("pipeline_lead_id", leadId)
          .maybeSingle(),
        supabase
          .from("cadencia_sem_contato_passos")
          .select("numero, acao, canal, texto_app")
          .order("numero", { ascending: true }),
      ]);
      if (!active) return;
      setCadencia((cad.data as CadenciaRow) ?? null);
      setPassos((ps.data as PassoRow[]) ?? []);
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [leadId, isSemContato]);

  if (!isSemContato || !loaded) return null;

  const concluida = cadencia?.status === "concluida";
  // tentativa_atual é o último passo executado; o passo "a fazer agora" é o próximo.
  const feitos = cadencia?.tentativa_atual ?? 0;
  const atualNum = Math.min(feitos + 1, TOTAL_PASSOS);
  const passoAtual = passos.find((p) => p.numero === atualNum);
  // Só a ÚLTIMA etapa real (passo 7 = despedida) alerta sobre estagnação.
  const ultimaEtapa = !concluida && atualNum >= TOTAL_PASSOS;
  const progresso = Math.round((Math.min(feitos, TOTAL_PASSOS) / TOTAL_PASSOS) * 100);

  const acaoTxt = passoAtual ? aplicarPlaceholders(passoAtual.acao, leadNome, leadEmpreendimento) : "";
  const passoTxt = passoAtual ? aplicarPlaceholders(passoAtual.texto_app, leadNome, leadEmpreendimento) : "";

  return (
    <div className="rounded-xl border bg-card p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <Repeat className="h-3.5 w-3.5" />
          Cadência Sem Contato
        </div>
        <span className="text-[11px] font-semibold text-muted-foreground">
          Tentativa {atualNum} / {TOTAL_PASSOS}
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${ultimaEtapa ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${progresso}%` }}
        />
      </div>

      {concluida ? (
        <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-2.5">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[12px] text-muted-foreground leading-snug">
            Cadência esgotada — o lead foi para a Central de Leads Estagnados.
          </p>
        </div>
      ) : ultimaEtapa && passoAtual ? (
        /* Passo 7 (despedida): UM único bloco, sem duplicar aviso */
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/25 p-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[12.5px] font-semibold text-foreground leading-tight">
                Última etapa — {acaoTxt}
              </p>
              <p className="text-[12px] text-muted-foreground leading-snug">
                {passoTxt}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-destructive/90 px-0.5 font-medium">
            Sem retorno em 48h, o lead será estagnado e sairá do seu pipeline.
            {cadencia?.proxima_em && <> Prazo {formatRelativo(cadencia.proxima_em)}.</>}
          </p>
        </div>
      ) : passoAtual ? (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/15 p-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              {canalIcon(passoAtual.canal)}
            </div>
            <div className="space-y-0.5">
              <p className="text-[12.5px] font-semibold text-foreground leading-tight">
                Agora: {acaoTxt}
              </p>
              <p className="text-[12px] text-muted-foreground leading-snug">
                {passoTxt}
              </p>
            </div>
          </div>

          {cadencia?.proxima_em && (
            <p className="text-[11px] text-muted-foreground px-0.5">
              Próximo passo {formatRelativo(cadencia.proxima_em)}.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
