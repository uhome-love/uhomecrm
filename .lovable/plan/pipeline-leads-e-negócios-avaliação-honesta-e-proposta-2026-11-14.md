# Pipeline: Leads e Negócios — avaliação honesta e proposta

## Como está (nota 8/10 em Leads, 7/10 em Negócios)
**Bom:** topo organizado, atalhos de tarefa e saúde claros, faixa colorida nas colunas, cartões limpos, valor (R$) visível em Negócios.

**O que incomoda hoje**
1. **Leads e Negócios parecem duas telas diferentes**: em Negócios o topo é outro (Meus/Equipe em linha separada, frase "o fluxo comercial em colunas…" solta), colunas com bolinha em vez da faixa colorida e sem total de VGV no topo.
2. **Temperatura vazia ("🌡 –")** aparece em quase todos os cartões de Atendimento/Aquecimento: ocupa espaço e não diz nada.
3. **"última atividade · –"** em leads novos parece erro; melhor "sem atividade ainda".
4. **Negócios sem resumo**: falta uma faixa com VGV total em andamento, nº de negócios e "parados há +7 dias".
5. **Pós-Visita com "virar negócio" em todos os cartões**: botão azul forte repetido polui a coluna; melhor discreto, aparecendo ao passar o mouse (sempre visível no celular).
6. **Contrato vazio** mostra só um traço; falta um estado vazio amigável.
7. **Negócio parado** (ex.: "há 11d" em laranja) é o único alerta; poderia ter a mesma bolinha de saúde dos leads, mantendo o vocabulário igual.
8. Nomes cortados ("Vanesca Kieling - Lak…") quando há valor ao lado: valor pode ir para a linha do produto.

## Proposta (sem mudar regras, só visual)
- **Fase 0 — Mockup** de Negócios (computador e celular, claro/escuro) para aprovação.
- **Fase 1 — Mesmo topo em Leads e Negócios**: Meus/Equipe junto das abas, sem a frase solta, faixa colorida nas colunas de Negócios, total de R$ por coluna mantido.
- **Fase 2 — Resumo de Negócios**: VGV em andamento · nº de negócios · parados +7d · falta VGV (atalhos que filtram, igual aos de tarefa).
- **Fase 3 — Cartões mais limpos**: esconder temperatura vazia, "sem atividade ainda" em leads novos, "virar negócio" discreto, nome com 2 linhas e valor abaixo, bolinha de saúde em Negócios.
- **Fase 4 — Acabamento**: estado vazio de coluna, transições curtas, conferência no celular 390px e tema escuro.

Cada fase é validada no computador e no celular antes da próxima, sem alterar leads reais.

## Detalhes técnicos
- Negócios: `NegociosBoardInline.tsx` e cabeçalho reaproveitando `PipelineHeaderV2`/`ColunaCabecalhoV2`; contagens só de `v_negocios_pipeline` (sem mudar regras de VGV).
- Cartões: `CardMinimal.tsx` (temperatura vazia, texto sem atividade, botão virar negócio).
- Nenhuma mudança no banco.
