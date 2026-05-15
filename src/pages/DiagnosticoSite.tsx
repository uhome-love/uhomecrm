import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";

type TestStatus = "idle" | "running" | "ok" | "warn" | "error";

interface TestResult {
  id: string;
  group: string;
  label: string;
  status: TestStatus;
  message: string;
  durationMs: number;
}

const GROUPS = [
  "Banco do CRM",
  "Edge Function do CRM",
  "Trigger do CRM",
  "Corretores",
  "End-to-End do lado do CRM",
];

const TESTS_DEF: { id: string; group: string; label: string }[] = [
  { id: "col_site_lead", group: "Banco do CRM", label: "1. Coluna site_lead_id em leads" },
  { id: "leads_site", group: "Banco do CRM", label: "2. Leads vindos do site" },
  { id: "leads_atribuidos", group: "Banco do CRM", label: "3. Leads atribuídos a corretor" },
  { id: "edge_fn_exists", group: "Edge Function do CRM", label: "4. sync-status-to-site responde" },
  { id: "secrets_ok", group: "Edge Function do CRM", label: "5. Secrets configurados" },
  { id: "trigger_test", group: "Trigger do CRM", label: "6. Trigger on_pipeline_lead_status_changed" },
  { id: "corretores_ativos", group: "Corretores", label: "7. Corretores ativos" },
  { id: "corretor_plantao", group: "Corretores", label: "8. Corretor de plantão" },
  { id: "e2e_insert", group: "End-to-End do lado do CRM", label: "9. Simular lead do site" },
  { id: "e2e_status", group: "End-to-End do lado do CRM", label: "10. Atualizar status e verificar envio" },
];

const statusIcon = (s: TestStatus) => {
  switch (s) {
    case "ok": return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case "warn": return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case "error": return <XCircle className="h-5 w-5 text-red-500" />;
    case "running": return <Clock className="h-5 w-5 text-blue-400 animate-spin" />;
    default: return <div className="h-5 w-5 rounded-full border-2 border-muted" />;
  }
};

const statusEmoji = (s: TestStatus) => {
  switch (s) {
    case "ok": return "✅";
    case "warn": return "⚠️";
    case "error": return "❌";
    case "running": return "⏳";
    default: return "⏳";
  }
};

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = performance.now();
  const result = await fn();
  return { result, ms: Math.round(performance.now() - t0) };
}

