import { useMemo } from "react";
import { todayBRT, dateToBRT } from "@/lib/brtTime";
import {
  useLiaConversasHoje, useLiaEstados, useLiaFollowups, useLiaPipelineLeads, useLiaCusto,
  produtosDeEstados, type LiaEstado,
} from "./useLiaHub";

// Fonte única dos números da Visão geral da Lia (mesmas contas do painel antigo).
export function useLiaPainelDados(produto: string) {
  const { data: estadosRaw, isLoading } = useLiaEstados();
  const { data: conversasHoje, isLoading: loadingConv } = useLiaConversasHoje();
  const { data: followups } = useLiaFollowups();
  const { data: pipeRaw } = useLiaPipelineLeads();
  const { data: custo, isLoading: loadingCusto } = useLiaCusto();

  const produtos = useMemo(() => produtosDeEstados(estadosRaw), [estadosRaw]);
  // filtra na fonte: com um imóvel escolhido, TODOS os KPIs/funil abaixo recalculam sozinhos.
  const estados = useMemo(
    () => (produto === "todos" ? estadosRaw : (estadosRaw ?? []).filter((e) => chaveImovel(e.produto_slug) === produto)),
    [estadosRaw, produto],
  );
  const pipe = useMemo(() => {
    if (produto === "todos" || !pipeRaw) return pipeRaw;
    const ids = new Set((estados ?? []).map((e) => e.lead_id).filter(Boolean));
    return { ...pipeRaw, leads: (pipeRaw.leads ?? []).filter((l: any) => ids.has(l.id)) };
  }, [pipeRaw, estados, produto]);

  const hoje = todayBRT();

  const kpis = useMemo(() => {
    const list: LiaEstado[] = estados ?? [];
    const telsProduto = new Set(list.map((e) => e.telefone));
    const conversasHojeCount = new Set(
      (conversasHoje ?? []).filter((c) => c.role === "user" && telsProduto.has(c.telefone)).map((c) => c.telefone)
    ).size;
    const novosHoje = list.filter(
      (e) => e.last_msg_em && dateToBRT(e.last_msg_em) === hoje && e.status === "novo"
    ).length;
    const qualificadosHoje = list.filter(
      (e) => e.qualificado_em && dateToBRT(e.qualificado_em) === hoje
    ).length;
    const quentesHoje = list.filter(
      (e) => e.nivel === "quente" && e.qualificado_em && dateToBRT(e.qualificado_em) === hoje
    ).length;
    const agendadasHoje = list.filter(
      (e) => e.agendou && e.agendou_em && dateToBRT(e.agendou_em) === hoje
    ).length;
    return { conversasHojeCount, novosHoje, qualificadosHoje, quentesHoje, agendadasHoje };
  }, [estados, conversasHoje, hoje]);

  const funil = useMemo(() => {
    const list: LiaEstado[] = estados ?? [];
    const falaram = list.length;
    const responderam = list.filter((e) => !!e.last_user_at).length;
    const engajaram = list.filter(
      (e) => e.status === "em_conversa" || e.status === "qualificado"
    ).length;
    const qualificados = list.filter((e) => e.status === "qualificado").length;
    const agendaram = list.filter((e) => e.agendou).length;
    const porNivel = (n: string) =>
      list.filter((e) => e.status === "qualificado" && String(e.nivel ?? "").toLowerCase() === n).length;

    // etapas reais do pipeline pros leads da LIA: visita (ordem>=4) e venda (tipo=venda)
    const leads = pipe?.leads ?? [];
    const stages = pipe?.stages;
    let visitaram = 0;
    let venderam = 0;
    for (const l of leads) {
      const s = l.stage_id && stages ? stages.get(l.stage_id) : undefined;
      if (!s) continue;
      if (s.tipo === "venda") venderam++;
      if (s.ordem >= 4 && s.ordem <= 9) visitaram++; // Visita..Ganho, fora de Caiu/Descarte
    }
    return {
      falaram,
      responderam,
      engajaram,
      qualificados,
      agendaram,
      visitaram,
      venderam,
      quente: porNivel("quente"),
      morno: porNivel("morno"),
      frio: porNivel("frio"),
    };
  }, [estados, pipe]);

  const atencao = useMemo(() => {
    const list: LiaEstado[] = estados ?? [];
    const pendentes = (followups ?? []).filter((f) => f.status === "pendente");
    const telsPendentes = new Set(pendentes.map((f) => f.telefone));
    const naFila = list.filter((e) => e.status === "qualificado" && !e.lead_id).length;
    const esfriando = list.filter((e) => telsPendentes.has(e.telefone)).length;
    const optoutsHoje = list.filter(
      (e) => e.status === "opt_out" && e.last_msg_em && dateToBRT(e.last_msg_em) === hoje
    ).length;
    // quentes que ainda NÃO marcaram apresentação: o time tem que atacar agora
    const quentesSemAgenda = list.filter(
      (e) => e.status === "qualificado" && String(e.nivel ?? "").toLowerCase() === "quente" && !e.agendou
    ).length;
    return { naFila, esfriando, optoutsHoje, quentesSemAgenda };
  }, [estados, followups, hoje]);

  // recuperação: de quem recebeu um follow-up (enviado), quantos voltaram a falar depois dele
  const recuperacao = useMemo(() => {
    const ultimoEnvio = new Map<string, string>();
    for (const f of followups ?? []) {
      if (f.status !== "enviado" || !f.enviado_em || !f.telefone) continue;
      const prev = ultimoEnvio.get(f.telefone);
      if (!prev || f.enviado_em > prev) ultimoEnvio.set(f.telefone, f.enviado_em);
    }
    let voltaram = 0;
    for (const e of estados ?? []) {
      const env = ultimoEnvio.get(e.telefone);
      if (env && e.last_user_at && e.last_user_at > env) voltaram++;
    }
    return { cutucados: ultimoEnvio.size, voltaram };
  }, [followups, estados]);

  // passagem de bastão: quantos leads a LIA avisou do repasse, e quantos o corretor assumiu
  const repasse = useMemo(() => {
    const list: LiaEstado[] = estados ?? [];
    const avisados = list.filter((e) => !!e.repassado_em);
    const leadsAceitos = new Set(
      (pipe?.leads ?? [])
        .filter((l) => l.corretor_id && l.aceite_status === "aceito")
        .map((l) => l.id)
    );
    const assumidos = avisados.filter((e) => e.lead_id && leadsAceitos.has(e.lead_id)).length;
    return { avisados: avisados.length, assumidos };
  }, [estados, pipe]);

  // descartes manuais pelo hub, agrupados por motivo
  const descartes = useMemo(() => {
    const list: LiaEstado[] = estados ?? [];
    const desc = list.filter((e) => e.status === "descartado");
    const porMotivo = new Map<string, number>();
    for (const e of desc) {
      const m = (e.motivo ?? "").trim() || "Sem motivo";
      porMotivo.set(m, (porMotivo.get(m) ?? 0) + 1);
    }
    const linhas = Array.from(porMotivo.entries()).sort((a, b) => b[1] - a[1]);
    return { total: desc.length, linhas };
  }, [estados]);

  return { isLoading, loadingConv, loadingCusto, custo, produtos, kpis, funil, atencao, recuperacao, repasse, descartes };
}
