# Avisos do cliente seguindo a mesma cor do Pipeline

## O que o corretor relatou (áudio + print)
- Recebe "Renata Mohr está sem atualização" (vermelho), mas no Pipeline ela está verde.
- Clientes somem do Pipeline (estagnam) e ele não percebe a tempo.

## O que encontrei (confirmado nos dados)
Você está certo: o aviso não segue a cor do Pipeline.
- **A cor do Pipeline** conta os dias desde o último contato do corretor, com prazo por etapa. Aquecimento fica verde até 15 dias, amarelo até 30 e estagna com 21 sem contato.
- **O aviso "sem atualização"** usa uma regra antiga e única: 7 dias, em qualquer etapa. Renata, Cintia e Josiane tiveram o último contato em 14/10. Com 7 dias em Aquecimento, estão verdes de verdade, mas receberam o aviso vermelho.
- Além disso, ao mandar esse aviso, o sistema grava no cliente como se ele tivesse sido atualizado. Isso aconteceu em 614 avisos nos últimos 30 dias e esconde a data real.
- Por outro lado, a passagem para amarelo e para vermelho não gera aviso. Só existe o aviso final da estagnação.

## Como fica
Os avisos passam a seguir as cores do Pipeline, uma vez por cliente em cada mudança:
1. **Verde:** sem aviso.
2. **Ficou amarelo:** "Renata Mohr precisa de atenção · X dias sem contato".
3. **Ficou vermelho:** "Renata Mohr está desatualizada · estagna em X dias".
4. **Prestes a estagnar** (os avisos que já existem: "estagna em 24h/48h" e cadência Sem Contato): continuam iguais.
5. O aviso antigo de 7 dias é desligado.
6. Os avisos deixam de contar como atualização do cliente.

Nenhuma regra de cor, estagnação, cadência ou distribuição muda. Só os avisos passam a seguir a mesma régua.

## Validação
- Renata, Cintia e Josiane: confirmar que hoje não recebem aviso, porque estão verdes.
- Conferir quantos clientes receberiam aviso amarelo ou vermelho na primeira rodada, sem enviar nada. Se forem muitos, mando no primeiro dia só o resumo por corretor.
- Ver o sino de um corretor ao vivo, sem alterar clientes reais.

## Detalhes técnicos
- `detectar_leads_parados`: trocar o critério de `updated_at < 7 dias` por `lead_saude_status` (a mesma fonte de `leadSaude.ts`). Notificar só na transição verde→ambar e ambar→vermelho, com dedup `agrupamento_key` = `saude_<cor>_<lead_id>_<relogio>`, para reavisar só se houver novo contato e nova queda.
- O UPDATE de `last_escalation_at`/`escalation_level` não pode tocar em `updated_at`/`ultima_acao_at`. Ajustar o trigger para ignorar updates só desses campos de sistema (e dos campos de aviso da cadência).
- Backfill via run_sql: restaurar `ultima_acao_at` dos leads em que ele coincide com o horário de uma notificação automática.
- Migration só após 19h BRT. Os avisos de pré-estagnação e de cadência não mudam.
