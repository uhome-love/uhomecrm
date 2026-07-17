# Autenticação log-only no `evolution-webhook` (Fase 2)

## Fase 1 — Investigação (concluída)

### 1. Auth de webhook na Evolution API
A Evolution API self-hosted que rodamos (mesma versão usada em `whatsapp-campaign-dispatch` e `reengajamento-descartados-enqueue` — `POST /message/sendTemplate/{instance}` com header `apikey`) envia webhooks de saída com o header **`apikey`** contendo o valor da `AUTHENTICATION_API_KEY` global — a mesma chave usada para chamar a API. Não há HMAC nativo nem secret separado por instância. Algumas versões também aceitam `?apikey=` na query string; vamos aceitar as duas formas.

### 2. Padrão dos outros webhooks
- **`whatsapp-webhook`** (Meta): valida `hub.verify_token` no GET (`WHATSAPP_WEBHOOK_VERIFY_TOKEN`), mas **não valida HMAC** do POST — débito conhecido, fora do escopo.
- **`mailgun-webhook`**: hoje **não valida assinatura** — débito conhecido, fora do escopo.
- **`receive-meta-lead`** / **`receive-rdstation-lead`**: validam por secret próprio.

Não existe helper compartilhado; cada webhook faz inline. Manter esse estilo aqui — sem helper novo, sem mexer nos outros webhooks.

### 3. Secret reaproveitável
✅ `EVOLUTION_API_KEY` já está nos secrets e é exatamente o valor que a Evolution envia no header `apikey` em webhooks de saída. Reaproveitar direto — nenhum secret novo.

## Fase 2 — Implementação log-only

### Mudança única em `supabase/functions/evolution-webhook/index.ts`
Inserir bloco de validação no início do `Deno.serve`, logo após os checks de `OPTIONS`/`POST` e antes do `try { const payload = await req.json() ... }`:

```ts
// ── Auth log-only (Fase 2 — enforcement virá em fase separada) ──
const expectedKey = Deno.env.get("EVOLUTION_API_KEY");
const providedKey =
  req.headers.get("apikey") ||
  req.headers.get("x-api-key") ||
  new URL(req.url).searchParams.get("apikey");

const authOk = !!expectedKey && !!providedKey && providedKey === expectedKey;

if (!authOk) {
  // NÃO rejeita ainda — só registra p/ observar tráfego legítimo por alguns dias.
  console.warn(
    "[evolution-webhook][auth-log-only] missing/invalid apikey. " +
    `has_header=${!!req.headers.get("apikey")} ` +
    `has_query=${!!new URL(req.url).searchParams.get("apikey")} ` +
    `expected_configured=${!!expectedKey}`
  );
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await supabase.from("ops_events").insert({
      event_type: "evolution_webhook_auth_missing",
      severity: "warn",
      source: "evolution-webhook",
      details: {
        has_apikey_header: !!req.headers.get("apikey"),
        has_apikey_query: !!new URL(req.url).searchParams.get("apikey"),
        expected_configured: !!expectedKey,
        user_agent: req.headers.get("user-agent") || null,
      },
    });
  } catch (_e) {
    // best-effort — nunca derruba o webhook por causa de log
  }
}
// ── fim do bloco log-only ──
```

**Nenhuma outra alteração.** O processamento segue idêntico — nada é bloqueado. Antes do insert vou confirmar via `supabase--read_query` que as colunas de `ops_events` (`event_type`, `severity`, `source`, `details`) batem; se algum nome for diferente, ajusto só nesse insert.

### Como validar depois de rodar alguns dias

```sql
SELECT count(*),
       details->>'has_apikey_header' AS header,
       details->>'has_apikey_query'  AS query
FROM ops_events
WHERE event_type = 'evolution_webhook_auth_missing'
  AND created_at > now() - interval '48 hours'
GROUP BY header, query;
```

Ou via `supabase--edge_function_logs('evolution-webhook', 'auth-log-only')`.

- **Sinal verde para Fase 3**: 0 (ou perto de 0) eventos em 48-72h → tráfego legítimo passa o `apikey` corretamente.
- **Sinal vermelho**: eventos "missing" batendo com o volume real → reconfigurar o webhook no painel da Evolution antes do enforcement.

## Fase 3 (documentada — NÃO executar agora)

Após confirmação de log limpo por 48-72h:
1. Trocar o `if (!authOk) { console.warn(...) }` por `return new Response(JSON.stringify({error:"unauthorized"}), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }})`.
2. Monitorar 24h que nada quebrou no reengajamento.

## Fora de escopo
Não toco em: `whatsapp-webhook`, `mailgun-webhook`, `whatsapp-campaign-dispatch`, `reengajamento-descartados-enqueue`, RLS, migrations, novos secrets, helpers compartilhados.
