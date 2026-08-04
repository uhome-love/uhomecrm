# Onda 1 — Segurança/Autorização (com verificação de chamadores)

Uma única migration para os itens 1–5 (1 reload do PostgREST) + 3 ajustes de edge/config sem migration.

Antes de qualquer `CREATE OR REPLACE`, a migration guarda o estado atual em uma tabela de rollback (`public._rollback_onda1`, com `pg_get_functiondef` de cada função e o `qual` da policy). Rollback = reexecutar o texto salvo.

---

## Evidência de chamadores (confirmada no código/banco)

| RPC | Chamador real | ID passado | Contexto |
|---|---|---|---|
| `fetch_next_lead`, `fetch_next_lead_campaign`, `renew_lead_lock`, `lock_lead_atomic`, `finalizar_tentativa_v2` | `src/hooks/useOfertaAtiva.ts` (linhas 193, 217, 285, 309, 390, 428) | `user.id` = **auth.uid()** | JWT do corretor |
| `finalizar_tentativa_v2` (retry offline) | `src/hooks/useOAPendingQueue.ts:65` com `item.corretorId`, setado em `DialingModeWithScript.tsx:385/445/527` como `user!.id` | **auth.uid()** | JWT do corretor |
| `skip_oa_lead` | `DialingModeWithScript.tsx:1233` | `user.id` = **auth.uid()** | JWT do corretor |
| `aceitar_lead` / `rejeitar_lead` | edge `distribute-lead` (`index.ts:289/326`), `userId` vindo de `getClaims` | **auth.uid()** do corretor, mas o client é **service_role** (`createClient(url, SERVICE_ROLE_KEY)`, linha 40) → dentro do SQL `auth.uid()` é **NULL** |
| `oferta_ativa_lock_next_lead` | edge `oferta-ativa-proximo-lead:73` | **profiles.id** (`meuProfileId`), client **service_role** → `auth.uid()` NULL |

Conclusão crítica: o guard proposto (`p_corretor_id = auth.uid() OR ...`) **quebraria** `aceitar_lead`, `rejeitar_lead` e `oferta_ativa_lock_next_lead`, porque nesses três o chamador é uma edge function com service_role (sem JWT no contexto SQL) e, no caso da OA Ao Vivo, o id passado é `profiles.id`, não `auth.uid()`.

Ajuste obrigatório: o guard aceita também chamada por service_role. Guard canônico (helper único, criado na mesma migration):

```sql
CREATE OR REPLACE FUNCTION public.assert_acts_as(p_corretor_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- service_role / chamada interna sem JWT (edge functions distribute-lead,
  -- oferta-ativa-proximo-lead, crons): já autenticadas fora do banco
  IF auth.uid() IS NULL OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN;
  END IF;
  IF p_corretor_id = auth.uid()
     OR p_corretor_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
     OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'forbidden';
END $$;
```

Por que os 25 corretores não travam: todos os caminhos do navegador passam `user.id` (= `auth.uid()`), que satisfaz a primeira condição; a variante `profiles.id` cobre a OA Ao Vivo; e o caminho service_role cobre as edges. Nenhum fluxo legítimo mapeado passa um id de terceiro.

---

## Item 1 — Guard nas RPCs de ação (OA / roleta)

Funções: `finalizar_tentativa_v2`, `fetch_next_lead`, `fetch_next_lead_campaign`, `oferta_ativa_lock_next_lead`, `skip_oa_lead`, `aceitar_lead`, `rejeitar_lead`, `lock_lead_atomic`, `renew_lead_lock`.

Mudança: recriar cada função com o corpo atual intacto, inserindo `PERFORM public.assert_acts_as(p_corretor_id);` como primeira instrução (nas funções SQL puras, converter apenas o wrapper mínimo ou usar `WHERE public.assert_acts_as_bool(p_corretor_id)` — a checagem no banco mostrou que todas as nove são plpgsql exceto onde indicado; o corpo é copiado byte a byte do `pg_get_functiondef` salvo).

