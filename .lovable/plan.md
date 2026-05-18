# EXECUÇÃO Item 1 Fase 0 — `receive-meta-lead` (v2, com adendo da quebra de hoje 19→21h BRT)

## ⚠️ Adendo crítico — quebra de hoje (17/05, ~19→21h BRT)

**Evidência confirmada:**
- Last success: `2026-05-17 22:00 UTC = 19:00 BRT` (último `Lead created via Meta Ads` em `ops_events`).
- A partir daí: 100% dos requests retornam 503 `META_WEBHOOK_SECRET not configured`.
- `secrets--fetch_secrets` agora: **`META_WEBHOOK_SECRET` ausente** (outros `*_WEBHOOK_SECRET` como `LANDING_WEBHOOK_SECRET` estão lá). Removido seletivamente entre 19h e 21h BRT.
- Você confirmou: **não mexeu**. Então alguém/automação removeu **sem rastro humano direto** — exatamente o cenário que a Regra 9 deve impedir.

**Pode recuperar o valor antigo?** Não. A plataforma de secrets não guarda histórico de valor apagado. O que existia era um shared-secret arbitrário; só importa que o valor no projeto bata com o header `x-webhook-secret` nos cenários Make. Geramos novo, você troca no Make, voltou ao normal.

**Pode recuperar os leads que tentaram entrar 19→agora?** Sim — Make.com guarda execuções por ~7 dias e tem botão **"Run again"** por execução com erro. Após repor o secret + atualizar header, replay manual de cada execução com erro 503 dos cenários Meta. Vou te dar a contagem exata por scenario depois do BLOCO 1.d.

**Investigação "quem apagou":** após o BLOCO 1, abro adicional **BLOCO 0.2** (read-only): vasculhar `audit_log`, `cron.job_run_details` e qualquer função do projeto que chame `secrets.delete` ou `vault.delete_secret` para identificar a fonte. Se não houver rastro, registro em mem como "remoção fantasma" e a Regra 9 vira tripwire: criar uma edge function `secrets-tripwire` que roda a cada 10min, lista secrets esperados, e dispara push pro CEO se algum sumir.

---

## BLOCO 0.1 — Tripwire de secrets (NOVO, executar junto com BLOCO 1)

a) Criar `supabase/functions/secrets-tripwire/index.ts`: lista esperada `["META_WEBHOOK_SECRET","LANDING_WEBHOOK_SECRET","SYNC_SECRET","WHATSAPP_ACCESS_TOKEN","VAPID_PRIVATE_KEY","EVOLUTION_API_KEY","MAILGUN_API_KEY"]`. Para cada, checar `Deno.env.get(name)`. Se faltar → inserir `notifications` (categoria `sla_urgente`) para todos `user_roles` com role `ceo` + log `error/system` em `ops_events`.
b) Agendar via `pg_cron` a cada 10min (1 migration). Cota: 1 das 2/dia.
c) Não precisa UI — alerta vai pro sininho do CEO.

## BLOCO 0.2 — Forense da remoção (read-only, paralelo)

a) Query `audit_log` entre 17/05 18:00 e 22:00 BRT filtrando `modulo ILIKE '%secret%' OR acao ILIKE '%delete%' OR acao ILIKE '%vault%'`.
b) Listar runs de cron entre essas horas via `cron.job_run_details`.
c) `rg "deleteSecret\\|vault.*delete\\|secrets.delete" supabase/functions/ src/` para mapear código que pode apagar.
d) Resultado: registrado em `mem://bugs/meta-webhook-secret-removido-17mai2026` com causa identificada ou marcado como "origem desconhecida — tripwire ativo".

---

## Resto do plano (inalterado vs. v1)

### BLOCO 1 — Restaurar ingestão
a) `secrets--add_secret(["META_WEBHOOK_SECRET"])` → gero string aleatória 48 chars.
b) Devolvo valor + instrução para você colar no header `x-webhook-secret` dos cenários Make Meta.
c) Aguardo confirmação que Make foi atualizado.
d) Smoke test via `curl_edge_functions` → 200.
e) Reporto: quantos 503s ocorreram na janela 19h→agora (estimativa de leads-tentativa para você fazer "Run again" no Make).

### BLOCO 2 — CANCELADO (0 órfãos no banco, já validado v1).

### BLOCO 3 — Opção A no código
- Trocar `logOps("error","integration","Distribution failed…orphaned")` por `logOps("info","business","Lead enfileirado na Fila CEO")` quando `no_fila_active`.
- Atrás de flag `META_FALLBACK_FILA_CEO` (default true).
- Diff mostrado antes do deploy. Pausa para sua aprovação.

### BLOCO 4 — `error_detail` em insert failures
- Capturar `err.message/code/details/hint` + payload anonimizado no catch do INSERT.
- Deploy junto com BLOCO 3.

### BLOCO 5 — Painel `/admin/ingestao`
- Cards taxa sucesso 24h/7d/30d por `receive-*`, contagens, p95.
- Alerta 503 já coberto pelo BLOCO 0.1 (tripwire) + cron `lead-escalation`.

---

## Regras a salvar em `mem://rules/engineering/permanent-rules-2026-05`

- **Regra 9 (secrets):** Nunca deletar secret sem antes `rg "Deno.env.get\\(\"NOME\"\\)" supabase/functions/`. Para remoção segura: renomear `*_DEPRECATED_yyyymm`, esperar 30 dias, então deletar. **Tripwire ativo via `secrets-tripwire` cron a cada 10min — qualquer sumiço dispara push pro CEO.**
- **Regra 10 (receive-* failover):** Persistir lead sempre. Falha de distribuição é `info/business`, não `error`. Estado canônico de Fila CEO = `pipeline_leads.aceite_status='pendente_distribuicao' AND corretor_id IS NULL`.

## Migrations consumidas

- 1 migration (BLOCO 0.1: agendar pg_cron). Restante da cota livre para o dia.

## Rollback (atualizado)

- BLOCO 0.1: deletar cron + função → tripwire some, sem efeito colateral.
- BLOCO 0.2: read-only, sem rollback.
- BLOCOS 1/3/4/5: idênticos à v1.

## Retorno final

A. Status por bloco. B. Órfãos: **0/0/0**. C. Replays Make + contagem de 503 da janela 19h→agora. D. Achado forense de quem deletou o secret (ou marcação "desconhecido"). E. Impacto fechado: 503 da janela × CPL ponderado ≈ R$ 17/lead. F. Diff `receive-meta-lead` antes do deploy. G. Regras 9 e 10 + tripwire ativo confirmados.

**Aprove "Implement plan" para começar.** Pausarei antes do deploy do BLOCO 3.
