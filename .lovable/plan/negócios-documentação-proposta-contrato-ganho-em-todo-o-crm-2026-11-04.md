# Negócios: Documentação → Proposta → Contrato → Ganho em todo o CRM

## Regra (decisão do Lucas)
As etapas de negócio do CRM são exatamente **Documentação, Proposta, Contrato e Ganho**, como no seu print da aba Negócios. O nome "Em Negociação" deixa de existir como etapa.

## O que encontrei (conferido)
- A aba Negócios do celular já usa os quatro nomes certos: Documentação 11, Proposta 10, Contrato 0, Ganho 122.
- A etapa do Pipeline que guarda as propostas ainda se chama **"Em Negociação"** no cadastro das etapas. Por isso o quadro do Pipeline, o funil do painel CEO, o card do cliente e o cabeçalho da ficha ainda mostram "Em Negociação".
- Cerca de 25 telas e regras escrevem "Em Negociação" direto no código. Algumas delas reconhecem a etapa **pelo nome**, como as cores do quadro, os ícones, as categorias de roteiro e a transição de etapa. Trocar só o nome sem ajustar essas telas quebraria cores e regras.

## O que muda
1. A etapa do Pipeline passa a se chamar **Proposta**. Ela continua sendo a mesma etapa: os clientes, a ordem, a Roleta e o histórico não mudam.
2. Todas as telas passam a mostrar Proposta no lugar de Em Negociação: quadro do Pipeline, card, ficha do cliente, aviso de troca de etapa, funil do CEO, quadro de Negócios, Ranking, Relatórios, central de relatórios e exportação.
3. As telas que reconheciam a etapa pelo nome passam a reconhecer **Proposta**, e o nome antigo continua aceito. Assim, nenhuma cor, ícone ou regra se perde.
4. A situação dentro da etapa fica igual: proposta enviada, aprovada, aprovação bancária e assim por diante.
5. Os números não mudam: Documentação 11, Proposta 10, Contrato 0 e Ganho 122, com o mesmo VGV.

## Fora do escopo
Roleta, distribuição, VGV, Financeiro, confirmação de venda e histórico antigo. O histórico guardado continua dizendo "Em Negociação" onde já estava escrito.

## Validação
- Antes e depois, a mesma contagem por etapa no CEO, no Pipeline e na aba Negócios.
- Conferência ao vivo no computador e no celular: quadro do Pipeline, card, ficha, funil do CEO e Relatórios, sem mover nenhum cliente.
- Testes automáticos garantindo que o nome antigo e o novo levam à mesma etapa.

## Detalhes técnicos
- Mudança de dado: `UPDATE pipeline_stages SET nome='Proposta' WHERE tipo='proposta'` (1 linha, feita pela ferramenta de dados, sem migration).
- Mapas indexados por nome (`celebrations.ts`, `stageToCategoria.ts`, `leadHelpers.ts`, `PipelineBoard`, `CardMinimal`, `PipelineStageTransitionPopup`, `visitaResultadoRouting`, `useNegociosBoard`, `useNegociosTime`, `RankingNegocios`, `central-v2/report/*`, `useCeoDashboard*`, `RelatorioNegocios`) recebem a chave "Proposta", com "Em Negociação" como apelido. Rótulos de etapa usam `ETAPA_NEGOCIO_LABEL` de `src/lib/negocioEtapa.ts`.
- `status_negociacao` (`pipelineAudit.ts`) passa a ter o rótulo "Situação da proposta". Os valores gravados não mudam.
- Filtros salvos que contenham o nome antigo continuam funcionando por causa do apelido.