Em `skip_oa_lead`, trocar `NOT has_role(p_corretor_id,'admin')` (linha 480 do def atual) por `NOT public.has_role(auth.uid(),'admin'::app_role)` — hoje um corretor poderia se passar por admin passando o id de um admin.

Rollback: `_rollback_onda1` guarda os nove `pg_get_functiondef` originais.

---

## Item 2 — `get_relatorio_origem_performance`

Hoje: SQL, SECURITY DEFINER, sem escopo; `p_corretor_ids` NULL devolve todos os leads (nome, VGV, campanha). Chamador único: `src/components/relatorios/RelatorioOrigemPerformance.tsx:61`, que **sempre** passa `p_corretor_ids: null`.

Nova lógica (função vira plpgsql, resolvendo o escopo antes do SELECT existente):

```sql
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
IF has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretor'::app_role) THEN
  v_ids := p_corretor_ids;                       -- comportamento atual, NULL = todos
ELSE
  SELECT array_agg(user_id) INTO v_ids FROM resolve_managed_brokers(auth.uid());
  v_ids := COALESCE(v_ids, ARRAY[]::uuid[]) || auth.uid();
  IF p_corretor_ids IS NOT NULL THEN
    SELECT array_agg(x) INTO v_ids FROM unnest(v_ids) x WHERE x = ANY(p_corretor_ids);
  END IF;
END IF;
-- SELECT atual + AND (v_ids IS NULL OR pl.corretor_id = ANY(v_ids))
```

Compatibilidade de ids: `pl.corretor_id` é auth id (o próprio def faz `LEFT JOIN profiles p ON p.user_id = pl.corretor_id`) e `resolve_managed_brokers` retorna `team_members.user_id` (auth id) — mesma moeda. Admin/diretor: sem mudança. Gestor: passa a ver só sua equipe (+ diretoria via `diretoria_equipes`) — é a redução pedida. Corretor comum: só os próprios leads.

---

## Item 3 — Policy SELECT de `pagadoria_solicitacoes`

Qual atual (confirmada em `pg_policies`): `... OR (has_role(auth.uid(),'gestor') AND EXISTS (SELECT 1 FROM negocios n WHERE n.id = negocio_id AND is_lead_in_my_team(n.corretor_id)))`. Como `negocios.corretor_id` é `profiles.id` e a helper espera auth id, o gestor vê 0.

Novo: `... OR public.can_access_negocio(pagadoria_solicitacoes.negocio_id)`.

`can_access_negocio` (definição lida no banco) cobre: admin, `n.auth_user_id = auth.uid()`, `n.gerente_id`/`n.corretor_id` ∈ profiles do usuário, e corretores de `resolve_managed_brokers(auth.uid())` — que inclui diretoria. Portanto gestor, diretor e admin passam a enxergar; ninguém perde acesso (as outras cláusulas OR ficam).

Rollback: qual original salvo em `_rollback_onda1`.

---

## Item 4 — Diretor nos dashboards do gerente

Guards atuais (confirmados): `IF auth.uid() <> p_gestor_id AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'`.

Novo (padrão de `get_relatorio_vendas` / `get_ranking_central`):

```sql
IF auth.uid() <> p_gestor_id
   AND NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretor'::app_role))
THEN RAISE EXCEPTION 'forbidden'; END IF;
```

Aplicado em `get_dashboard_gerente`, `get_dashboard_gerente_v4_kpis`, `get_dashboard_gerente_v4_dia`. Somente ampliação; corpo restante inalterado.

---

## Item 5 — `corretor_calendar_integrations` sem expor tokens

Fatos: policy SELECT hoje é `auth.uid() = corretor_id`; a tabela está **vazia (0 linhas)** — nenhum corretor conectado ainda, risco de regressão praticamente nulo. `google-oauth-callback` grava `corretor_id = parsedState.uid` (**auth id**, service_role) e `calendar-create-event`/`calendar-disconnect` leem tokens com `SUPABASE_SERVICE_ROLE_KEY` (linhas 22 e 18) — service_role ignora RLS, então nada quebra.

