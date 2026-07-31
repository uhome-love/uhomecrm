# HOMI mais inteligente: busca de imóvel com faixa de preço e ajuda de atendimento com exemplos reais

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

## Detalhes técnicos

- `supabase/functions/homi-chat/homi-tools.ts`: novos parâmetros em `buscar_imovel` (`valor_min`, `valor_max`, `dormitorios`, `dormitorios_exato`, `mobiliado`, `suites_min`, `vagas_min`, `area_min`, `tipo`); reescrita da montagem da query em `properties` com ordenação por aderência e fallback que informa o critério relaxado.
- `supabase/functions/homi-chat/index.ts`: regras de extração de faixa de valor e atributos no prompt do copiloto + regra de resposta para pedidos de atendimento.
- `src/components/homi/HomiPanel.tsx`: novos exemplos reais nos `QUICK_ACTIONS` e na tela inicial.
- Card de composição da busca (`HomiActionCard.tsx`): campos de valor mínimo, mobiliado, suítes e vagas.
- Sem migration, sem mudança de dados. Só edge function + frontend.

## Validação ao vivo

1. "Me busca um apartamento de 3 dorms de 1M até 1,5M no Menino Deus mobiliado" → só resultados dentro da faixa e mobiliados.
2. "2 dorms até 600 mil no Petrópolis" → comportamento antigo continua funcionando.
3. "Me ajuda a fazer um follow-up com lead do Casa Tua que parou de me responder" → leitura da situação + mensagem pronta.
