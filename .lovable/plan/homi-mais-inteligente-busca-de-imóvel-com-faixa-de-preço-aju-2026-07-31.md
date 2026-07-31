# HOMI mais inteligente: busca de imóvel com faixa de preço, ajuda de atendimento e modo "resolver o dia"

## O que aconteceu no teste da Larissa

Pedido: "apartamento de 3 dorms, de 1M até 1,5M no Menino Deus, mobiliado".

O que o HOMI fez: trouxe apartamentos abaixo de 1M.

Causa confirmada (auditoria no código e no banco):

1. A ferramenta de busca do HOMI só tem 3 campos: `termo`, `dormitorios` e `valor_max`. **Não existe valor mínimo** — então "de 1M até 1,5M" vira só "até 1,5M".
2. O resultado é ordenado do **mais barato para o mais caro**, então as primeiras opções são justamente as abaixo de 1M.
3. **Não existe filtro de mobiliado**, apesar de a base ter esse campo preenchido.
4. Dormitórios usa "3 ou mais", nunca "exatamente 3".

O estoque existe: 51 imóveis ativos com 3 dorms no Menino Deus entre R$ 1M e R$ 1,5M — sendo 14 mobiliados. Ou seja, é falha de interpretação/filtro, não de catálogo.

## Parte 1 — Busca de imóvel que entende o pedido inteiro

Ampliar a ferramenta `buscar_imovel` para aceitar tudo que o corretor fala num texto só:

- **Faixa de valor**: `valor_min` + `valor_max` ("de 1M até 1,5M", "entre 800 e 900 mil", "a partir de 2M", "até 600k").
- **Dormitórios exatos vs. mínimo**: "3 dorms" = exatamente 3; "3+ dorms" / "no mínimo 3" = 3 ou mais.
- **Mobiliado**: filtro real na coluna `mobiliado`.
- **Suítes, vagas e área mínima**: "com suíte", "2 vagas", "acima de 90m²".
- **Tipo**: apartamento / casa / cobertura / terreno.
- **Bairro/empreendimento** continuam no termo livre (Menino Deus, Petrópolis, The Arch...).

Regras de comportamento:

- Ordenação passa a ser por **aderência ao pedido** (dentro da faixa primeiro, depois preço crescente dentro da faixa) — nunca mais "o mais barato do banco".
- Se não houver nada exato, o HOMI **avisa qual critério ele relaxou** ("não achei mobiliado nessa faixa, trouxe 4 sem mobília no mesmo prédio") em vez de devolver silenciosamente outra coisa.
- Se o pedido tiver faixa, o HOMI **repete a faixa entendida em 1 linha** antes dos cartões ("3 dorms, Menino Deus, R$ 1,0M–1,5M, mobiliado — achei 14").
- Instruções explícitas no prompt com exemplos de extração, para o modelo nunca mais jogar um teto onde havia uma faixa.

O card de busca manual (botão "🔎 Imóvel") ganha os campos novos: valor mínimo, mobiliado, suítes/vagas.

## Parte 2 — Ajuda de atendimento com exemplos reais

Hoje o painel do HOMI só sugere atalhos genéricos ("Mensagem de WhatsApp"). Vamos trocar por exemplos escritos como o corretor fala, incluindo o caso citado:

- "Me ajuda a fazer um follow-up com um lead do Casa Tua que parou de responder"
- "Cliente disse que vai pensar — como respondo?"
- "Me busca um apartamento de 3 dorms de 1M a 1,5M no Menino Deus, mobiliado"
- "O lead achou caro, quebra essa objeção pra mim"
- "Script de ligação pra lead que não atende há 3 dias"
- "Como conduzo esse atendimento pra fechar uma visita no sábado?"

Cada exemplo é clicável e já dispara o pedido completo. Ficam visíveis na tela inicial do HOMI (agrupados em "Atendimento" e "Imóveis") e como atalhos na barra superior.

Além disso, reforço no cérebro do HOMI para pedidos de atendimento:

- Quando o corretor cita um lead ou empreendimento (ex.: "lead do Casa Tua"), o HOMI **lê o contexto do lead antes de escrever** (já existe essa ferramenta, hoje ela é subutilizada em pedidos genéricos) e usa os diferenciais reais do empreendimento.
- Entrega sempre: 1 linha de leitura da situação + mensagem pronta pra copiar + sugestão do próximo passo.
- Nada de perguntar "em que etapa está o lead?" quando dá pra deduzir do CRM.

## Parte 3 — Modo "resolver o dia": tarefas, visitas e briefing

O HOMI hoje só sabe *listar* pendências. Vai passar a **conduzir a execução**.

### Fila de execução (1 em 1 ou 3 em 3)