Mudanças:
- `DROP POLICY "Corretor vê própria integração"` (remove leitura direta do cliente; INSERT/UPDATE/DELETE ficam como estão).
- `CREATE FUNCTION public.get_my_calendar_integration() RETURNS TABLE(account_email text, status text, connected_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT account_email, status, connected_at FROM corretor_calendar_integrations WHERE corretor_id = auth.uid() AND provider='google' LIMIT 1 $$;` + `GRANT EXECUTE ... TO authenticated;`
- Frontend (fora da migration): `src/hooks/useCalendarIntegration.ts` passa a chamar `supabase.rpc("get_my_calendar_integration")`. Isso também corrige um bug existente: o hook filtra hoje por `profileId`, mas a tabela grava **auth id** — hoje nunca acharia a integração.

---

## Item 6 — `whatsapp-notificacao` (edge, sem migration)

Chamadores mapeados:
- `_shared/lead-notify.ts:52` — `Authorization: Bearer <service key>` ✅
- `lead-escalation/index.ts:41` — service key ✅
- `vitrine-public/index.ts:470` — service key ✅
- Banco: nenhuma função/trigger/cron chama esta função (varredura em `pg_proc` e `cron.job` não retornou nada) ✅
- **`src/components/visitas/VisitasCobrancaDialog.tsx:46`** — `supabase.functions.invoke(...)` com **JWT do gestor**: `requireCronAuth` puro daria 401 e mataria a "cobrança de visitas".

Proposta: guard híbrido no topo de `supabase/functions/whatsapp-notificacao/index.ts`:

```ts
const denied = requireCronAuth(req);          // cron/service-role
if (denied) {
  const auth = await requireAuth(req);        // fallback: usuário logado
  if (auth.error) return auth.error;
  const allowed = new Set(["cobranca", "cobranca_visita", "teste_texto"]);
  if (!allowed.has(tipo)) return errorResponse("forbidden", 403);
  // + checagem de papel gestor/admin via has_role
}
```

Observação achada de passagem: o dialog envia `tipo: "cobranca_visita"`, que **não existe** no mapa `TEXT_MESSAGES` (existe `cobranca`) — hoje a chamada já retorna 400. Aponto o fato; corrigir ou não é decisão sua (fora do escopo fechado se você preferir).

## Item 7 — `sync-status-to-site`

Chamador único: trigger `on_pipeline_lead_status_changed` → `public.trigger_sync_status_to_site()`, que faz `extensions.http_post` com `Authorization: Bearer <service_role_key do vault>`. Portanto `requireCronAuth(req)` **passa sem alteração no banco** (compara o bearer com `SUPABASE_SERVICE_ROLE_KEY`). Mudança: apenas adicionar `requireCronAuth` no topo do handler, após o preflight OPTIONS.

## Item 8 — `config.toml`

Confirmado por `ls supabase/functions`: **não existem** os diretórios `whatsapp-send`, `visita-whatsapp-confirm`, `campaign-sms-click`, `receive-tiktok-lead`. Não há sender aberto — é limpeza segura. Remover as 4 entradas stale (linhas 9-10, 126-127, 105-106, 138-139).

---

## Ordem de execução e validação

1. Migration única (itens 1–5) fora do horário de pico (regra: máx 2 migrations/dia 08–19h BRT).
2. Ajuste do hook `useCalendarIntegration.ts` (item 5) + edges (6, 7) + `config.toml` (8).
3. Validação ao vivo: puxar lead na OA Ao Vivo, registrar resultado, pular lead, aceitar/rejeitar lead da roleta, abrir Dados Anúncios como admin e como gestor, abrir dashboard do gerente como diretor.

## Ponto que precisa da sua decisão

- Item 6: o guard híbrido (permitir gestor/admin autenticado para `cobranca*`) é necessário para não matar a cobrança de visitas. Se preferir `requireCronAuth` puro, a cobrança pelo dialog para de funcionar — confirme qual caminho.
