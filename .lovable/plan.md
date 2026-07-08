# PDN 2.0 — Planilha de gestão inteligente

O PDN vira a "planilha de comando" de gestores, diretora e CEO: puxa os dados do pipeline automaticamente, e o gestor gerencia **status, observações, próximos passos e prioridade** por cima — sem nunca alterar o pipeline nem aparecer para o corretor.

## 1. Correções de dados (o que está errado hoje)

- **Corretor "—" nas visitas**: hoje o nome do corretor só é resolvido para linhas de negócio. As linhas de visita ficam sem nome mesmo tendo corretor no banco. Vou resolver o nome do corretor também para as visitas (juntando os IDs de visitas + negócios num único mapa nome/equipe).
- **Conferência de visitas** (validado no banco, julho/2026): 40 visitas realizadas no mês — Gabriel 19, Bruno 12, Junior 9, **nenhuma sem corretor**. Depois do fix, o PDN vai bater 1:1 com esse número por equipe. Vou adicionar um pequeno rótulo "X visitas no mês" no cabeçalho do grupo Visita Realizada para conferência visual.

## 2. Acesso ampliado (diretora + CEO + filtro por equipe)

- Diretora (Gabrielle) e CEO/admin já enxergam as 3 equipes pela regra de escopo. Vou adicionar um **filtro "Equipe"** (Todas / Junior / Gabriel / Bruno) visível para quem tem escopo multiequipe (diretor/admin). Gestor de uma equipe não vê o filtro (já vê só a dele).

## 3. Campos melhores de preencher (estilo Google Sheets qualificado)

- **Status** vira um seletor com opções fixas + campo livre:
  - Comercial: `Aguardando docs`, `Em aprovação`, `Negociando`, `Proposta`, `Follow up`
  - Contrato: `Em confecção`, `Gerado`, `Assinado`
  - Cada status ganha uma cor (chip) para leitura rápida.
- **Observação**: área de texto multilinha com quebra de linha, que expande conforme escreve; salva ao sair do campo.
- **Próxima ação / data**: campo rápido para planejar o próximo passo (já existe no banco, vou expor).
- Tudo continua salvo só em `pdn_entries` (overlay) — **não aparece no pipeline do corretor**.

## 4. "Caiu" (queda) sem mexer no pipeline

- Botão **"Marcar como caiu"** em cada linha. Ao marcar, a linha sai da etapa ativa e vai para uma nova seção **"Caídos"** exibida **abaixo de Ganhos, em vermelho**, com o motivo da queda.
- Só afeta a visão do PDN — o lead continua igual no pipeline. Reversível ("Reativar" volta pra etapa de origem).

## 5. KPIs clicáveis + filtros + colunas ordenáveis

- Os cards de resumo (VGV, Ganhos, Contrato, Forecast, Em risco) viram **clicáveis**: clicar filtra a lista para aquele recorte (ex.: "Em risco" mostra só os parados). Clicar de novo limpa.
- **Colunas ordenáveis**: clicar no cabeçalho (Nome, Data, VGV, Corretor, Status) ordena asc/desc, com setinha indicando a ordem.
- Filtros mantidos e melhorados: Equipe, Corretor, Em risco, Ordem.

## 6. Etapas recolhíveis

- Cada grupo (Visita Realizada, Em Negociação, Contrato, Ganho, Caídos) ganha um cabeçalho **clicável para recolher/expandir**. Padrão: **tudo aberto**. O estado fica lembrado na sessão.

## 7. Visual limpo, bonito e mobile (referência: Agenda de Visitas)

- Desktop: mantém a tabela, porém mais respirada, chips de status coloridos, subtotais por grupo, zebra sutil e hover.
- **Mobile**: em telas pequenas, cada linha vira um **card** (nome + valor em destaque, corretor/empreendimento, chip de status, observação, ações), no mesmo padrão visual da Agenda de Visitas — sem tabela horizontal apertada.
- Exportar CSV atualizado para refletir colunas novas (incluindo Status e seção).

## Detalhes técnicos

- **Banco (`pdn_entries`)**: adicionar `caiu` (boolean, default false) e reaproveitar `motivo_queda`. Já existem `status`, `pipeline_lead_id`, `negocio_id`, `proxima_acao`, `data_proxima_acao`. Nenhuma escrita em `pipeline_leads`/`negocios`.
- **`usePdn.ts`**: unificar mapa nome/equipe do corretor cobrindo IDs de negócios **e** visitas (corrige o "—"); expor `equipe` no filtro; incluir grupo derivado `caidos` (linhas com overlay `caiu=true`); manter regra de escopo por RPC para diretor/admin.
- **`PdnGestor.tsx`**: seletor de status (Select com grupos + cor), textarea multiline para observação, KPIs clicáveis (estado de filtro), ordenação por coluna, filtro de equipe condicionado ao papel, grupos colapsáveis, seção "Caídos" em vermelho abaixo de Ganho, layout responsivo (tabela no desktop, cards no mobile via `use-mobile`).
- Sem novas dependências. Validação ponta a ponta no preview como Bruno (gestor), Gabrielle (diretora) e admin (CEO), conferindo os 12/19/9 de visitas por equipe e que status/observação não vazam pro pipeline. `tsgo` + checagem mobile.

## Ordem de execução

1. Migração: colunas `caiu` em `pdn_entries`.
2. `usePdn.ts`: fix do corretor, filtro de equipe, grupo "Caídos", ação de marcar/reverter queda.
3. `PdnGestor.tsx`: campos com seleção, KPIs clicáveis, ordenação, colapso, seção Caídos, layout mobile.
4. Validação ponta a ponta (gestor/diretora/CEO) + mobile + conferência de visitas.
