
## Contexto do que descobri

Auditei o banco antes de propor:

- **Trigger de auto-presença já existe** (`trg_presenca_auto_credenciamento` em `roleta_credenciamentos`, dispara em INSERT com `status='aprovado'` e em UPDATE para `aprovado`). A função `registrar_presenca_auto_credenciamento` insere linha `roleta_presencas` com `status='na_empresa'`, `origem='auto_credenciamento'`, mapeando `janela` → `turno` (manhã, tarde, dia_todo → manhã+tarde).
- **Só que hoje ele não populou nada.** Existem 32 credenciamentos `aprovado` hoje (Manhã + Tarde) e apenas **1 linha em `roleta_presencas`** — e essa 1 é `origem='manual_gestor'`. Nenhuma `auto_credenciamento`. O trigger, portanto, não está entregando na prática hoje (motivo a investigar: ou foi criado após os primeiros approvals, ou está silenciosamente falhando).
- Billy John hoje: 2 credenciamentos aprovados (manhã e tarde), zero linha em `roleta_presencas`. Exatamente o caso que o Lucas relatou.

O comportamento que o Lucas pediu é justamente o que o trigger deveria fazer. Então o plano é (1) fazer o trigger realmente funcionar + backfill do dia, (2) refletir isso na UI: quem credenciou vira Presente automaticamente e só mostra o botão "Saiu"; quem não credenciou é que o gerente marca.

## O que vou fazer (em fases pequenas)

### Fase 1 — Backfill do dia e diagnóstico do trigger (migração)
1. Rodar backfill idempotente: para cada `roleta_credenciamentos` com `status='aprovado'` hoje, inserir a(s) linha(s) em `roleta_presencas` (`na_empresa`, `origem='auto_credenciamento'`, `chegou_em = c.created_at`) com `ON CONFLICT (corretor_id, data, turno) DO NOTHING`.
2. Recriar/normalizar `registrar_presenca_auto_credenciamento` (idempotente) para garantir que o gatilho funcione daqui pra frente. Confirmar que a unique key `(corretor_id, data, turno)` existe em `roleta_presencas`.
3. Reportar quantas linhas foram criadas no backfill e quantos corretores foram cobertos.

### Fase 2 — UI: distinguir "credenciado" de "não credenciado" (`PresencaRoletaPanel.tsx`)
Regra visual por turno em cada corretor:

- **Credenciado no turno + sem `saiu_em`** → chip verde `PRESENTE (via roleta)` + botão único **"Saiu"** (abre `RegistrarHorarioDialog` para carimbar horário). Sem botão "Presente" (já está).
- **Credenciado no turno + com `saiu_em`** → chip `SAIU HH:MM`. Sem botões (turno encerrado para ele).
- **Não credenciado no turno + sem presença registrada** → mostra os dois botões atuais **"Presente"** (registra horário chegada) e **"Faltou"** (opcional, para o gerente marcar explicitamente). Estes são os que o gerente precisa validar.
- **Não credenciado + `Presente` já marcado manual** → chip `NA EMPRESA (manual)` + botão "Saiu".
- **Faltou (auto do cron 01:00 BRT)** → chip vermelho `FALTOU`, sem ação (dia fechado).

### Fase 3 — Banner de pendências
Recalcular o texto do banner: **"N corretores sem presença marcada em [Turno]"** deve contar apenas **não credenciados sem `roleta_presencas`**, porque o resto já entra automático. Isso vai derrubar drasticamente o "27 pendentes" de agora.

### Fase 4 — Validação ao vivo
- Abrir `/roleta/presenca` no preview.
- Confirmar que Billy John, Andressa, Eliézer, etc. (todos credenciados) aparecem como **Presente** automaticamente nos turnos que credenciaram, com só o botão **Saiu** disponível.
- Confirmar que corretores não credenciados aparecem com **Presente / Faltou** (para o gerente validar).
- Confirmar contagens do header e do banner.

## Fora de escopo desta rodada
- Mexer em cron de "Faltou" (01:00 BRT) — segue como está.
- Mexer no fluxo de credenciamento em si.
- Mexer nas regras de elegibilidade Noturna/Domingo.

Se aprovado, começo pela Fase 1 (migração de backfill + recriação do trigger) e trago o número de linhas criadas antes de partir para a UI.
