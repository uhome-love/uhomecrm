# Domínio 12 — Admin & Segurança

## 1. Propósito
Controle de acesso (roles), auditoria, feature flags do sistema.

## 2. Tabelas
### `user_roles` (4 col, 5 policies)
```sql
CREATE TABLE user_roles (
  id uuid PK,
  user_id uuid REFERENCES auth.users(id),
  role app_role,  -- enum: admin, gerente, corretor, diretor, ceo, backoffice, marketing, rh
  created_at timestamptz
);
-- security-definer function has_role(_user_id, _role) usada em RLS
```
Roles isoladas em tabela separada (padrão de segurança para evitar privilege escalation via profiles).

### `profiles` (20 col, 4 policies)
Publicos: `user_id, avatar_url, nome, ...`. Não guarda role.

### `audit_log` (11 col, 2 policies)
- Admin e gestores veem; qualquer authenticated escreve.
- Tabela `audit_log_atrio_22_05_2026` é snapshot antigo.

### `system_flags` (5 col, 2 policies)
Atual (3 linhas):
| flag_name | flag_value | reason |
|---|---|---|
| `campaign_dispatch_enabled` | true | Pagamento Meta regularizado 13/07 — reenvio liberado |
| `campanha_atrio_enabled` | false | kill_switch_manual por 0de4a362-... |
| `nutricao_enabled` | false | Chave mestra da Central de Nutrição — default desligada; só liga manualmente |

Colunas: `flag_name, flag_value (bool), reason, updated_at, updated_by`.

### Auth telemetry
- `auth_telemetry` (13 col, 2 policies) — logins, falhas
- `network_telemetry` (16 col, 2 policies)
- `ops_events` — eventos operacionais (usado por `edge-health-alert`)

### RLS geral
- `has_role(auth.uid(), 'admin')` é o "bypass" — admin vê tudo.
- `has_role(auth.uid(), 'diretor')` lê tudo (várias policies).
- Gestor via `team_members`.
- Corretor só o próprio (via `corretor_id = auth.uid()` ou resolução `profiles.id`).

## 3. Fluxo
```
Login → Supabase Auth → JWT com auth.uid()
   ↓
RLS avalia has_role() para cada operação
   ↓
audit_log.insert() via UI ou trigger em operações sensíveis
   ↓
auth_telemetry captura login/logout events (via log-auth-event edge fn)

Feature flag mudança:
  UI admin → UPDATE system_flags → propaga instantaneamente (RLS aberto para read authenticated)
```

## 4. Componentes/hooks
- `src/pages/BackofficeCentral.tsx`, `AuditDashboard.tsx`, `Configuracoes.tsx`
- `src/components/audit/*`, `src/components/RoleProtectedRoute.tsx`, `ProtectedRoute.tsx`
- `src/pages/admin/DiagnosticoRede.tsx`, `IngestaoPanel.tsx`, `TelemetriaRede.tsx`, `UsoPaginasPanel.tsx`
- `src/pages/DiagnosticoSite.tsx`
- Hooks: `useAuth`, `useAuthUser`, `useUserRole`, `useAudit`, `useIngestaoStats`, `useIngestaoEdgeStats`, `useUsoPaginasStats`

## 5. Edge Functions
| Fn | Faz |
|---|---|
| `create-broker-user` | Cria corretor (admin only) |
| `log-auth-event` | Grava auth_telemetry |
| `secrets-tripwire` | Detecta acesso indevido a secrets |
| `bootstrap-vault` | Setup vault |
| `admin-ingestao-stats` | Estatísticas |
| `cron-health-monitor`, `edge-health-alert` | Observabilidade |
| `notify`, `send-push`, `generate-vapid`, `vapid-public-key` | Push |

## 6. Regras não óbvias
- **Roles em tabela separada** (não em profiles) — mandatório para evitar privilege escalation (RLS-user-roles pattern).
- **`has_role` é SECURITY DEFINER**, `set search_path = public`, para evitar recursão em RLS.
- **`ai_replied` em pipeline_leads** funciona como flag "não responder novamente automaticamente".
- **verify_jwt=false** em várias functions (visita-public, evolution-webhook, receive-*) — valida manualmente por token, HMAC ou nada (achado de segurança em evolution-webhook).
- **Migrations regras**: máx 2/dia entre 08-19h BRT (mem).
- **`_shared/cron-auth.ts`** helper para autenticação de crons via CRON_SECRET.

## 7. Decisões
- Padrão de segurança "roles em tabela separada" — decisão explícita (mem index / user-roles instruction).
- BRT globalmente para não sofrer com UTC 21:00 shift.
- Hardening RLS Mai/2026 em rollout faseado (mem://arquitetura/security/rls-rollout-2026-05) — Fase 1 (anon) concluída.

## 8. Dependências
Base transversal. Consumido por todos os outros domínios.

## 9. Perguntas
1. `campaign_dispatch_enabled=true` mas motor de disparo em massa desligado por outros 2 flags — deveria ficar `false` para clareza?
2. `campanha_atrio_enabled=false` (kill switch) — vai reativar ou deletar?
3. `audit_log_atrio_22_05_2026` — snapshot histórico. Deletar após backup?
4. `secrets-tripwire` — dispara em quais eventos? Última execução?
5. `ops_events` — retenção infinita? Ou tem cron limpando?
6. Roles no enum `app_role`: `admin, gerente, corretor, diretor, ceo, backoffice, marketing, rh` — todas em uso?
