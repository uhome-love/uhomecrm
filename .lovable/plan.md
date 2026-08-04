# Fechar o buraco de auth dos 3 crons (sem segredo novo)

## O que foi confirmado antes de planejar

- Os 3 jobs realmente mandam a **chave anon literal** no header `Authorization` (verificado em `cron.job`, jobids 4, 10 e 14). Como a anon é pública, hoje qualquer pessoa consegue chamar essas funções.
- **Já existe a service-role no Vault** do banco, com o nome `supabase_service_role_key` (e também `supabase_url`). Ou seja: **não precisa criar segredo novo nem embutir a chave literal no cron**.
- Esse padrão já é usado em produção hoje pelo job `stalled-deals-weekly-notify` (jobid 8), que monta o header com `'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key')`. Vamos copiar exatamente esse padrão.
- O helper `requireCronAuth` (em `_shared/cron-auth.ts`) **aceita bearer igual à service-role**, além do header `x-cron-secret`. Como `CRON_SECRET` não está configurado no projeto, o caminho service-role é o que vai valer — e funciona.
- Nenhuma tela do app chama essas 3 funções (busca no código: só aparecem em listas de monitoramento/documentação). Então travar não quebra nada de frontend.
- Achado colateral (fora do escopo, só registrando): o job 60 `oa-devolucao-automatica-diaria` busca no Vault um nome que não existe (`service_role_key` em vez de `supabase_service_role_key`), então provavelmente manda "Bearer " vazio. **Não vou tocar nele** neste build — fica anotado.

## Caminho escolhido para o item 1

Referência **não-literal** via Vault. A chave nunca aparece escrita em `cron.job`; o comando só contém uma consulta ao Vault, resolvida na hora da execução. Sem tradeoff de exposição.

## Ordem de execução (obrigatória)

1. **Passo 1 — reagendar os 3 crons** (só a credencial muda; url, body e schedule idênticos). Nesse momento as funções ainda estão sem cadeado, então elas continuam aceitando tudo: **zero risco de perder ciclo**.
2. **Passo 2 — confirmar na prática** que o cron de 1 minuto voltou a rodar e foi aceito, olhando o histórico de execução (`cron.job_run_details` para os jobids 4 e 14) e a resposta HTTP registrada em `net._http_response` (esperado: status 200, não 401).
3. **Passo 3 — só depois disso**, deployar os guards nas 3 funções.

A garantia da ordem é o fato de serem duas etapas separadas com uma checagem entre elas: a migration do passo 1 é aplicada e validada antes de qualquer edição de arquivo. Se o passo 2 mostrar 401 ou nenhuma execução, **paro e reporto** em vez de deployar o guard.

## Sobre o comportamento das funções (item 4)

Trocar anon → service-role **não muda nada** no que as funções fazem. As três já criam o cliente do banco internamente com `SUPABASE_SERVICE_ROLE_KEY` (confirmado no código das três). O bearer da requisição só é usado para a checagem de autenticação na entrada — não é usado para consultar dados. Em `generate-monthly-report`, o bearer hoje passa por uma validação de token que aceita a anon; ela será substituída pelo guard novo.

---

## Detalhes técnicos

### Passo 1 — Migration de reagendamento (só isso, mais nada)

```sql
-- jobid 4 — lead-escalation (mantém schedule '* * * * *', url e body)
SELECT cron.alter_job(
  4,
  command := $cmd$
  SELECT net.http_post(
    url := 'https://hunbxqzhvuemgntklyzb.supabase.co/functions/v1/lead-escalation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1)
    ),
    body := '{"time": "now"}'::jsonb
  ) AS request_id;
  $cmd$
);

-- jobid 14 — typesense-sync
SELECT cron.alter_job(
  14,
  command := $cmd$
  SELECT net.http_post(
    url := 'https://hunbxqzhvuemgntklyzb.supabase.co/functions/v1/typesense-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cmd$
);

-- jobid 10 — generate-monthly-report (schedule '0 10 1 * *')
SELECT cron.alter_job(
  10,
  command := $cmd$
  SELECT net.http_post(
    url := 'https://hunbxqzhvuemgntklyzb.supabase.co/functions/v1/generate-monthly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cmd$
);
```

`cron.alter_job` só troca o comando: jobname, schedule e ativo permanecem intactos.

### Passo 2 — Verificação antes do guard

```sql
SELECT jobid, status, start_time, return_message
FROM cron.job_run_details
WHERE jobid IN (4, 14)
ORDER BY start_time DESC LIMIT 10;

SELECT id, status_code, created
FROM net._http_response
ORDER BY created DESC LIMIT 10;
```

Critério para seguir: execuções `succeeded` nos jobs 4 e 14 após o reagendamento e respostas HTTP 200. Job 10 é mensal — validado por chamada manual pontual com a service-role, sem alterar o schedule.

### Passo 3 — Edições nas funções (3 arquivos, nada além)

`supabase/functions/lead-escalation/index.ts`
- Importar `requireCronAuth` de `../_shared/cron-auth.ts`.
- Logo no início do `Deno.serve`, depois do tratamento de `OPTIONS`: `const denied = requireCronAuth(req); if (denied) return denied;`

`supabase/functions/typesense-sync/index.ts`
- Mesmo padrão, no início do `serve`, após o `OPTIONS`.

`supabase/functions/generate-monthly-report/index.ts`
- Remover o bloco atual de validação (`getClaims`, que aceita a anon key).
- Trocar por `requireRealUser(req, { allowServiceRole: true, roles: ["admin"] })` de `../_shared/ai-auth.ts` — assim o cron passa pela service-role e um humano só passa se for admin autenticado de verdade.

Sem mexer em `config.toml`, sem tocar em outros crons, webhooks, frontend ou segredos. Sem publish.
