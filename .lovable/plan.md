## O que está acontecendo (diagnóstico)

Existe **sim** uma engine de disparo ativa via WhatsApp Meta — não é um envio manual seu, é o **motor de reengajamento de leads descartados** (`reengajamento-descartados-enqueue`). Ele dispara templates Meta em massa para uma base fria de leads descartados.

**Volume dos últimos 6 dias (08 a 11/07):**

```
Total enviado: ~3.766 mensagens
  read:      1.367
  failed:    1.224   ← 32% de falha
  delivered:   860
  responded:   191
  sent:        124
Templates: connectjw_julho, flow_novidade2, lakebaikal_novidade2, casatua_*
```

Uma taxa de falha de ~32% em base fria é exatamente o padrão que faz o Meta sinalizar **spam / queda de qualidade do número**.

**Por que você não viu disparo hoje/ontem:** a janela do motor é **seg–sex, 09h–20h BRT**. Sábado (12) e domingo (13) ele fica parado — mas **está armado para voltar a disparar segunda-feira (14/07) às 09h**.

**Estado atual (tudo ligado):**
- `system_flags.campaign_dispatch_enabled = TRUE` (destravado manualmente em 10/07)
- `reengajamento_config.enabled = TRUE`, `paused = FALSE`
- **760 leads ainda pendentes** na fila (`reengajamento_dispatch_queue`, status `pending`) → seriam disparados na segunda

## Plano — parar na fonte

**1. Kill switch global (para tudo imediatamente)**
- `system_flags.campaign_dispatch_enabled = FALSE` com `reason` explicando (aviso de spam do Meta, 13/07). Isso já bloqueia todas as edge functions de campanha via `campaign-gate.ts` (fail-safe já existente).

**2. Desligar o motor de reengajamento na config**
- `reengajamento_config`: `enabled = FALSE`, `paused = TRUE`, `paused_reason = 'Aviso de spam Meta - 13/07/2026'`, `paused_at_brt = now()`.

**3. Esvaziar a fila pendente (impede o disparo de segunda)**
- `UPDATE reengajamento_dispatch_queue SET status='cancelled' WHERE status='pending'` (760 registros). Nada é apagado do histórico — só cancelado para não enviar.
- Marcar os `reengajamento_dispatch_runs` ainda em `running`/`pending` como cancelados.

**4. Garantir que nenhum cron reative sozinho**
- Verificar/remover qualquer `cron.schedule` que chame `reengajamento-descartados-enqueue`, `whatsapp-campaign-dispatch`, `test-reengajamento-wave2` ou `visita-amanha-enqueue` (via migration). O flag global já era "manual only", mas confirmo e travo.

**5. Confirmação pós-execução**
- Reconsultar as 3 travas + contagem da fila para provar que está tudo parado (0 pending, flags FALSE).

## Detalhes técnicos

- Passos 1–4 são mudanças de dado/DDL → feitos via **migration** (não dá pra fazer por `psql`, que é só leitura/insert).
- Nenhum histórico de disparo é apagado — `reengajamento_meta_disparos` fica intacto para auditoria. Só interrompo o que ainda não foi enviado.
- Isso **não** desativa o WhatsApp do CRM (atendimento 1:1, respostas, inbox) — só o motor de marketing/reengajamento em massa.
- Reativação futura fica manual e consciente (destravar os 3 pontos de novo), de preferência só depois que o número recuperar qualidade no Meta.

## O que NÃO faço agora
- Não excluo o motor nem os templates (podem ser reusados depois com base quente e volume controlado). Se você preferir remover de vez, me avise que ajusto o plano.