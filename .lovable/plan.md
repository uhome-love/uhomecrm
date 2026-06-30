## Objetivo

1. **Janela de silêncio 00:00–09:00 (BRT)**: a cadência "Sem Contato" nunca dispara notificações (push, sino e WhatsApp) nesse intervalo. O que vencer de madrugada é segurado e sai a partir das 09:00.
2. **Os 42 leads `concluida` (T7 cumprido)**: emitir o **aviso de descarte** amanhã às **09:30 BRT**, iniciando a contagem de 24h até o descarte automático (reengajável).

Nada de reset nos demais leads.

## Mudança 1 — Janela de silêncio (edge function `lead-escalation`)

Hoje o bloco da cadência (seção 4e) insere direto na tabela de notificações e envia WhatsApp, **furando** o horário de silêncio (havia um requisito antigo de "disparar a qualquer hora").

Ajuste: antes de processar a cadência, calcular a hora atual em **America/Sao_Paulo**; se estiver entre **00:00 e 08:59**, **pular** o bloco inteiro da cadência nesse ciclo (não chama o RPC de envio). Como o cron roda a cada minuto, assim que der 09:00 tudo que venceu na madrugada é processado normalmente.

```text
hora_brt = agora em America/Sao_Paulo
se hora_brt < 9:  pular cadência (return/skip do bloco 4e)
senão:            processar normalmente
```

Efeito: nenhuma notificação da cadência entre 00:00–09:00; nada é perdido, só adiado para as 09:00.

## Mudança 2 — Agendar os 42 para amanhã 09:30 (operação de dados)

Reaproveita o fluxo já validado (aviso T7 → 24h → descarte automático). Em vez de disparar agora, define a hora de disparo para **amanhã 09:30 BRT**:

- `status` → `ativa`
- `tentativa_atual` → `6`
- `proxima_em` → amanhã **09:30 (America/Sao_Paulo)**

No ciclo do cron logo após 09:30, o motor avança para a **tentativa 7**, envia o **"Aviso de descarte"** (1 notificação por lead) e abre a janela de 24h; sem retorno, o lead vai para Descarte (reengajável).

```sql
UPDATE lead_cadencia_sem_contato c
   SET status = 'ativa',
       tentativa_atual = 6,
       proxima_em = timezone('America/Sao_Paulo', ((CURRENT_DATE + 1) + time '09:30')::timestamp),
       updated_at = now()
  FROM pipeline_leads pl
 WHERE pl.id = c.pipeline_lead_id
   AND c.status = 'concluida'
   AND c.tentativa_atual = 7
   AND pl.stage_id = '2fcba9be-1188-4a54-9452-394beefdc330'
   AND pl.arquivado IS NOT TRUE;
```

## Não será alterado

- As cadências ativas (T2–T6) seguem de onde estão (mas também respeitarão a janela de silêncio).
- Trigger, cron, RPCs e textos das tentativas permanecem inalterados.
- Os 2 leads sem corretor continuam fora.

## Validação

- Conferir nos logs da função `lead-escalation` que, antes das 09:00 BRT, o bloco da cadência é pulado.
- Amanhã após 09:30, confirmar que os 42 passaram a `aguardando_descarte` com `proxima_em ≈ +24h` e que o aviso T7 foi enviado.
