/**
 * Adaptador único da fila de ligação: Listas (oferta_ativa_leads) e Bolsão (estagnados/descartados)
 * expõem a mesma interface proximo/registrar/pular/sair. Só usa as funções de servidor já existentes
 * (fetch_next_lead_campaign, finalizar_tentativa_v2, skip_oa_lead, bolsao_puxar/registrar, bolsao-aproveitar),
 * então ranking, TV e relatórios continuam lendo a mesma fonte.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { createVisitaFromOA } from "@/hooks/useVisitas";
import type { ClienteOA, ExtrasResultado, OrigemOA, ResultadoOA } from "./tipos";
import { ROTULO_RESULTADO } from "./tipos";

interface LeadLista { id: string; lista_id: string; nome: string; telefone: string | null; empreendimento: string | null; origem: string | null; data_lead: string | null; observacoes: string | null; tentativas_count: number }
interface LeadBolsao { id: string; nome: string; telefone: string | null; origem: string | null; entrou_em: string; empreendimento: string }

const deLista = (l: LeadLista): ClienteOA => ({ id: l.id, nome: l.nome, telefone: l.telefone, empreendimento: l.empreendimento, origemLead: l.origem, entrouEm: l.data_lead, observacoes: l.observacoes, tentativas: l.tentativas_count ?? 0, listaId: l.lista_id });
const deBolsao = (l: LeadBolsao): ClienteOA => ({ id: l.id, nome: l.nome, telefone: l.telefone, empreendimento: l.empreendimento, origemLead: l.origem, entrouEm: l.entrou_em, observacoes: null, tentativas: 0, listaId: null });

const ERRO_APROVEITAR: Record<string, string> = {
  DUPLICATE_ACTIVE: "Esse telefone já está ativo com outro corretor.",
  RESERVA_DE_OUTRO: "Sua reserva venceu e outro corretor já pegou esse cliente.",
  NAO_ELEGIVEL: "Esse cliente não está mais disponível.",
};

interface Opcoes { origem: OrigemOA; listaIds: string[]; empreendimentos: string[] }

export function useFilaOA({ origem, listaIds, empreendimentos }: Opcoes) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [cliente, setCliente] = useState<ClienteOA | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [vazio, setVazio] = useState(false);
  const batida = useRef<ReturnType<typeof setInterval> | null>(null);
  const ehLista = origem === "listas";

  const atualizarPlacar = useCallback(() => {
    for (const k of ["corretor-daily-stats", "oa-ranking-ligacoes", "bolsao-contagens", "oa-listas-batch-stats", "oa-ranking", "oa-aproveitados", "visitas", "pipeline"]) {
      qc.invalidateQueries({ queryKey: [k] });
    }
  }, [qc]);

  // Renova a reserva do lead de lista enquanto o corretor está nele (mesma regra de 5 min).
  useEffect(() => {
    if (!ehLista || !cliente || !user) return;
    const renovar = () => void supabase.rpc("renew_lead_lock", { p_lead_id: cliente.id, p_corretor_id: user.id, p_lock_minutes: 5 });
    renovar();
    batida.current = setInterval(renovar, 60_000);
    window.addEventListener("focus", renovar);
    return () => { if (batida.current) clearInterval(batida.current); window.removeEventListener("focus", renovar); };
  }, [ehLista, cliente, user]);

  const proximo = useCallback(async () => {
    if (!user) return null;
    setCarregando(true);
    setVazio(false);
    try {
      if (ehLista) {
        const { data, error } = await supabase.rpc("fetch_next_lead_campaign", { p_corretor_id: user.id, p_lista_ids: listaIds, p_lock_minutes: 5 });
        if (error) throw error;
        const r = data as { found?: boolean; lead?: LeadLista } | null;
        const c = r?.found && r.lead ? deLista(r.lead) : null;
        setCliente(c); setVazio(!c);
        return c;
      }
      const { data, error } = await supabase.rpc("bolsao_puxar", { p_porta: origem, p_empreendimentos: empreendimentos.length ? empreendimentos : null });
      if (error) throw error;
      const r = data as { ok: boolean; lead: LeadBolsao | null; error?: string };
      if (!r.ok) throw new Error(r.error ?? "Erro ao buscar cliente");
      const c = r.lead ? deBolsao(r.lead) : null;
      setCliente(c); setVazio(!c);
      return c;
    } catch (e) {
      console.error("[OA] proximo", e);
      toast.error("Não consegui buscar o próximo cliente. Tente de novo.");
      return null;
    } finally {
      setCarregando(false);
    }
  }, [user, ehLista, listaIds, origem, empreendimentos]);

  /** Registra o histórico no card do Pipeline quando o telefone já é um lead do próprio corretor (regra antiga mantida). */
  const anotarNoPipeline = async (c: ClienteOA, rotulo: string, nota: string) => {
    const fone = (c.telefone ?? "").replace(/\D/g, "");
    if (!user || fone.length < 8) return;
    try {
      const { data: pl } = await supabase.from("pipeline_leads").select("id").eq("corretor_id", user.id).ilike("telefone", `%${fone.slice(-8)}`).limit(1).maybeSingle();
      if (!pl) return;
      await supabase.from("pipeline_atividades").insert({ pipeline_lead_id: pl.id, created_by: user.id, tipo: "contato", titulo: `[Oferta Ativa] Ligação: ${rotulo}`, descricao: nota || null, status: "concluida", prioridade: "normal", data: new Date().toISOString().slice(0, 10) });
      await supabase.from("pipeline_leads").update({ ultima_acao_at: new Date().toISOString() }).eq("id", pl.id);
    } catch (e) { console.warn("[OA] anotar no pipeline", e); }
  };

  const salvarVisita = async (c: ClienteOA, pipelineLeadId: string | undefined, extras: ExtrasResultado, attemptId?: string) => {
    if (!user) return false;
    const v = await createVisitaFromOA({ corretorId: user.id, leadId: ehLista ? c.id : undefined, pipelineLeadId, nomeCliente: c.nome, telefone: c.telefone ?? undefined, empreendimento: c.empreendimento ?? undefined, attemptId, observacoes: extras.nota, dataVisita: extras.dataVisita, horaVisita: extras.horaVisita });
    return !!v;
  };

  /** Grava o resultado. Retorna true quando gravou (a tela então chama o próximo). */
  const registrar = useCallback(async (resultado: ResultadoOA, extras: ExtrasResultado = {}): Promise<boolean> => {
    const c = cliente;
    if (!c || !user || gravando) return false;
    setGravando(true);
    const nota = extras.nota?.trim() || ROTULO_RESULTADO[resultado];
    try {
      if (ehLista) {
        const aproveitou = resultado === "aproveitar" || resultado === "visita";
        const { data, error } = await supabase.rpc("finalizar_tentativa_v2", {
          p_lead_id: c.id, p_corretor_id: user.id, p_canal: "ligacao", p_resultado: aproveitou ? "com_interesse" : resultado,
          p_feedback: nota, p_lista_id: c.listaId, p_empreendimento: c.empreendimento, p_idempotency_key: `${user.id}_${c.id}_${resultado}_${Date.now()}`,
          p_visita_marcada: resultado === "visita", p_interesse_tipo: resultado === "visita" ? "visita_marcada" : aproveitou ? "pediu_informacoes" : null,
        });
        const r = data as { success?: boolean; reason?: string; attempt_id?: string; pipeline_lead_id?: string } | null;
        if (error || !r?.success) {
          const msg = r?.reason === "already_approved" || r?.reason === "phone_already_approved" ? "Esse cliente já foi aproveitado por outro corretor." : "Não consegui gravar. Tente de novo.";
          toast.error(msg);
          if (r?.reason && r.reason !== "error") setCliente(null);
          return false;
        }
        if (!aproveitou) void anotarNoPipeline(c, ROTULO_RESULTADO[resultado], extras.nota ?? "");
        if (resultado === "visita" && !(await salvarVisita(c, r.pipeline_lead_id, extras, r.attempt_id))) {
          toast.error("Cliente aproveitado, mas a visita não foi salva. Confira a Agenda.");
        }
      } else if (resultado === "aproveitar" || resultado === "visita") {
        const { data, error } = await supabase.functions.invoke("bolsao-aproveitar", { body: { pipeline_lead_id: c.id } });
        const r = data as { ok?: boolean; error?: string } | null;
        if (error || !r?.ok) {
          toast.error(ERRO_APROVEITAR[r?.error ?? ""] ?? "Não consegui aproveitar agora. Tente de novo.");
          if (r?.error && ERRO_APROVEITAR[r.error]) setCliente(null);
          return false;
        }
        if (resultado === "visita" && !(await salvarVisita(c, c.id, extras))) {
          toast.error("Cliente aproveitado, mas a visita não foi salva. Confira a Agenda.");
        }
      } else {
        const { data, error } = await supabase.rpc("bolsao_registrar", { p_lead_id: c.id, p_resultado: resultado });
        const r = data as { ok?: boolean; error?: string } | null;
        if (error || !r?.ok) {
          const deOutro = r?.error === "reserva_nao_encontrada";
          toast.error(deOutro ? "Outro corretor já pegou esse cliente." : "Não consegui gravar. Tente de novo.");
          if (deOutro) setCliente(null);
          return false;
        }
      }
      atualizarPlacar();
      return true;
    } catch (e) {
      console.error("[OA] registrar", e);
      toast.error("Sem conexão. Nada foi gravado, tente de novo.");
      return false;
    } finally {
      setGravando(false);
    }
  }, [cliente, user, gravando, ehLista, atualizarPlacar]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Pula sem contar ligação: lista volta em 30 min; Bolsão só libera a reserva. */
  const pular = useCallback(async () => {
    const c = cliente;
    if (!c || !user || gravando) return;
    setGravando(true);
    try {
      if (ehLista) await supabase.rpc("skip_oa_lead", { p_lead_id: c.id, p_corretor_id: user.id, p_lista_id: c.listaId, p_skip_minutes: 30, p_session_id: null });
      else await supabase.rpc("bolsao_registrar", { p_lead_id: c.id, p_resultado: "liberar" });
    } finally {
      setGravando(false);
    }
    await proximo();
  }, [cliente, user, gravando, ehLista, proximo]);

  /** Sai liberando o cliente atual para outro corretor. */
  const sair = useCallback(async () => {
    const c = cliente;
    setCliente(null);
    if (!c || !user) return;
    if (ehLista) await supabase.from("oferta_ativa_leads").update({ em_atendimento_por: null, em_atendimento_ate: null }).eq("id", c.id);
    else await supabase.rpc("bolsao_registrar", { p_lead_id: c.id, p_resultado: "liberar" });
    qc.invalidateQueries({ queryKey: ["bolsao-contagens"] });
    qc.invalidateQueries({ queryKey: ["oa-listas-batch-stats"] });
  }, [cliente, user, ehLista, qc]);

  return { cliente, carregando, gravando, vazio, proximo, registrar, pular, sair };
}
