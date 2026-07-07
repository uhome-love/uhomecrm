import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * verificar-taxas-financiamento
 *
 * Verifica se as taxas configuradas no simulador estão atualizadas:
 *  - Consulta a Selic meta atual no Banco Central (série SGS 432, pública, sem chave).
 *  - Compara a data de referência da auditoria com a data atual e calcula a "idade".
 *  - Retorna um selo (atualizado / revisar) para o corretor/gestor.
 *
 * NÃO reescreve o código — apenas sinaliza. A atualização de taxas continua
 * controlada e auditável manualmente.
 */

interface BancoRef {
  nome: string;
  taxaAnual: number;
}

const BCB_SELIC_META = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dataReferencia: string = body?.dataReferencia ?? "Jul/2026";
    const bancos: BancoRef[] = Array.isArray(body?.bancos) ? body.bancos : [];

    // ── Selic atual via Banco Central ──
    let selicAtual: number | null = null;
    let selicData: string | null = null;
    try {
      const resp = await fetch(BCB_SELIC_META, { headers: { Accept: "application/json" } });
      if (resp.ok) {
        const arr = await resp.json();
        if (Array.isArray(arr) && arr[0]?.valor) {
          selicAtual = Number(arr[0].valor);
          selicData = arr[0].data ?? null;
        }
      } else {
        await resp.text();
      }
    } catch (_e) {
      // BCB indisponível — segue sem Selic
    }

    // ── Idade da auditoria ──
    // dataReferencia no formato "Mês/AAAA" (ex.: "Jul/2026").
    const meses: Record<string, number> = {
      jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
      jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
    };
    let idadeDias: number | null = null;
    const m = dataReferencia.toLowerCase().match(/([a-z]{3})\/(\d{4})/);
    if (m && meses[m[1]] !== undefined) {
      const refDate = new Date(Number(m[2]), meses[m[1]], 1);
      idadeDias = Math.floor((Date.now() - refDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Consideramos "revisar" se a auditoria tem mais de 45 dias.
    const precisaRevisar = idadeDias !== null && idadeDias > 45;

    return new Response(
      JSON.stringify({
        ok: true,
        verificadoEm: new Date().toISOString(),
        dataReferencia,
        idadeDias,
        precisaRevisar,
        selic: selicAtual != null ? { valor: selicAtual, data: selicData, fonte: "Banco Central (SGS 432)" } : null,
        bancos: bancos.map((b) => ({ nome: b.nome, taxaConfigurada: b.taxaAnual })),
        mensagem: precisaRevisar
          ? "A auditoria das taxas tem mais de 45 dias. Recomendado revisar as taxas atuais dos bancos antes de gerar simulações."
          : "As taxas configuradas estão dentro do período de auditoria recente.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    console.error("verificar-taxas-financiamento erro:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
