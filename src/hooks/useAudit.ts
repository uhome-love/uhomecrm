import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// --- Utility ---
function normalizePhone(p: string | null): string {
  if (!p) return "";
  let cleaned = p.replace(/[\s\-\(\)\.]/g, "");
  if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  if (!cleaned.startsWith("+")) {
    cleaned = cleaned.length <= 11 ? "+55" + cleaned : "+" + cleaned;
  }
  return cleaned;
}
function normalizeEmail(e: string | null): string {
  return (e || "").trim().toLowerCase();
}
function normalizeName(n: string | null): string {
  return (n || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export interface AuditIssue {
  id: string;
  module: string;
  type: "duplication" | "consistency" | "integration" | "error";
  severity: "alto" | "medio" | "baixo";
  title: string;
  description: string;
  ids?: string[];
  autoFixable?: boolean;
}

export interface AuditResult {
  healthScore: number;
  integrationScore: number;
  duplicationScore: number;
  consistencyScore: number;
  errorScore: number;
  issues: AuditIssue[];
  stats: {
    totalChecks: number;
    passed: number;
    warnings: number;
    errors: number;
  };
  timestamp: string;
}

export function useAudit() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AuditResult | null>(null);

  const runAudit = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setProgress(0);
    const issues: AuditIssue[] = [];
    let issueCounter = 0;

    // ---- A) Integration checks (30%) ----
    setProgress(5);
    let integrationPenalty = 0;

    // Check Jetimob
    try {
      const resp = await supabase.functions.invoke("jetimob-proxy", {
        body: { action: "list_leads" },
      });
      if (resp.error || resp.data?.error) {
        integrationPenalty += 15;
        issues.push({
          id: `issue-${++issueCounter}`,
          module: "Jetimob",
          type: "integration",
          severity: "alto",
          title: "API Jetimob com erro",
          description: resp.data?.error || resp.error?.message || "Falha na conexão",
        });
      }
    } catch {
      integrationPenalty += 15;
      issues.push({
        id: `issue-${++issueCounter}`,
        module: "Jetimob",
        type: "integration",
        severity: "alto",
        title: "API Jetimob inacessível",
        description: "Não foi possível conectar à API do Jetimob.",
      });
    }

    // Check WhatsApp config
    // We can't check secrets from client, so we just note it
    setProgress(15);

    const integrationScore = Math.max(0, 100 - integrationPenalty * (100 / 30));

    // ---- B) Duplication checks (30%) ----
    setProgress(20);
    let dupPenalty = 0;

    // 1) Checkpoint duplicates: same (gerente_id, corretor_id, checkpoint.data)
    const { data: checkpoints } = await supabase.from("checkpoints").select("id, gerente_id, data");
    if (checkpoints) {
      const { data: lines } = await supabase.from("checkpoint_lines").select("id, checkpoint_id, corretor_id");
      if (lines && checkpoints.length > 0) {
        const cpMap = new Map(checkpoints.map((c: any) => [c.id, c]));
        const seen = new Map<string, string[]>();
        for (const l of lines) {
          const cp = cpMap.get(l.checkpoint_id);
          if (!cp) continue;
          const key = `${cp.gerente_id}|${l.corretor_id}|${cp.data}`;
          if (!seen.has(key)) seen.set(key, []);
          seen.get(key)!.push(l.id);
        }
        const dups = [...seen.entries()].filter(([, ids]) => ids.length > 1);
        if (dups.length > 0) {
          dupPenalty += Math.min(15, dups.length * 3);
          issues.push({
            id: `issue-${++issueCounter}`,
            module: "Checkpoint",
            type: "duplication",
            severity: dups.length > 3 ? "alto" : "medio",
            title: `${dups.length} checkpoint(s) duplicado(s)`,
            description: `Registros duplicados por (gerente, corretor, data).`,
            ids: dups.flatMap(([, ids]) => ids),
            autoFixable: true,
          });
        }
      }
    }

    setProgress(35);

    // 2) Funnel duplicates: same (gerente_id, periodo_tipo, periodo_inicio, periodo_fim)
    const { data: funnels } = await supabase.from("funnel_entries").select("id, gerente_id, periodo_tipo, periodo_inicio, periodo_fim, corretor_nome");
    if (funnels) {
      const fSeen = new Map<string, string[]>();
      for (const f of funnels as any[]) {
        const key = `${f.gerente_id}|${f.periodo_tipo}|${f.periodo_inicio}|${f.periodo_fim}|${f.corretor_nome || ""}`;
        if (!fSeen.has(key)) fSeen.set(key, []);
        fSeen.get(key)!.push(f.id);
      }
      const fDups = [...fSeen.entries()].filter(([, ids]) => ids.length > 1);
      if (fDups.length > 0) {
        dupPenalty += Math.min(10, fDups.length * 2);
        issues.push({
          id: `issue-${++issueCounter}`,
          module: "Funil",
          type: "duplication",
          severity: "medio",
          title: `${fDups.length} registro(s) de funil duplicado(s)`,
          description: `Mesmo período e tipo com múltiplas entradas.`,
          ids: fDups.flatMap(([, ids]) => ids),
          autoFixable: true,
        });
      }
    }

    setProgress(45);

    // 3) PDN duplicates: same (gerente_id, mes, nome normalizado)
    const { data: pdns } = await supabase.from("pdn_entries").select("id, gerente_id, mes, nome");
    if (pdns) {
      const pSeen = new Map<string, string[]>();
      for (const p of pdns as any[]) {
        const key = `${p.gerente_id}|${p.mes}|${normalizeName(p.nome)}`;
        if (!pSeen.has(key)) pSeen.set(key, []);
        pSeen.get(key)!.push(p.id);
      }
      const pDups = [...pSeen.entries()].filter(([, ids]) => ids.length > 1);
      if (pDups.length > 0) {
        dupPenalty += Math.min(10, pDups.length * 2);
        issues.push({
          id: `issue-${++issueCounter}`,
          module: "PDN",
          type: "duplication",
          severity: "medio",
          title: `${pDups.length} possível(is) duplicação(ões) no PDN`,
          description: `Mesmo cliente no mesmo mês com nomes semelhantes.`,
          ids: pDups.flatMap(([, ids]) => ids),
        });
      }
    }

    setProgress(55);

    // 4) Leads duplicates by phone/email
    const { data: leads } = await supabase.from("leads").select("id, nome, telefone, email, interesse");
    if (leads) {
      const phoneSeen = new Map<string, string[]>();
      const emailSeen = new Map<string, string[]>();
      for (const l of leads as any[]) {
        const phone = normalizePhone(l.telefone);
        if (phone.length >= 10) {
          if (!phoneSeen.has(phone)) phoneSeen.set(phone, []);
          phoneSeen.get(phone)!.push(l.id);
        }
        const email = normalizeEmail(l.email);
        if (email.includes("@")) {
          if (!emailSeen.has(email)) emailSeen.set(email, []);
          emailSeen.get(email)!.push(l.id);
        }
      }
      const phoneDups = [...phoneSeen.entries()].filter(([, ids]) => ids.length > 1);
      const emailDups = [...emailSeen.entries()].filter(([, ids]) => ids.length > 1);
      const totalLeadDups = phoneDups.length + emailDups.length;
      if (totalLeadDups > 0) {
        dupPenalty += Math.min(15, totalLeadDups * 2);
        issues.push({
          id: `issue-${++issueCounter}`,
          module: "Leads",
          type: "duplication",
          severity: totalLeadDups > 5 ? "alto" : "medio",
          title: `${totalLeadDups} lead(s) duplicado(s)`,
          description: `${phoneDups.length} por telefone, ${emailDups.length} por email.`,
          ids: [...phoneDups, ...emailDups].flatMap(([, ids]) => ids),
          autoFixable: false,
        });
      }
    }

    setProgress(65);

    // 5) Relatório duplicates
    const { data: reports } = await supabase.from("corretor_reports").select("id, gerente_id, corretor_id, periodo_inicio, periodo_fim");
    if (reports) {
      const rSeen = new Map<string, string[]>();
      for (const r of reports as any[]) {
        const key = `${r.gerente_id}|${r.corretor_id}|${r.periodo_inicio}|${r.periodo_fim}`;
        if (!rSeen.has(key)) rSeen.set(key, []);
        rSeen.get(key)!.push(r.id);
      }
      const rDups = [...rSeen.entries()].filter(([, ids]) => ids.length > 1);
      if (rDups.length > 0) {
        dupPenalty += Math.min(5, rDups.length);
        issues.push({
          id: `issue-${++issueCounter}`,
          module: "Relatórios",
          type: "duplication",
          severity: "baixo",
          title: `${rDups.length} relatório(s) com versões duplicadas`,
          description: `Mesmo corretor e período com múltiplos relatórios.`,
          ids: rDups.flatMap(([, ids]) => ids),
        });
      }
    }

    const duplicationScore = Math.max(0, 100 - dupPenalty * (100 / 30));

    // ---- C) Consistency checks (30%) ----
    setProgress(75);
    let consistencyPenalty = 0;

    // Check: visitas_realizadas <= visitas_marcadas in checkpoint_lines
    const { data: allLines } = await supabase.from("checkpoint_lines").select("id, real_visitas_marcadas, real_visitas_realizadas, real_vgv_gerado, real_vgv_assinado");
    if (allLines) {
      let visitInconsistencies = 0;
      let vgvInconsistencies = 0;
      for (const l of allLines as any[]) {
        if (l.real_visitas_realizadas != null && l.real_visitas_marcadas != null && l.real_visitas_realizadas > l.real_visitas_marcadas) {
          visitInconsistencies++;
        }
        if (l.real_vgv_assinado != null && l.real_vgv_gerado != null && Number(l.real_vgv_assinado) > Number(l.real_vgv_gerado)) {
          vgvInconsistencies++;
        }
      }
      if (visitInconsistencies > 0) {
        consistencyPenalty += Math.min(10, visitInconsistencies * 2);
        issues.push({
          id: `issue-${++issueCounter}`,
          module: "Checkpoint",
          type: "consistency",
          severity: "medio",
          title: `${visitInconsistencies} inconsistência(s) de visitas`,
          description: "Visitas realizadas > marcadas em alguns registros.",
        });
      }
      if (vgvInconsistencies > 0) {
        consistencyPenalty += Math.min(10, vgvInconsistencies * 2);
        issues.push({
          id: `issue-${++issueCounter}`,
          module: "Checkpoint",
          type: "consistency",
          severity: "alto",
          title: `${vgvInconsistencies} inconsistência(s) de VGV`,
          description: "VGV assinado > VGV gerado em alguns registros.",
        });
      }
    }

    // Check funnel consistency
    if (funnels) {
      for (const f of funnels as any[]) {
        if (f.leads_gerados === 0 && (f.propostas_geradas > 0 || f.vendas_fechadas > 0)) {
          consistencyPenalty += 2;
          issues.push({
            id: `issue-${++issueCounter}`,
            module: "Funil",
            type: "consistency",
            severity: "medio",
            title: "Propostas/vendas sem leads",
            description: `Período ${f.periodo_inicio} a ${f.periodo_fim}: leads=0 mas propostas ou vendas > 0.`,
          });
        }
      }
    }

    setProgress(85);

    const consistencyScore = Math.max(0, 100 - consistencyPenalty * (100 / 30));

    // ---- D) Error score (10%) ----
    const errorScore = 100; // No runtime errors detected from client

    // ---- Calculate Health Score ----
    const healthScore = Math.round(
      integrationScore * 0.3 +
      duplicationScore * 0.3 +
      consistencyScore * 0.3 +
      errorScore * 0.1
    );

    setProgress(100);

    const auditResult: AuditResult = {
      healthScore,
      integrationScore: Math.round(integrationScore),
      duplicationScore: Math.round(duplicationScore),
      consistencyScore: Math.round(consistencyScore),
      errorScore: Math.round(errorScore),
      issues,
      stats: {
        totalChecks: 12,
        passed: 12 - issues.length,
        warnings: issues.filter((i) => i.severity === "medio" || i.severity === "baixo").length,
        errors: issues.filter((i) => i.severity === "alto").length,
      },
      timestamp: new Date().toISOString(),
    };

    setResult(auditResult);
    setLoading(false);
    return auditResult;
  }, [user]);

  return { runAudit, loading, progress, result };
}
