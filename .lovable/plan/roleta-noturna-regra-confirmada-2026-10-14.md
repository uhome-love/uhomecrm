# Roleta noturna — regra confirmada

## Regra (com a regra dos 80% ligada)
Para se credenciar e receber leads na Roleta noturna, o corretor precisa cumprir **todas** as condições abaixo:
1. **1 visita no dia**: pelo menos 1 visita **marcada ou realizada** com data de hoje (BRT). Visita cancelada não conta.
2. **CRM em 80% ou mais**: mesmo cálculo da Saúde da carteira.
3. **2 visitas realizadas na semana anterior** (segunda a domingo). Vale a partir de 19/10, junto com a chave das visitas. Até lá, esta condição não é cobrada.
4. **Limite de 100 descartes no mês**: continua como hoje.

Saem da noite: presença confirmada de manhã e de tarde.
Domingo continua como já foi confirmado: 2 visitas realizadas de segunda a sábado, CRM em 80% ou mais e o limite de descartes.

## Correção em relação ao preparado
A correção preparada tirava a exigência de visita no dia da noite. Ela volta, agora aceitando visita **marcada ou realizada**.

## Avisos para o corretor
O motivo do bloqueio aparece no botão, na Minha rotina e no sininho:
- "Para a Roleta da noite você precisa de 1 visita marcada ou realizada hoje."
- Para o CRM e as visitas da semana, os textos já combinados.
- O credenciamento continua manual e nos horários atuais (noite das 18h às 20h).

## Validação (depois das 19h, com teste desfeito no final)
- Corretor sem visita hoje: barrado na noite e vê o motivo.
- Corretor com visita só marcada hoje: liberado.
- Corretor com visita realizada hoje: liberado.
- Corretor com 79% de CRM e visita hoje: barrado pelo CRM.
- Com a chave das visitas ligada no teste: quem teve menos de 2 visitas realizadas na semana anterior é barrado e quem teve 2 ou mais é liberado.
- Na entrega dos leads da noite, o sistema confere de novo. Quem não cumpre, não recebe. Se ninguém cumprir, o lead vai para a Fila do CEO.
- No final, as duas chaves voltam a ficar desligadas.

## Detalhes técnicos
- `corretor_pode_entrar_roleta` e `corretor_pode_entrar_roleta_noturna`: com `crm_gate_ativo`, a noite exige visita do dia (status marcada/realizada, data BRT = hoje) + `roleta_crm_apto`. Com `visitas_gate_ativo`, exige também 2 ou mais visitas válidas realizadas na semana ISO anterior (BRT).
- Retirar só a exigência de presença manhã/tarde da noite.
- `roleta_motivo_bloqueio`: código `sem_visita_hoje` com o novo texto, mais a frase de credenciamento manual.
- `distribuir_lead_atomico`: o filtro do grupo noturno usa a mesma função (fonte única).
- Tudo numa única migração, aplicada depois das 19h. Na tela, só ajustar o texto do motivo.