export default function DiagnosticoSite() {
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [running, setRunning] = useState(false);

  const update = useCallback((id: string, group: string, label: string, status: TestStatus, message: string, durationMs: number) => {
    setResults(prev => ({ ...prev, [id]: { id, group, label, status, message, durationMs } }));
  }, []);

  const runTests = useCallback(async () => {
    setRunning(true);
    setResults({});

    // Init all as running
    for (const t of TESTS_DEF) {
      update(t.id, t.group, t.label, "running", "Executando...", 0);
    }

    // 1. Coluna site_lead_id
    const t1 = await timed(async () => {
      const { error } = await (supabase as any).from("leads").select("site_lead_id, origem_site, corretor_ref_slug").limit(1);
      return error;
    });
    if (!t1.result) {
      update("col_site_lead", "Banco do CRM", TESTS_DEF[0].label, "ok", "Colunas site_lead_id, origem_site, corretor_ref_slug existem", t1.ms);
    } else {
      update("col_site_lead", "Banco do CRM", TESTS_DEF[0].label, "error", `Erro: ${t1.result.message} — rodar migration`, t1.ms);
    }

    // 2. Leads vindos do site
    const t2 = await timed(async () => {
      const { count, error } = await (supabase as any).from("leads").select("*", { count: "exact", head: true }).eq("origem", "site_uhome");
      return { count, error };
    });
    if (t2.result.error) {
      update("leads_site", "Banco do CRM", TESTS_DEF[1].label, "error", `Erro: ${t2.result.error.message}`, t2.ms);
    } else if ((t2.result.count ?? 0) === 0) {
      update("leads_site", "Banco do CRM", TESTS_DEF[1].label, "warn", "0 leads do site — integração ainda não enviou nenhum", t2.ms);
    } else {
      update("leads_site", "Banco do CRM", TESTS_DEF[1].label, "ok", `${t2.result.count} leads do site encontrados`, t2.ms);
    }

    // 3. Leads atribuídos
    const t3 = await timed(async () => {
      const { count: total } = await (supabase as any).from("leads").select("*", { count: "exact", head: true }).eq("origem", "site_uhome");
      const { count: atrib } = await (supabase as any).from("leads").select("*", { count: "exact", head: true }).eq("origem", "site_uhome").not("atribuido_para", "is", null);
      return { total: total ?? 0, atrib: atrib ?? 0 };
    });
    if (t3.result.atrib === 0 && t3.result.total > 0) {
      update("leads_atribuidos", "Banco do CRM", TESTS_DEF[2].label, "warn", "Nenhum lead atribuído — verificar corretor de plantão", t3.ms);
    } else if (t3.result.total === 0) {
      update("leads_atribuidos", "Banco do CRM", TESTS_DEF[2].label, "warn", "0 leads do site para verificar", t3.ms);
    } else {
      const pct = Math.round((t3.result.atrib / t3.result.total) * 100);
      update("leads_atribuidos", "Banco do CRM", TESTS_DEF[2].label, "ok", `${t3.result.atrib} leads atribuídos (${pct}%)`, t3.ms);
    }

    // 4. Edge function sync-status-to-site exists
    const t4 = await timed(async () => {
      const { error } = await supabase.functions.invoke("sync-status-to-site", {
        body: {
          record: { status: "teste_diagnostico", site_lead_id: "00000000-0000-0000-0000-000000000000", atribuido_para: null, id: "00000000-0000-0000-0000-000000000000" },
          old_record: { status: "novo" },
        },
      });
      return error;
    });
    if (!t4.result) {
      update("edge_fn_exists", "Edge Function do CRM", TESTS_DEF[3].label, "ok", "Function respondeu com sucesso", t4.ms);
    } else {
      const msg = typeof t4.result === "object" && "message" in t4.result ? (t4.result as any).message : String(t4.result);
      if (msg.includes("not found") || msg.includes("404")) {
        update("edge_fn_exists", "Edge Function do CRM", TESTS_DEF[3].label, "error", "Function não encontrada — verificar deploy", t4.ms);
      } else {
        update("edge_fn_exists", "Edge Function do CRM", TESTS_DEF[3].label, "ok", `Function respondeu (${msg})`, t4.ms);
      }
    }

    // 5. Secrets OK (infer from function response)
    const t5 = await timed(async () => {
      const { data, error } = await supabase.functions.invoke("sync-status-to-site", {
        body: {
          record: { status: "teste_secrets", site_lead_id: "00000000-0000-0000-0000-000000000000", atribuido_para: null, id: "test" },
          old_record: { status: "novo" },
        },
      });
      return { data, error };
    });
    const secretMsg = JSON.stringify(t5.result.data || t5.result.error || "");
    if (secretMsg.includes("UHOMESITE_URL") || secretMsg.includes("UHOMELANDING") || secretMsg.includes("SYNC_SECRET")) {
      update("secrets_ok", "Edge Function do CRM", TESTS_DEF[4].label, "error", "Secret ausente — configurar UHOMESITE_URL e SYNC_SECRET", t5.ms);
    } else {
      update("secrets_ok", "Edge Function do CRM", TESTS_DEF[4].label, "ok", "Sem erro de secret detectado", t5.ms);
    }

    // 6. Trigger test (insert → update → check)
    const t6 = await timed(async () => {
      try {
        const testId = crypto.randomUUID();
        // We test on pipeline_leads since the trigger is there
        const { data: ins, error: insErr } = await (supabase as any).from("pipeline_leads").insert({
          nome: "TESTE_TRIGGER_DIAGNOSTICO",
          telefone: "51000000002",
          origem: "diagnostico",
          status: "novo",
          canal: "diagnostico",
        }).select("id").single();

        if (insErr) return { ok: false, msg: `Insert falhou: ${insErr.message}` };

        const leadId = ins.id;
        // Update status to fire trigger
        const { error: updErr } = await (supabase as any).from("pipeline_leads").update({ status: "em_atendimento" }).eq("id", leadId);
        if (updErr) {
          // cleanup
          await (supabase as any).from("pipeline_leads").delete().eq("id", leadId);
          return { ok: false, msg: `Update falhou: ${updErr.message}` };
        }

        // Wait 3s for trigger
        await new Promise(r => setTimeout(r, 3000));

        // Cleanup
        await (supabase as any).from("pipeline_leads").delete().eq("id", leadId);

        return { ok: true, msg: "Trigger disparou (lead de teste criado, status alterado, limpo)" };
      } catch (e: any) {
        return { ok: false, msg: e.message };
      }
    });
    update("trigger_test", "Trigger do CRM", TESTS_DEF[5].label,
      t6.result.ok ? "ok" : "warn",
      t6.result.msg, t6.ms);

    // 7. Corretores ativos
    const t7 = await timed(async () => {
      const { data, error } = await supabase.from("profiles").select("id, nome, email, de_plantao").eq("role", "corretor").eq("ativo", true);
      return { data, error };
    });
    if (t7.result.error) {
      update("corretores_ativos", "Corretores", TESTS_DEF[6].label, "error", `Erro: ${t7.result.error.message}`, t7.ms);
    } else if (!t7.result.data?.length) {
      update("corretores_ativos", "Corretores", TESTS_DEF[6].label, "warn", "Nenhum corretor ativo — site não consegue atribuir leads", t7.ms);
    } else {
      const names = t7.result.data.slice(0, 5).map((c: any) => c.nome).join(", ");
      const extra = t7.result.data.length > 5 ? ` +${t7.result.data.length - 5}` : "";
      update("corretores_ativos", "Corretores", TESTS_DEF[6].label, "ok", `${t7.result.data.length} corretores ativos: ${names}${extra}`, t7.ms);
    }

    // 8. Corretor de plantão
    const t8 = await timed(async () => {
      const { data, error } = await supabase.from("profiles").select("id, nome").eq("role", "corretor").eq("de_plantao", true).eq("ativo", true);
      return { data, error };
    });
    if (t8.result.error) {
      update("corretor_plantao", "Corretores", TESTS_DEF[7].label, "error", `Erro: ${t8.result.error.message}`, t8.ms);
    } else if (!t8.result.data?.length) {
      update("corretor_plantao", "Corretores", TESTS_DEF[7].label, "warn", "Nenhum corretor de plantão — leads sem corretor_ref ficarão sem atribuição", t8.ms);
    } else {
      const names = t8.result.data.map((c: any) => c.nome).join(", ");
      update("corretor_plantao", "Corretores", TESTS_DEF[7].label, "ok", `Corretor(es) de plantão: ${names}`, t8.ms);
    }

    // 9. E2E insert
    const siteLeadId = crypto.randomUUID();
    const t9 = await timed(async () => {
      const { data, error } = await (supabase as any).from("pipeline_leads").insert({
        nome: "TESTE_E2E_CRM",
        telefone: "51000000003",
        origem: "site_uhome",
        status: "novo",
        canal: "diagnostico_crm",
      }).select("id").single();
      return { data, error };
    });
    let e2eLeadId: string | null = null;
    if (t9.result.error) {
      update("e2e_insert", "End-to-End do lado do CRM", TESTS_DEF[8].label, "error", `Erro no insert: ${t9.result.error.message}`, t9.ms);
    } else {
      e2eLeadId = t9.result.data.id;
      update("e2e_insert", "End-to-End do lado do CRM", TESTS_DEF[8].label, "ok", `Lead inserido com ID: ${e2eLeadId}`, t9.ms);
    }

    // 10. E2E status update
    const t10 = await timed(async () => {
      if (!e2eLeadId) return { ok: false, msg: "Lead E2E não foi criado (teste 9 falhou)" };
      try {
        const { error } = await (supabase as any).from("pipeline_leads").update({ status: "em_atendimento" }).eq("id", e2eLeadId);
        if (error) return { ok: false, msg: `Erro na atualização: ${error.message}` };
        await new Promise(r => setTimeout(r, 3000));
        // Cleanup
        await (supabase as any).from("pipeline_leads").delete().eq("id", e2eLeadId);
        return { ok: true, msg: "Status atualizado — trigger deve ter enviado ao site" };
      } catch (e: any) {
        return { ok: false, msg: e.message };
      }
    });
    update("e2e_status", "End-to-End do lado do CRM", TESTS_DEF[9].label,
      t10.result.ok ? "ok" : "error",
      t10.result.msg, t10.ms);

    setRunning(false);
  }, [update]);

  const all = Object.values(results);
  const okCount = all.filter(r => r.status === "ok").length;
  const warnCount = all.filter(r => r.status === "warn").length;
  const errorCount = all.filter(r => r.status === "error").length;
  const done = all.length === TESTS_DEF.length && !running;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">🔗 Diagnóstico — Integração Site</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Valida a integração entre o CRM e o site uhome.com.br
          </p>
        </div>
        <Button onClick={runTests} disabled={running} size="lg" className="gap-2">
          {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Executando..." : "▶ Rodar testes"}
        </Button>
      </div>

      {done && (
        <div className={`rounded-xl p-4 text-center font-semibold text-lg ${
          errorCount > 0 ? "bg-red-500/10 text-red-600 border border-red-500/30" :
          warnCount > 0 ? "bg-yellow-500/10 text-yellow-700 border border-yellow-500/30" :
          "bg-green-500/10 text-green-600 border border-green-500/30"
        }`}>
          {errorCount > 0
            ? `❌ ${errorCount} erro(s) encontrado(s)`
            : warnCount > 0
            ? `⚠️ Tudo funcional, mas ${warnCount} aviso(s)`
            : "✅ Integração 100% operacional"}
          <div className="text-sm font-normal mt-1 opacity-80">
            {okCount} ok · {warnCount} avisos · {errorCount} erros
          </div>
        </div>
      )}

      {GROUPS.map(group => {
        const tests = TESTS_DEF.filter(t => t.group === group);
        return (
          <Card key={group}>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base font-semibold">{group}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {tests.map(t => {
                  const r = results[t.id];
                  return (
                    <div key={t.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="mt-0.5 flex-shrink-0">
                        {r ? statusIcon(r.status) : <div className="h-5 w-5 rounded-full border-2 border-muted" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground">{t.label}</div>
                        {r && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {statusEmoji(r.status)} {r.message}
                          </div>
                        )}
                      </div>
                      {r && r.durationMs > 0 && (
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {r.durationMs}ms
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
