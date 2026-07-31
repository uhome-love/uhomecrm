# Tarefas automáticas de visita — corrigir o fluxo que confunde o corretor

## O que aconteceu no lead "Massoterapeuta | Performance & Recuperação"

Auditoria feita agora no banco (lead `2196df7d…`, corretor William Brizola):

- Ao entrar na etapa Visita, **dois geradores diferentes** criam tarefa:
  - o gatilho da agenda (`visita_auto_tarefas`) cria **1** card: "Confirmar visita";
  - o gatilho de entrada de etapa (`trg_visita_stage_entry`) cria **3** cards de uma vez: "Confirmar visita", "Fazer visita" e "Registrar resultado da visita".
  - Resultado: o corretor vê 3 cards (mais o follow-up antigo) na mesma visita.
- Às 16:28 ele concluiu o card **"Fazer visita"** (subtipo `realizar_visita`). Esse subtipo hoje é mapeado no front para o fluxo **"registrar resultado"**, que grava a visita como **realizada** — e o gatilho `trg_visita_realizada_move_pos_visita` moveu o lead para **Pós-Visita** automaticamente.
- Ele apagou a visita e marcou de novo, mas o lead continuou marcado como "visita realizada" porque **apagar a visita não desfaz** a etapa nem o `flag_status`.

Estado atual do lead (já verificado): etapa **Visita**, `status_visita = marcada`, visita **01/08 17:30 – Casa Tua**. A única outra visita do lead é a de 27/06 com `no_show` (histórico real). **Não existe hoje nenhuma visita falsa "realizada"** para esse lead nem no CRM (consulta de visitas realizadas com data futura voltou vazia). Ou seja: o dado errado já se desfez ao remarcar; o que sobrou é lixo de tarefas.

## Solução proposta

### 1. Um card por vez (fim dos 3 cards)
Reescrever `trg_visita_stage_entry_fn` para criar **apenas** "Confirmar visita" (D-1) quando o lead entra na etapa Visita, e nada mais. Os cards seguintes passam a nascer em cadeia, sempre um de cada vez:

```text
Visita marcada  → [Confirmar visita]        (vence D-1)
  concluída     → [Registrar resultado]     (vence no dia/D+1)
  resultado     → realizada → Pós-Visita + [Alinhar próximos passos]
                → no-show   → [Reagendar visita]
```

O subtipo **`realizar_visita` é aposentado**: não é mais criado, e os 16 cards "Fazer visita" ainda pendentes viram "Registrar resultado" (mesmo lead, mesma data) para ninguém perder tarefa.

### 2. "Confirmar visita" nunca move o lead
Garantir no front (`VisitaCompletionFlow`) que o subtipo `confirmar_visita` só registra observação + marca a visita como confirmada — sem tocar em etapa nem em `status_visita`. E remover o mapeamento `realizar_visita → registrar_resultado` no `TaskCompletionDialog`, que é a causa direta do "confirmei e foi pra pós-visita".

### 3. Apagar/cancelar visita volta o lead ao lugar certo
Novo gatilho em `visitas` (DELETE e mudança para `cancelada`) que, se o lead estiver em Pós-Visita sem nenhuma outra visita realizada, devolve o lead para a etapa **Visita** (ou Qualificação, se não sobrar visita agendada), limpa `status_visita` do `flag_status` e cancela as tarefas `visita_auto` pendentes.

### 4. Limpeza do dado
- Cancelar as tarefas residuais duplicadas do lead do William (o follow-up solto criado 16:37 e qualquer `visita_auto` órfã), deixando apenas **"Confirmar visita — 01/08"**.
- Rodar a mesma normalização dos cards "Fazer visita" pendentes no CRM inteiro (16 registros).
- Não apago nenhuma visita: as duas existentes desse lead são legítimas (01/08 marcada e 27/06 no-show). Se você quiser que a de 27/06 saia do histórico, me confirma que eu removo.

## Detalhes técnicos

- Migração 1 (DDL): `CREATE OR REPLACE` de `trg_visita_stage_entry_fn` (só `confirmar_visita`), `visita_auto_tarefas` (encadeamento confirmar → registrar), e novo `trg_visita_removida_reverte_stage` em `visitas` (AFTER DELETE / AFTER UPDATE de status para `cancelada`).
- Ajuste em `fn_reconciliar_visita_auto` para não recriar `realizar_visita`.
- Frontend: `src/components/pipeline/task-completion/TaskCompletionDialog.tsx` (remover normalização de `realizar_visita`) e `VisitaCompletionFlow.tsx` (garantir que `confirmar_visita` só grava `confirmada` + observação e agenda o próximo card).
- Dados (tool insert, não migração): update dos 16 cards `realizar_visita` pendentes → `registrar_resultado`; cancelamento das tarefas residuais do lead do William.
- Validação ao vivo: criar visita em lead de teste → conferir 1 card só; concluir "Confirmar visita" → lead permanece em Visita; apagar a visita → lead volta e some o "realizada".
