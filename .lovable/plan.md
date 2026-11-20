# Desconsiderar visita de 17/11 (Vanesca Kieling / Thalia) para a Roleta

## O que encontrei
- Visita `2982cd8c` — cliente "Vanesca Kieling - Lake Eyre", corretora Thalia de Oliveira, 17/11 16h, status "realizada".
- Hoje a Roleta conta toda visita "realizada", sem exceção. Não existe forma de marcar uma visita como "não vale para Roleta".

## O que vou fazer
1. Criar a marcação "não vale para Roleta" na visita (com motivo, quem marcou e quando).
2. A contagem de visitas da Roleta (`roleta_visitas_realizadas_periodo`, fonte única de credenciamento, painéis e fechamento semanal) passa a ignorar visitas com essa marcação.
3. Marcar só esta visita, motivo: "Visita da corretora no imóvel sem presença da cliente (nem por vídeo)", e registrar na auditoria.
4. A visita continua no histórico do lead como está; nada mais muda (outras visitas, relatórios de visitas, etapa do lead).

## Conferência
- Antes/depois: contagem de visitas da Thalia na semana de 17/11 cai 1 (se não houver outra visita dessa cliente no período).
- Fechamento semanal já gravado não é alterado (registro imutável); a mudança vale para os cálculos ao vivo.

## Detalhe técnico
- Migration: `visitas.valida_roleta boolean not null default true`, `motivo_invalida_roleta text`, `invalidada_roleta_por uuid`, `invalidada_roleta_em timestamptz`; filtro `AND v.valida_roleta` na função.
- Update da visita `2982cd8c-bf2e-46b2-b8c3-247f1d691b2a` + linha em `audit_log`.
- Sem botão na tela nesta fase (pode virar fase 2 se quiserem marcar outras pelo CRM).
