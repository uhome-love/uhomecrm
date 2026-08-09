import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, Send, Trash2, ShieldAlert, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { formatBRT } from "@/lib/brtTime";

type Trava = { codigo: string; detalhe: string };

type ContextoTurno = {
  apresentacao_aceita?: boolean;
  visita_confirmada_em?: string | null;
} | null;

type Turno = {
  id: string;
  ia_lead_id: string;
  status: string;
  texto_proposto: string | null;
  texto_editado: string | null;
  editado: boolean;
  midias: Array<{ rotulo: string; url: string }> | null;
  etapa_proposta: string | null;
  travas: Trava[] | null;
  bloqueado_por: string | null;
  modelo: string | null;
  horarios_ofertados: string[] | null;
  contexto: ContextoTurno;
  enviado_em: string | null;
  created_at: string;
};

type LeadResumo = { id: string; nome: string | null; telefone: string | null; etapa: string };


const FILTROS = [
  { valor: "proposto", rotulo: "Aguardando você" },
  { valor: "bloqueado", rotulo: "Bloqueados" },
  { valor: "enviado", rotulo: "Enviados" },
] as const;

export default function LiaSalaAoVivo() {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["valor"]>("proposto");
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [leads, setLeads] = useState<Record<string, LeadResumo>>({});
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from("ia_turnos")
      .select("*")
      .eq("status", filtro)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      toast.error("Não consegui carregar os turnos");
      setCarregando(false);
      return;
    }

    const lista = (data ?? []) as unknown as Turno[];
    setTurnos(lista);

    const ids = [...new Set(lista.map((t) => t.ia_lead_id))];
    if (ids.length > 0) {
      const { data: leadRows } = await supabase
        .from("ia_leads")
        .select("id, nome, telefone, etapa")
        .in("id", ids);
      const mapa: Record<string, LeadResumo> = {};
      for (const l of (leadRows ?? []) as LeadResumo[]) mapa[l.id] = l;
      setLeads(mapa);
    }
    setCarregando(false);
  }, [filtro]);

  useEffect(() => {
    setCarregando(true);
    void carregar();
    const t = setInterval(() => void carregar(), 15000);
    return () => clearInterval(t);
  }, [carregar]);

  const acao = useCallback(
    async (turno: Turno, action: "enviar_turno" | "descartar_turno") => {
      setOcupado(turno.id);
      try {
        const texto = rascunhos[turno.id];
        const { data, error } = await supabase.functions.invoke("lia-brain", {
          body: {
            action,
            turno_id: turno.id,
            ...(action === "enviar_turno" && texto !== undefined ? { texto } : {}),
          },
        });
        if (error) throw error;
        const resp = data as { ok?: boolean; status?: string; travas?: Trava[]; motivo?: string };
        if (resp?.ok === false) {
          const detalhe = resp.travas?.map((t) => t.codigo).join(", ") ?? resp.motivo ?? resp.status;
          toast.error(`Não enviei: ${detalhe}`);
        } else if (action === "enviar_turno") {
          toast.success(resp?.status === "enviado" ? "Enviada" : `Resultado: ${resp?.status}`);
        } else {
          toast.success("Turno descartado");
        }
        await carregar();
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setOcupado(null);
      }
    },
    [carregar, rascunhos],
  );

  // O que converte é o REGISTRO, não o JSON do modelo. Estas duas ações são o
  // caminho humano (sombra e assistido); no autônomo o próprio cérebro grava,
  // depois das travas. O gatilho no banco é quem manda o evento ao Meta.
  const registrar = useCallback(
    async (turno: Turno, campo: "aceite_em" | "confirmada_em", horario?: string) => {
      setOcupado(turno.id);
      try {
        let quando = new Date().toISOString();
        if (campo === "confirmada_em") {
          if (!horario) throw new Error("Escolha um horário da lista gerada pelo sistema.");
          const [hh, mm] = horario.split(":").map(Number);
          const alvo = new Date();
          alvo.setHours(hh, mm ?? 0, 0, 0);
          if (alvo.getTime() < Date.now()) alvo.setDate(alvo.getDate() + 1);
          quando = alvo.toISOString();
        }

        const { data: existente } = await supabase
          .from("ia_apresentacoes")
          .select("id, aceite_em, confirmada_em")
          .eq("ia_lead_id", turno.ia_lead_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existente?.[campo]) {
          toast.info("Esse registro já estava preenchido. O evento sai uma vez só.");
          return;
        }

        const patch =
          campo === "aceite_em"
            ? { aceite_em: quando }
            : { confirmada_em: quando, data_hora: quando };

        const { error } = existente
          ? await supabase.from("ia_apresentacoes").update(patch).eq("id", existente.id)
          : await supabase.from("ia_apresentacoes").insert({
              ia_lead_id: turno.ia_lead_id,
              status: campo === "aceite_em" ? "aceita" : "confirmada",
              lia_responsavel: true,
              ...patch,
            });
        if (error) throw error;

        toast.success(
          campo === "aceite_em"
            ? "Apresentação aceita registrada. O evento de lead qualificado sai pelo gatilho."
            : `Visita confirmada para ${horario}. O evento de visita marcada sai pelo gatilho.`,
        );
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setOcupado(null);
      }
    },
    [],
  );


  const vazio = useMemo(() => !carregando && turnos.length === 0, [carregando, turnos]);

  return (
    <div className="container mx-auto max-w-4xl space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Lia · sala ao vivo</h1>
          <p className="text-sm text-muted-foreground">
            No modo sombra a Lia propõe e você decide. Enviar sem editar é o que conta para a
            liberação.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void carregar()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </header>

      <Tabs value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
        <TabsList>
          {FILTROS.map((f) => (
            <TabsTrigger key={f.valor} value={f.valor}>
              {f.rotulo}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {carregando && (
        <div className="flex items-center gap-2 p-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando turnos…
        </div>
      )}

      {vazio && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum turno nesta lista.
          </CardContent>
        </Card>
      )}

      {turnos.map((turno) => {
        const lead = leads[turno.ia_lead_id];
        const original = turno.texto_proposto ?? "";
        const valor = rascunhos[turno.id] ?? turno.texto_editado ?? original;
        const foiEditado = valor.trim() !== original.trim();

        return (
          <Card key={turno.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  {lead?.nome ?? "Lead sem nome"}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {lead?.telefone ?? ""}
                  </span>
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {turno.etapa_proposta && <Badge variant="secondary">{turno.etapa_proposta}</Badge>}
                  {turno.modelo && <Badge variant="outline">{turno.modelo}</Badge>}
                  <Badge variant={turno.status === "bloqueado" ? "destructive" : "default"}>
                    {turno.status}
                  </Badge>
                </div>
              </div>
              <CardDescription>
                {formatBRT(turno.created_at, "dd/MM HH:mm")}
                {turno.enviado_em ? ` · enviado ${formatBRT(turno.enviado_em, "dd/MM HH:mm")}` : ""}
                {turno.editado ? " · enviado com edição" : ""}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {turno.status === "enviado" ? (
                <div className="space-y-2">
                  <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
                    {turno.texto_editado ?? original}
                  </p>
                  {turno.editado && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Ver texto original da Lia</summary>
                      <p className="mt-2 whitespace-pre-wrap">{original}</p>
                    </details>
                  )}
                </div>
              ) : (
                <Textarea
                  value={valor}
                  rows={5}
                  onChange={(e) =>
                    setRascunhos((r) => ({ ...r, [turno.id]: e.target.value }))
                  }
                />
              )}

              {(turno.midias?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-2">
                  {turno.midias!.map((m) => (
                    <Badge key={m.rotulo} variant="outline" className="gap-1">
                      <ImageIcon className="h-3 w-3" />
                      {m.rotulo}
                    </Badge>
                  ))}
                </div>
              )}

              {(turno.travas?.length ?? 0) > 0 && (
                <div className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <ShieldAlert className="h-4 w-4" />
                    Travas que impediram o envio automático
                  </p>
                  <ul className="space-y-0.5 text-xs text-muted-foreground">
                    {turno.travas!.map((t) => (
                      <li key={t.codigo}>
                        <span className="font-mono">{t.codigo}</span> · {t.detalhe}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Conversão sai daqui, do registro — nunca do que o modelo escreveu.
                  O JSON do turno é só sugestão para o humano conferir. */}
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Registro (é o que dispara a conversão no Meta)
                </p>
                {(turno.contexto?.apresentacao_aceita || turno.contexto?.visita_confirmada_em) && (
                  <p className="text-xs text-muted-foreground">
                    A Lia sugeriu:{" "}
                    {turno.contexto?.apresentacao_aceita ? "apresentação aceita" : ""}
                    {turno.contexto?.apresentacao_aceita && turno.contexto?.visita_confirmada_em
                      ? " e "
                      : ""}
                    {turno.contexto?.visita_confirmada_em
                      ? `visita em ${formatBRT(turno.contexto.visita_confirmada_em, "dd/MM HH:mm")}`
                      : ""}
                    . Sugestão não converte nada — confirme abaixo.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={ocupado === turno.id}
                    onClick={() => void registrar(turno, "aceite_em")}
                  >
                    Apresentação aceita
                  </Button>
                  {(turno.horarios_ofertados?.length ?? 0) > 0 && (
                    <div className="flex items-center gap-2">
                      <Select
                        value={horarioEscolhido[turno.id] ?? ""}
                        onValueChange={(v) => setHorarioEscolhido((h) => ({ ...h, [turno.id]: v }))}
                      >
                        <SelectTrigger className="h-9 w-[150px]">
                          <SelectValue placeholder="Horário ofertado" />
                        </SelectTrigger>
                        <SelectContent>
                          {turno.horarios_ofertados!.map((h) => (
                            <SelectItem key={h} value={h}>
                              {h}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={ocupado === turno.id || !horarioEscolhido[turno.id]}
                        onClick={() =>
                          void registrar(turno, "confirmada_em", horarioEscolhido[turno.id])
                        }
                      >
                        Confirmar visita
                      </Button>
                    </div>
                  )}
                </div>
              </div>


              {turno.status !== "enviado" && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    disabled={ocupado === turno.id || !valor.trim()}
                    onClick={() => void acao(turno, "enviar_turno")}
                  >
                    {ocupado === turno.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    {foiEditado ? "Enviar editada" : "Enviar como está"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={ocupado === turno.id}
                    onClick={() => void acao(turno, "descartar_turno")}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Descartar
                  </Button>
                  {foiEditado && (
                    <span className="text-xs text-muted-foreground">
                      Edição registrada ao lado do texto original.
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
