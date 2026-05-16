
# Plano de Hardening de Segurança — Faseado, Sem Quebra

## Princípios

1. **1 fase por dia útil** (respeita regra de 2 migrations/dia em 08–19h BRT). Migrations agendadas fora do expediente quando possível.
2. **Cada fase é auto-contida e reversível** — se algo quebrar, fazemos rollback da policy sem perder dados.
3. **Antes de cada migration**: mapear todas as queries do front que tocam a tabela (grep por nome). Se alguma query roda como usuário comum, criar policy compatível ou adicionar `SECURITY DEFINER` em RPC dedicada.
4. **Depois de cada migration**: testar fluxos críticos (login, pipeline carrega, lead detail abre, WhatsApp lista, roleta gira, gestor vê equipe).
5. **Ordem por risco × impacto**: começamos pelo que vaza pra anônimo (P0), depois PII pra todos autenticados (P1), depois escalada de privilégio (P2), depois realtime e supply chain (P3).
6. **Nunca tocar** schemas reservados (`auth`, `storage` direto, `realtime`, `vault`). Para `realtime.messages` usamos policy via SQL padrão do Supabase.

---

## Fase 0 — Preparação (sem migration)

- Criar memória `mem://arquitetura/security/rls-rollout-2026-05` documentando o plano e o status de cada item.
- Garantir que existe `has_role(uuid, app_role)` na `user_roles` (já existe pela memória) — vai substituir todos os checks por `profiles.cargo`.
- Mapear quais front-end hooks fazem `SELECT * FROM profiles/leads/team_members/visitas` (grep no `src/`) — listar os que vão precisar de ajuste.

**Sem risco. Sem deploy.**

---

## Fase 1 — Fechar acesso anônimo (P0, vazamento público)

**Tabelas:** `visitas`, `team_members`, bucket `temp-imports`.

Hoje qualquer pessoa sem login lê telefones de clientes (`visitas`), nomes e UUIDs internos (`team_members`) e arquivos do bucket `temp-imports`.

**Migration única:**
- Remover policy `Public can view visitas for scoreboard` → criar policy `SELECT TO authenticated USING (true)` (mantém comportamento atual pra qualquer logado; o aperto fino vem na Fase 2).
- Remover policy `Public can view team_members for scoreboard` → idem, restringe pra `authenticated`.
- Tornar bucket `temp-imports` privado + policy de leitura só pra admin/backoffice.

**Teste pós-deploy:**
- Scoreboard público (se existir rota anônima) → confirmar se quebra; se sim, criar view agregada `v_scoreboard_publico` sem PII.
- Logado: dashboard de visitas, sidebar de equipe, importações.

**Risco:** baixo (só remove acesso anon).

---

## Fase 2 — Profiles, leads e dados de lead (P1, maior superfície)

**Tabelas:** `profiles`, `leads`, `lead_nurturing_state`, `perfil_interesse`, `oportunidades`.

Esta é a fase mais sensível — `profiles` e `leads` são lidos em dezenas de telas.

**Estratégia em 2 sub-fases:**

### 2a — Profiles (CPF/telefone restritos, nome/cargo/avatar abertos)

- Remover policy `Authenticated users can view all profiles`.
- Criar policies separadas:
  - `profiles_self_full`: usuário vê **todos os campos** do próprio registro.
  - `profiles_team_minimal`: qualquer autenticado vê apenas `id, user_id, nome, avatar_url, cargo, ativo` (via **view** `v_profiles_publico` com `SECURITY INVOKER` + policy `SELECT TO authenticated USING (true)` na view; a tabela base fica restrita).
  - `profiles_admin_full`: `has_role(auth.uid(), 'admin')` lê tudo.
- Refatorar front: trocar `from('profiles').select('*')` por `from('v_profiles_publico')` onde não precisa de CPF.

### 2b — Leads e correlatos

- `leads.auth_read` (USING true) → substituir por:
  - `atribuido_para = auth.uid()` OR
  - `has_role(auth.uid(),'gestor')` com filtro `team_members` OR
  - `has_role(auth.uid(),'admin')`.
- Mesma lógica para `lead_nurturing_state`, `perfil_interesse`, `oportunidades` (joinar via `lead_id` → `leads.atribuido_para`).

**Teste pós-deploy (crítico):**
- Pipeline carrega contadores corretos para corretor, gerente e admin.
- Lead detail abre com perfil de interesse e nurturing.
- WhatsApp inbox mostra leads atribuídos.
- Parcerias bidirecionais (ver memória `parcerias-gestao-compartilhada-v2`) — checar se policy contempla `v_user_partner_leads`.

**Risco:** alto. Rollback preparado: script SQL que recria a policy `auth_read USING (true)` em <30s caso pipeline quebre pra alguém.

---

## Fase 3 — Escalada de privilégio (P2, `profiles.cargo`)

**Policies vulneráveis:** `campaign_clicks`, `jetimob_campaign_map`, `academia_trilhas`.

Hoje checam `profiles.cargo IN ('gerente','admin')`, mas o usuário pode atualizar o próprio `profiles.cargo` (a policy de UPDATE em profiles permite).

