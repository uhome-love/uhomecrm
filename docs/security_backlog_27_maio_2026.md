# Security Backlog — Scan de 27/05/2026

> **Status:** NÃO ATACAR. Entra em plan próprio **depois da Central v2 estável**.
> Origem: `security--get_scan_results` (scanner_name: `supabase_lov` v3.2 + `supabase` linter).
> Snapshot timestamp: `2026-05-27T22:42:20Z`.

## 🔴 ERROR (3)

### 1. `visitas_anon_token_policy_misconfiguration`
Policies públicas `Public can view/update visita by token` usam `confirmation_token IS NOT NULL` em vez de comparar contra valor fornecido pelo caller. Qualquer **anon** lê/modifica as 917 visitas (nome cliente, telefone, UUIDs corretor/gerente).
**Fix sugerido:** mover validação de token para RPC/edge function que recebe o token como parâmetro e filtra single row. Edge `visita-public` já existe.

### 2. `profiles_cpf_exposed_to_all_authenticated`
Policy `Authenticated can view all profiles` (`USING true`) expõe `cpf`, `email`, `telefone` de todos os funcionários para qualquer corretor recém-onboardado.
**Fix sugerido:** remover coluna `cpf` de `profiles` (mover para `pagadoria_solicitacoes` já scoped) **ou** view sem CPF para não-admin/backoffice.

### 3. `realtime_no_channel_authorization`
22 tabelas publicadas no Realtime (pipeline_leads, negocios, visitas, whatsapp_mensagens, ai_calls, reengajamento_meta_disparos, …) sem RLS em `realtime.messages`. Qualquer authenticated subscreve qualquer tópico e bypassa RLS de SELECT.
**Fix sugerido:** RLS em `realtime.messages` scoped por tópico + `auth.uid()` / claims. ⚠️ Alto risco — exige mapeamento prévio de canais (inbox WhatsApp, pipeline live, notificações).

## 🟡 WARN (6)

| # | internal_id | Tabela(s) | Problema |
|---|---|---|---|
| 4 | `ai_call_sessions_unscoped_full_access` | `ai_call_sessions` | Policy ALL `USING/CHECK (true)` |
| 5 | `lead_nurturing_state_imoveis_interesse_unscoped` | `lead_nurturing_state`, `imoveis_interesse` | SELECT `USING (true)` |
| 6 | `lead_property_tables_unscoped_access` | `lead_property_profiles`, `lead_property_matches`, `lead_property_interactions`, `lead_property_searches` | Policies ALL `USING/CHECK (true)` |
| 7 | `negocios_tarefas_atividades_unscoped_access` | `negocios_tarefas`, `negocios_atividades` | SELECT/INSERT/UPDATE `USING/CHECK (true)` |
| 8 | `oportunidades_pos_vendas_unscoped_read` | `oportunidades`, `pos_vendas` | SELECT `USING (true)` |
| 9 | `roleta_desbloqueios_unscoped_delete` | `roleta_desbloqueios` | DELETE/INSERT `USING/CHECK (true)` |

**Padrão de fix:** scoping via `corretor_id = auth.uid()` + `is_lead_in_my_team` para gestores, alinhado ao plano `mem://arquitetura/security/rls-rollout-2026-05` (Fase 1 anon já concluída).

## ⚪ Supabase linter
- `Materialized View in API` (warn) — MV exposta via Data API. Fix: revogar grants `anon/authenticated` na MV.

## Próximos passos (quando autorizado)
1. Entrar como nova fase do RLS Hardening Rollout (mem://arquitetura/security/rls-rollout-2026-05).
2. PLAN MODE por finding crítica (#1, #2, #3 separados).
3. Warns agrupados em 2-3 migrations dentro do roadmap.
4. Respeitar cap de 2 migrations/dia em 08-19h BRT.
