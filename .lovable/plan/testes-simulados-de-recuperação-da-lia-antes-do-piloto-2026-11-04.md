# Testes simulados de recuperação da Lia (antes do piloto)

## Objetivo
Validar como a Lia responde a clientes descartados, com 30 conversas simuladas, sem mandar nada para cliente real. Só depois de 100% aprovado, um teste real com o número do Lucas.

## O que muda para você (aba Laboratório da Lia)

```text
+-----------------------------------------------------------+
| Validação da recuperação        [Rodar os 30 testes]      |
| 24 de 30 aprovados  ████████████░░░   2 para ajustar      |
+-----------------------------------------------------------+
| Cenário: "Já comprou com outra imobiliária"   [Aprovado]  |
|  Cliente simulado: Marina, descartou Open Bosque (sem     |
|  renda), há 40 dias                                       |
|  Lia: "Oi Marina! Aqui é a Lia, do Relacionamento..."     |
|  Cliente: "já comprei, obrigada"                          |
|  Lia: "Que bom! Parabéns pela conquista..."               |
|  Conferências automáticas:                                |
|   ✔ não insistiu  ✔ marcou para encerrar  ✔ sem travessão |
|  [Aprovar] [Ajustar + comentário]  [Rodar de novo]        |
+-----------------------------------------------------------+
```

- 30 cenários (os 15 de hoje + 15 novos): quer ver Natal, quer outro perfil, pergunta preço/entrega/FGTS/entrada/renda de cada um dos 8 produtos, pede pra não receber mais, irritado, já comprou, pergunta se é robô, pede o corretor antigo, some no meio, pergunta algo fora da ficha.
- Clientes simulados montados a partir de descartes reais (motivo, produto, tempo), mas com nome fictício e sem telefone.
- Cada conversa tem conferências automáticas (sem promessa de crédito, sem renda cravada, sem preço fora da ficha, opt-out respeitado, nunca devolve ao corretor antigo, resultado certo: quente → Fila CEO, não quer → encerra/inativa).
- Você lê e aprova ou pede ajuste; aprovação fica salva no sistema (hoje só fica no navegador).

## Teste real com você (depois dos 30 aprovados)
Disparo único da mensagem de recuperação para +55 51 99259-7097, com cliente de teste fictício. Você conversa como cliente; o resultado cai na Fila CEO marcado como TESTE, e eu desfaço no fim. Nenhum outro número recebe nada.

## O que NÃO muda
- Lia continua em modo de teste, sem campanhas novas, sem leads novos.
- Nenhum descarte real recebe mensagem.
- Roleta e distribuição intocadas.

## Detalhes técnicos
- Novo modo `recuperacao` em `lia-chat` (prompt próprio de recuperação + fichas ativas de `lia_produtos`), sem mexer no modo atual de Canoas.
- Nova função `lia-laboratorio` (só admin/CEO): gera cenários, conduz o cliente simulado por IA e roda as conferências; grava em nova tabela `lia_laboratorio_execucoes` (RLS admin/CEO).
- Testes automáticos das conferências em `src/lia/`.
- 1 migration (fora do pico, respeitando limite diário).
- Teste real: envio único via instância da Lia, liberado só para o número do Lucas.