Quando o corretor pedir "me ajuda a concluir minhas tarefas atrasadas" ou "tenho leads sem tarefa?", o HOMI monta uma fila e apresenta **um card por vez** (ou 3 por vez, se o corretor pedir "de 3 em 3"):

- Mostra: nome do lead, empreendimento, etapa, há quanto tempo sem contato, última interação e a tarefa em aberto.
- Sugere a ação certa já escrita: mensagem de follow-up pronta pra copiar, ou o texto de conclusão da tarefa.
- Botões no card: **Concluir tarefa** · **Criar próxima tarefa** · **Pular** · **Abrir lead**.
- Ao concluir, ele já emenda o próximo da fila e mostra o progresso ("3 de 11 resolvidas").

Duas filas atendidas pelo mesmo fluxo:
- **Tarefas atrasadas** (data/hora BRT vencida).
- **Leads sem nenhuma tarefa pendente** — aqui a sugestão é criar a próxima ação, não concluir.

### Visitas

Perguntas que passam a ter resposta direta e acionável:
- "Quais visitas tenho que confirmar?" → visitas agendadas para amanhã/próximos dias ainda não confirmadas, com mensagem de confirmação pronta e botão de confirmar.
- "Quais visitas tenho pendentes?" → visitas cuja data já passou e ainda não têm resultado registrado, com botão de registrar resultado (realizada / no-show).
- Respeita as regras atuais de visita (confirmar ≠ realizar; 1 visita por cliente por dia).

### Briefing objetivo

"Faz meu briefing do dia" devolve um bloco curto e direto, sem enrolação:
- 3 a 5 prioridades em ordem, cada uma com o motivo e o próximo passo.
- Números do dia: tarefas atrasadas, visitas a confirmar, visitas a registrar, leads sem tarefa, leads esfriando.
- Uma linha de "risco do dia" (o que se não for feito hoje custa venda).
- Termina oferecendo iniciar a fila: "quer resolver as 6 atrasadas agora?".

### Postura do assistente

- Sempre que ele detectar pendências relevantes no contexto da conversa, **oferece a ação** ("você tem 2 visitas sem confirmar pra amanhã, quero preparar as mensagens?") em vez de esperar o pedido exato.
- Responde a linguagem natural variada ("o que tá atrasado?", "tô sem saber por onde começar", "me organiza aqui") caindo no mesmo fluxo.

## Detalhes técnicos

- `supabase/functions/homi-chat/homi-tools.ts`: novos parâmetros em `buscar_imovel` (`valor_min`, `valor_max`, `dormitorios`, `dormitorios_exato`, `mobiliado`, `suites_min`, `vagas_min`, `area_min`, `tipo`); reescrita da montagem da query em `properties` com ordenação por aderência e fallback que informa o critério relaxado.
- Novas ferramentas no mesmo arquivo, reaproveitando as tabelas canônicas `pipeline_tarefas`, `pipeline_leads` e `visitas`:
  - `fila_execucao` (tipo: `tarefas_atrasadas` | `leads_sem_tarefa`, tamanho do lote 1 ou 3) devolvendo os cards com contexto do lead e sugestão de ação.
  - `visitas_a_confirmar` e `visitas_pendentes_resultado`.
  - `briefing_do_dia`, agregando as ferramentas já existentes (`meu_dia`, `ver_pendencias`, `leads_esfriando`) em um resumo priorizado.
  - Conclusão/criação reusa as ações já existentes (`criar_tarefa`, `registrar_resultado`) — nada de caminho novo de escrita no banco.
- `supabase/functions/homi-chat/index.ts`: regras de extração de faixa de valor e atributos, regra de resposta para pedidos de atendimento e política de "ofereça a próxima ação" no prompt do copiloto.
- `src/components/homi/HomiPanel.tsx` / `HomiActionCard.tsx`: exemplos reais nos atalhos, campos novos da busca, e o card de fila com progresso e botões Concluir / Próxima tarefa / Pular / Abrir lead.
- Sem migration e sem mudança de dados. Só edge function + frontend; escopo de visibilidade continua o do usuário logado (RLS atual).

## Validação ao vivo

1. "Me busca um apartamento de 3 dorms de 1M até 1,5M no Menino Deus mobiliado" → só resultados dentro da faixa e mobiliados.
2. "2 dorms até 600 mil no Petrópolis" → comportamento antigo continua funcionando.
3. "Me ajuda a fazer um follow-up com lead do Casa Tua que parou de me responder" → leitura da situação + mensagem pronta.
4. "Me ajuda a concluir minhas tarefas atrasadas, de 3 em 3" → fila com 3 cards, conclusão real refletindo no pipeline.
5. "Quais visitas tenho que confirmar?" e "quais visitas tenho pendentes?" → listas corretas e distintas.
6. "Faz meu briefing do dia" → prioridades + números + oferta de iniciar a fila.

