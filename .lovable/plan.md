
# Meta CAPI · Match Quality 4.4 → 6.0+

Objetivo: enriquecer `user_data` de todos os eventos (Lead, Schedule, ViewContent, Purchase) com nome, sobrenome, cidade, UF e país hasheados em SHA-256, mantendo email/telefone/lead_id/fbc/fbp já enviados. E adicionar log de diagnóstico quando lead chegar sem email.

## Onde o CAPI é montado hoje

`user_data` é construído **inteiramente em Postgres**, na função `public.enqueue_meta_capi_event` (última versão em `supabase/migrations/20260728171543_...sql`). A edge `meta-capi-dispatch/index.ts` só lê `payload` da fila `meta_capi_queue` e faz POST — não monta `user_data`. Portanto os campos novos entram numa migration que substitui `enqueue_meta_capi_event`.

Os `console.warn` de lead sem email vão nos 4 receivers que fazem insert em `pipeline_leads`:
- `supabase/functions/receive-meta-lead/index.ts`
- `supabase/functions/receive-landing-lead/index.ts`
- `supabase/functions/receive-rdstation-lead/index.ts`
- `supabase/functions/receive-imovelweb-lead/index.ts`

## Mudança 1 — Enriquecer user_data (migration)

Nova versão de `enqueue_meta_capi_event` faz:

1. Buscar também `nome`, `empreendimento` do lead.
2. **fn / ln** — a partir de `nome`: `unaccent(lower(trim(nome)))`, split em primeiro token vs. resto; se resto vazio, `ln` fica omitido.
3. **country** — sempre `sha256('br')`.
4. **ct / st** — resolvidos por empreendimento canônico via join `empreendimento_aliases` → `empreendimentos_canonicos`. Como hoje não temos coluna `cidade/uf` nesses catálogos, usar fallback fixo **Porto Alegre / RS** (99% do estoque). Deixar CTE `v_empreendimento_geo` (mapa nome→cidade,uf) inline na função, começando com regra padrão `('*', 'porto alegre', 'rs')`; overrides futuros por empreendimento entram só editando essa CTE — sem nova tabela agora.
5. **zp** — omitido (não capturamos CEP).
6. Todos os valores hasheados via `_capi_sha256`, que já normaliza (lower + trim). Adicionar `unaccent` no helper `_capi_sha256` (ou fazer o unaccent antes de chamar) para garantir remoção de acentos em `nome` e `cidade`. Email já entra em lowercase (helper), telefone já é E.164 (`_capi_normalize_phone`).
7. Só adiciona chave ao `v_user_data` quando o hash resultante não é nulo (mesmo padrão atual).

O payload final passa a incluir, além de `em`/`ph`/`lead_id`/`fbc`/`fbp`/`client_user_agent` atuais:
```
"fn": ["<sha256>"], "ln": ["<sha256>"],
"ct": ["<sha256>"], "st": ["<sha256>"],
"country": ["<sha256>"]
```

Nenhum trigger muda — todos continuam chamando `enqueue_meta_capi_event(...)` com a mesma assinatura.

## Mudança 2 — Log de lead sem email (4 receivers)

Em cada um dos 4 receivers, logo após determinar `email` e `empreendimento`/`origem` e antes do insert em `pipeline_leads`, adicionar:

```ts
if (!email) {
  console.warn("[CAPI match-quality] Lead sem email", {
    receiver: "receive-meta-lead", // ajustado por arquivo
    produto: empreendimento || null,
    origem: source || platform || "desconhecida",
    campaign_id: campaignId || null,
    form_name: formName || null,
  });
}
```

Sem mudar fluxo — só warn. Vai para `edge_function_logs` e alimenta o painel `/admin/ingestao`.

## Validação

1. Rodar `SELECT public.enqueue_meta_capi_event('<lead-com-nome-completo>', 'Lead', now());` e inspecionar `payload->'user_data'` — deve conter `fn`, `ln`, `ct`, `st`, `country` (hashes 64 chars).
2. Disparar `meta-capi-dispatch` com `test_event_code=TEST16747` e confirmar no Meta Events Manager que "Parâmetros correspondentes" agora lista Nome, Sobrenome, Cidade, Estado, País.
3. Forçar um lead sintético sem email pelo `receive-landing-lead` e ver o warn em `edge_function_logs`.
4. Aguardar 24-48h e ver Match Quality subir de 4.4 para 6.0+.

## Fora de escopo (fica para depois)

- Captura de CEP nas landings (traria `zp`, +~1 ponto).
- Coluna real `cidade/uf` em `empreendimentos_canonicos` — só necessário quando começarmos vendas fora de Porto Alegre.
