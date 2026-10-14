# Visita da Rafaela Campos não sai da tela (Reagendar)

## O que aconteceu (conferido)
- A visita é da cliente Lea Dorneles Hemann, no Casa Tua Porto Alegre, hoje às 15:00.
- A Rafaela registrou o feedback **3 vezes**, e as 3 observações estão salvas.
- Ela escolheu **"Reagendar"**. Hoje, essa opção mantém a visita como "marcada" **na mesma data e hora (hoje 15:00)**, sem pedir a nova data.
- Como já passou das 17:00 (2h depois do horário), a tela volta a bloquear logo em seguida. Por isso ela fica presa.
- Isso vale para qualquer corretor que escolher "Reagendar" na tela de bloqueio.

## O que vou fazer
1. **Liberar a Rafaela agora:** marcar essa visita como reagendada e tirar o bloqueio. O feedback dela continua salvo, e a Lea continua com ela na etapa Visita, aguardando a nova data.
2. **Corrigir o "Reagendar":** ao escolher essa opção, a janela passa a pedir a **nova data e hora**, que são obrigatórias. A visita é atualizada para a nova data, e o bloqueio só volta se esse novo horário também passar sem feedback.
3. Ninguém mais fica preso em repetição.

## Como vou validar
- Com um cliente de teste: criar uma visita vencida, escolher Reagendar com nova data e conferir que a tela libera e a visita aparece na nova data na agenda. Depois apago o teste.
- Conferir que a tela da Rafaela não bloqueia mais.

## Detalhes técnicos
- `registrarResultadoVisita.ts`: hoje, `reagendar` define `status = 'marcada'` e mantém `data_visita` e `hora_visita`, o que faz o filtro de `VisitaPendenteBloqueio` (horário mais 2h menor que agora) disparar de novo.
- `VisitaResultadoDialog.tsx`: ao escolher `reagendar`, mostrar campos de data e hora obrigatórios (data a partir de hoje). Repassar esses valores para `registrarResultadoVisita`, que grava a nova `data_visita` e `hora_visita`.
- Liberar a visita `b57b5418` com uma correção de dados pontual: status reagendada/cancelada, conforme os status já aceitos pela tabela, sem apagar observações. Não precisa de mudança na estrutura do banco.
