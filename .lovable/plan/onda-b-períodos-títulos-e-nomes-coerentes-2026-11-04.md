# Onda B — períodos, títulos e nomes coerentes

## Etapa anterior conferida
A Onda A está encerrada: o resumo do Pipeline agora coincide com as classificações após a aposentadoria de Caiu. M0 foi conferida nas sessões de CEO, Gabriel e Pedro; ajustes finais de leitura e movimento aplicados e validados, com 21 testes passando. Nenhum cliente, atividade, visita ou venda foi alterado nesta conferência.

## Desenho para aprovação
O desenho **Onda B** contém três páginas: Central de Marketing, Visitas e Meu time. É uma proposta, não uma mudança já aplicada. Mantém a fonte Inter, a marca atual e os padrões das páginas modernizadas. Não usa números ou clientes fictícios.

## O que construir, uma entrega por vez

### B1 — “Meu time” também na aba do gerente
- Gerente: menu, aba e título dizem **Meu time**.
- CEO/diretora: permanecem **Usuários**.
- Conferir o nome após navegar, atualizar e restaurar as abas.
- Mesma página, endereço, equipe, permissões e destinos salvos; sem renomear globalmente Usuários.

### B2 — topo e datas da Central de Marketing
- Usar o cabeçalho padrão: título com destaque, subtítulo atual e ação PDF existente.
- Separar visualmente as abas **Rastreamento & Funil / Investimento (Meta Ads)** da seleção **Hoje / Semana / Mês / Personalizado**.
- Em Personalizado, apresentar **De / Até** com calendário brasileiro e `dd/mm/aaaa`.
- Preservar o comportamento atual: alterações de intervalo são aplicadas como hoje, sem inventar botão Aplicar.
- PDF e filtro continuam apenas em Rastreamento & Funil. Conteúdo de Investimento, tabelas, números e condições de exportação permanecem iguais.

### B3 — personalizado de Visitas no computador
- Usar datas brasileiras nos campos **De / Até**.
- Manter **Hoje / Semana / Próxima semana / Mês / Personalizado**, as visões Lista/Semana/Conferência e as ações atuais.
- Preservar os limites: início não pode ultrapassar fim, fim não pode anteceder início.
- Intervalo continua provisório até clicar em **Aplicar**, mantendo validação e mensagens atuais.
- Não alterar o ramo de apresentação do celular.

## Como validar cada entrega
1. Registrar intervalos, filtros, totais e resultados existentes antes da alteração.
2. Conferir a entrega ao vivo em 1280 e 1920 px, claro e escuro, com sessão autorizada.
3. Navegar, restaurar abas, selecionar datas e trocar as visões pertinentes; comparar os mesmos intervalos e os mesmos números.
4. Conferir que não mudou nenhuma opção de período, condição de acesso ou comportamento de exportação.
5. Rodar os testes relevantes e conferir os erros da aplicação. Não testar salvando ou movimentando leads reais.

## Fora desta onda
- Dados, consultas, cálculos, comparação de Performance, distribuição, Roleta, tarefas e permissões.
- Redesign mobile, disposição do Placar no celular, comemorações e novas animações.
- Reforma transversal de seletores/cabeçalhos, novos filtros, criação de tabelas ou funções.
- Correções da data da saudação, regras de negócio ou discrepâncias de indicadores de escopos diferentes: separar em diagnóstico próprio, não alterar números para fins visuais.

## Detalhes técnicos
- B1: derivar rótulo do contexto autorizado no shell e na restauração; preservar chave e destino em `TabContext`, `TabBar` e `pageRegistry`. Usar o mesmo critério de papel de `MeuTime`, inclusive perfis com mais de um papel.
- B2: apresentação desktop de `RelatorioOrigemPerformancePage` com `PageHeader`, controles do design system e helpers existentes de `PeriodSelector`. Preservar `aba` na URL, valores locais como `custom`, setters e filtros atuais. Não adicionar ações padrão inexistentes só por reutilizar o cabeçalho.
- B3: `CampoDataBR` precisa suportar também limite superior (`max`), sem perder o `min` existente. Reaproveitar em `AgendaVisitas` mantendo estado provisório e aplicação manual.
- Novos testes verificam limites concretos de datas e contexto por papel; não testar textos, estilos ou snapshots. Os testes de rótulo usam a resolução de contexto por papel, não correspondência de cópia.
- Usar tokens semânticos e controles existentes. Sem migração ou implantação de funções nesta onda.

**Aprovação solicitada:** desenho e escopo B1 → B2 → B3; construir somente após validação do Lucas.