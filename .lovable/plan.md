# Plano de Contenção — Prevenir nova queda do CRM

Objetivo: garantir que o incidente de hoje (RPC quebrada por coluna inexistente + sessões corrompidas em PWA cacheado causando "Failed to fetch" em massa) nunca mais derrube o sistema sem detecção imediata.

## 1. Guard-rails de banco (impedir RPC com coluna inexistente)

- **Validação em CI/migração**: toda migration que crie/altere `FUNCTION` ou `TRIGGER` precisa rodar `EXPLAIN` ou `pg_get_functiondef` em ambiente de teste antes do deploy. Bloquear merge se a função referenciar coluna que não existe.
- **Smoke test pós-migração**: script automático que executa todas as RPCs críticas (`reciclar_leads_sem_contato`, `distribuir_lead_atomico`, `processar_oferta_ativa`, `escalar_leads_sla`) com `SELECT` de validação após cada deploy. Falha → rollback automático.
- **Auditoria de schema drift**: cron diário compara colunas referenciadas em `pg_proc.prosrc` com `information_schema.columns` e dispara alerta se houver referência órfã.

## 2. Monitoramento ativo de crons e RPCs

- **Tabela `cron_health`**: cada execução de cron (lead-escalation, oferta-ativa, nurturing, etc) grava `started_at`, `finished_at`, `status`, `error_message`. Já existe parcialmente — padronizar em todos os crons.
- **Alerta automático**: edge function `cron-health-monitor` roda a cada 5 min, verifica se algum cron falhou ≥3 vezes consecutivas e dispara push notification para o CEO + log estruturado.
- **Dashboard interno** em `/admin/health`: status dos últimos 60 min de cada cron, com semáforo verde/amarelo/vermelho.

## 3. Resiliência de Auth e PWA (frontend)

- **`useAuth.tsx`** (já implementado hoje): `purgeCorruptedAuthStorage()` na boot + detecção de `bad_jwt`/`missing sub`/`Invalid Refresh Token` → `signOut()` + reload limpo. **Manter e cobrir com teste.**
- **Circuit breaker de fetch**: wrapper global em `supabase/client.ts` que, ao detectar 3 `Failed to fetch` consecutivos, força `purgeCorruptedAuthStorage()` + reload com `?v=timestamp`. Evita loop infinito.
- **Versionamento obrigatório**: `public/version.json` precisa ser bumpado em **toda** deploy. Adicionar check no pipeline: se `version.json` não mudou em deploy com mudança em `src/`, bloquear.
- **Service Worker `sw.js`**: revisar para garantir `NetworkFirst` em navegação HTML (nunca `CacheFirst` no shell). Já é o padrão — adicionar comentário travando a estratégia.

## 4. Domínio legado (`uhomeia.lovable.app`)

- **Redirect 301** de `uhomeia.lovable.app` → `uhomesales.com` para eliminar sessões com chaves antigas circulando.
- Comunicar corretores que o domínio oficial é `uhomesales.com` (já é, mas reforçar).

## 5. Processo de deploy

- **Janela de deploy**: evitar deploys de migration entre 8h–20h BRT (horário comercial). Crons críticos rodam o tempo todo; falha em horário de pico = caos.
- **Checklist obrigatório antes de aprovar migration**:
  1. Função/trigger referencia colunas que existem? (validar)
  2. Smoke test rodou? (anexar resultado)
  3. `version.json` bumpado?
  4. `useAuth` ainda tem `purgeCorruptedAuthStorage`?
- **Rollback documentado**: cada migration precisa do SQL inverso pronto.

## 6. Observabilidade contínua

- **Sentry/log central**: enviar erros de console e fetch failures do frontend para uma tabela `client_errors` via edge function. Já existe `error_logs` parcialmente — consolidar.
- **Alerta volumétrico**: se >20 `Failed to fetch` em 5 min de qualquer corretor → push para o CEO.

## 7. O que vou implementar agora (se aprovado)

Por escopo de uma única tarefa, proponho começar pelas **3 ações de maior impacto e menor risco**:

1. **Migration `cron_health`**: tabela + função `log_cron_run(name, status, error)` chamada em todos os crons existentes.
2. **Edge function `cron-health-monitor`**: alerta automático em falhas consecutivas.
3. **Circuit breaker de fetch** em `src/integrations/supabase/client.ts` + `src/hooks/useAuth.tsx`: 3 falhas → purge + reload.

Os itens 1, 4, 5 e 6 (CI gates, redirect de domínio, processo, Sentry) ficam como follow-ups separados pois envolvem mudança de processo e infraestrutura externa ao código do app.

## Pergunta de aprovação

Aprova começar pelas 3 ações da seção 7, ou prefere priorizar outro item da lista?
