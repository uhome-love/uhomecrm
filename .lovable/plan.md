# Bolsão: incluir os leads descartados (porta "Descartados recentes")

Os descartados já estavam previstos no mockup como a 2ª porta. Este plano fecha as regras para eles saírem do "limbo".

## Situação hoje (verificado nos dados)
Descartados que nunca tiveram visita nem negócio:
- 4.586 marcados como **reengajáveis** (quase todos arquivados, ou seja, sem dono e sem ninguém vendo).
- 1.877 **sem classificação** (descartes antigos, antes de existir o tipo).
- 1.264 **definitivos**.

## Regras propostas para os descartados
- Entram no Bolsão: **reengajáveis** e **sem classificação**.
- Ficam fora para sempre: **definitivos** (número errado, pediu para não ligar, já comprou etc.), quem teve visita ou negócio e os produtos que vão obrigatoriamente para a Fila CEO (Lake Baikal).
- **Espera de 7 dias** depois do descarte antes de aparecer, para não ligar logo em seguida para quem acabou de dizer não.
- Lista viva: todo novo descarte reengajável entra sozinho depois dos 7 dias.
- Mesma tela das outras portas: escolhe o empreendimento ou "Aleatório", um cliente por vez, sem ver o histórico anterior. Os resultados são Aproveitar, Não atendeu ou Sem interesse.
- **Sem interesse** no Bolsão vira descarte definitivo e sai da lista para sempre.
- **Aproveitar** leva para o pipeline do corretor em "Novo Lead", com o mesmo fluxo de reativação que a Oferta Ativa já usa (bloqueia se o telefone já está ativo com outro corretor).
- Se o lead aproveitado for descartado de novo, volta para a lista depois dos 7 dias. Se estagnar, vai para o gerente por 7 dias e depois para o Bolsão.

## Conflito com a Central de Reengajamento (WhatsApp)
Hoje os disparos usam esses mesmos descartados reengajáveis. Regra para não colidir:
- Um lead reservado ou aproveitado no Bolsão sai dos disparos.
- Um lead que está numa fila de disparo pendente, ou que respondeu "Sim" (foi para a Fila CEO), não aparece no Bolsão.
- Um lead que respondeu "Não" ao disparo (já fica inativo hoje) não entra.

## Perguntas em aberto
1. Os descartados **sem classificação** (1.877, os antigos) entram? A sugestão é sim.
2. Há um limite de idade do descarte, por exemplo só os dos últimos 6 meses, ou entram todos?

## Próximos passos
1. Você responde às 2 perguntas e aprova o mockup.
2. Plano técnico completo do Bolsão (estagnados + descartados), revisando a Base Única, a Oferta Ativa, a Central de Reengajamento e o Pipeline.
3. Construção em fases, validando cada uma.

## Detalhes técnicos
- Elegível descartado: etapa de descarte, `tipo_descarte` em ('reengajavel', NULL), `negocio_id` vazio, sem linhas em `visitas`, `stage_changed_at` há mais de 7 dias, canônico fora de `roleta_config.fila_ceo_obrigatoria_canonicos`, sem item pendente em `reengajamento_dispatch_queue`.
- Reaproveitar com `_shared/reactivateLead.ts` (já faz a checagem de duplicado e zera `tipo_descarte` e `motivo_descarte`).