**Migration:**
- Substituir todos os checks `is_gerente_or_above()` e `profiles.cargo IN (...)` por `has_role(auth.uid(),'gestor') OR has_role(auth.uid(),'admin')`.
- Adicionar policy `profiles_update_self` que **bloqueia mudanças no campo `cargo`** (via trigger `BEFORE UPDATE` que ignora `NEW.cargo := OLD.cargo` se não for admin).

**Teste:** gestor vê campaign_clicks, jetimob_campaign_map e academia_trilhas. Corretor não vê. Corretor não consegue mudar próprio cargo.

**Risco:** médio.

---

## Fase 4 — Dados sensíveis de comunicação (P1 restante)

**Tabelas:** `whatsapp_ai_log`, `voice_call_logs`, `ia_call_results`, `ai_calls`, `brevo_contacts`, `rh_candidatos`, `pagadoria_credores`, `pagadoria_solicitacoes`, `site_events`, `reengajamento_meta_disparos`.

**Padrão de policies:**
- Logs de IA / voice → SELECT só para `has_role('admin')`, `has_role('gestor')` ou corretor dono do lead (join via `lead_id`).
- `brevo_contacts`, `rh_candidatos` → SELECT/INSERT/UPDATE/DELETE só para `has_role('admin') OR has_role('backoffice')`.
- `pagadoria_credores` → mesmo nível do parent `pagadorias` (admin/backoffice).
- `pagadoria_solicitacoes` → remover gestor do SELECT; criar `v_pagadoria_solicitacoes_resumo` (sem CPF/RG/URLs) para gestores.
- Bucket `pagadoria-docs` → policy verifica `solicitacao.user_id = auth.uid()` OR `has_role('admin'|'backoffice')`.
- `ai_calls` → policy `Service role full access` muda de `{public}` para `{service_role}`; adicionar SELECT autenticado restrito a dono.

**Pode ser dividido em 2 dias** (lote A: comunicação; lote B: financeiro/RH) para respeitar o limite de migrations.

**Teste:** Hub admin acessa tudo; corretor só vê o que é dele; Pagadorias funciona pra backoffice.

**Risco:** médio (algumas telas de gestor/admin podem precisar refetch).

---

## Fase 5 — Realtime hardening (P0 conceitual mas isolado)

**Problema:** `realtime.messages` sem RLS — qualquer logado pode subscrever qualquer canal.

**Migration:**
- Criar policy em `realtime.messages` que exige `auth.uid() IS NOT NULL` e valida que o `topic` bate com um padrão permitido (`pipeline:user_id`, `whatsapp:user_id`, etc.).
- Refatorar canais do front pra incluir o `user_id` no topic onde aplicável.

**Teste:** WhatsApp inbox recebe novas msgs em tempo real, pipeline atualiza ao mover card, roleta sincroniza disponibilidade.

**Risco:** médio-alto (realtime quebra silenciosamente). Fazer **fora do horário comercial**.

---

## Fase 6 — Supply chain (sem migration, só `package.json`)

- `jspdf` 2.5.2 → upgrade para versão sem CVE (testar cada local de geração de PDF).
- `html2pdf.js` → avaliar substituição por `jspdf + html2canvas` direto ou usar edge function com Chromium headless.
- `xlsx` (SheetJS) → migrar para `exceljs` (mantido, sem CVEs) **ou** fixar `xlsx` na versão CDN oficial do SheetJS (não a do npm, que está vulnerável).

**Teste:** todos os exports/imports de planilha e PDFs (relatórios gestor, 1:1, pagadorias).

**Risco:** baixo-médio (API de exceljs difere).

---

## Cronograma sugerido

| Dia | Fase | Janela |
|-----|------|--------|
| 1 | Fase 0 (prep) + Fase 1 | manhã |
| 2 | Fase 2a (profiles) | madrugada |
| 3 | Fase 2b (leads) | madrugada |
| 4 | Fase 3 (escalada) | manhã |
| 5 | Fase 4 lote A (comunicação) | madrugada |
| 6 | Fase 4 lote B (financeiro/RH) | madrugada |
| 7 | Fase 5 (realtime) | madrugada |
| 8 | Fase 6 (deps) | manhã |

## Detalhes técnicos resumidos

- Toda nova policy SELECT usa `has_role(auth.uid(), enum)` (a function `SECURITY DEFINER` da memória).
- Onde o front precisa de leitura ampla mas restrita por colunas, **view `SECURITY INVOKER`** + grant `SELECT` para `authenticated`.
- Bloqueio de mudança de `cargo` via trigger `BEFORE UPDATE` na `profiles` (não via revoke, pra não quebrar o flow de admin).
- Migrations agrupadas por fase pra evitar múltiplos reloads de PostgREST no mesmo turno.
- Cada fase tem um snippet de rollback no header da migration.

## O que NÃO está nesse plano

- Refatorar todo o sistema de roles para um único modelo (já existe `has_role`; basta migrar policies).
- Remover funções `SECURITY DEFINER` antigas que o linter reclama (282 findings históricos) — fica para um plano separado de housekeeping.
- Mudanças visuais. Tudo é backend + RLS + ajustes pontuais de hooks.

## Pronto para iniciar pela Fase 0+1?

Posso começar gerando a migration da Fase 1 (a mais segura) assim que você aprovar.
