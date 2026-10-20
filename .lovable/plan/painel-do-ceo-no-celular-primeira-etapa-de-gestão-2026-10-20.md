# Painel do CEO no celular — primeira etapa de gestão

## Objetivo e aprovação
Aplicar ao `/ceo` o desenho aprovado por Lucas: topo limpo, período compacto, indicadores deslizáveis e equipes em cartões. Esta aprovação é do desenho; a implementação começa somente após a aprovação deste plano.

## O que será feito
1. **Topo:** título “Painel”, identificação do CEO e botão de atualizar. Remover apenas no celular o cartão grande de saudação e a frase. Manter “Visão geral” e “Performance da Roleta”, sem rolagem horizontal nas abas.
2. **Período e Fila CEO:** um seletor compacto com os mesmos períodos e calendário personalizado existentes; manter o acesso à Fila CEO, sua contagem e o comportamento atual. Sem distribuição automática.
3. **Indicadores:** cartões deslizáveis para Roleta de Leads, Gestão de Negócios e Oferta Ativa, com todos os números, descrições, metas e comparações que já existem. Cada indicador mantém seu detalhamento atual quando disponível. Agendamentos em cartão de largura inteira e demais estados de visita em grade de duas colunas.
4. **Detalhes:** listas expansíveis para empreendimentos, origens, corretores, funis, conversões, vendas, marketing e RH. Preservar cada informação e ação, inclusive “Corrigir”, “Ver mais”, “Ver Marketing”, “Ver RH” e acesso ao relatório. Vendas mostram cliente, empreendimento, corretor, VGV e assinatura, sem tabela espremida.
5. **Equipes:** converter a tabela da Oferta Ativa em um cartão por equipe no celular; manter ligações, aproveitados, taxa, visitas marcadas, realizadas, propostas e VGV, além da linha de totais. Ranking mantém posição, corretor, equipe e todos os indicadores.
6. **Pendências e alertas:** manter aprovações, recusas e suas permissões com áreas de toque confortáveis. Erros e dados incompletos continuam visíveis; não mostrar “operação saudável” quando a consulta falhar. Alertas ficam visíveis inicialmente.

## O que não muda
- Computador: mesma apresentação, ordem e ações atuais.
- Fontes de dados, critérios de datas BRT, VGV e seus rateios, metas, filtros, permissões, aprovações e distribuição.
- Não alterar banco, funções ou registros reais.
- Diretora, gerentes, interior da aba Performance da Roleta, página Roleta e relatórios ficam para próximas etapas com validação separada.
- O mockup usa valores fictícios; a tela implementada usa exclusivamente os dados reais já carregados pelo Painel.

## Detalhes técnicos
- Manter `useCeoDashboard`, `useDateFilter` e os callbacks existentes como fontes únicas. Componentes de apresentação recebem dados e ações, sem novas consultas ou cálculos comerciais.
- Dividir `CeoDashboard.tsx` (1.157 linhas) em seções menores de apresentação e um controlador das ações atuais; preservar a versão desktop ao extrair o conteúdo. Não refatorar as consultas ou a lógica de credenciamento.
- Usar componentes e tokens existentes, fonte do sistema no celular, campos de pelo menos 16px, controles de pelo menos 44px, rolagem com encaixe e respeito à preferência por movimento reduzido.
- Limitar qualquer mudança de `PainelComAbas` à apresentação mobile das abas, verificando os três cargos; não mudar sua fonte de dados ou acesso.
- Registrar a separação de apresentação e dados em `AGENTS.md`.

## Validação antes de declarar pronto
1. Revisar o diff para confirmar ausência de mudanças no backend, cálculos ou permissões e preservação das informações.
2. Abrir o Painel autenticado no preview em 360, 375, 393 e 430px, claro/escuro, além do computador; conferir todos os blocos, nomes longos e ausência de rolagem lateral da página.
3. Trocar períodos e calendário personalizado, atualizar, deslizar indicadores, expandir equipes, totais, ranking, vendas, funis e dados gerais.
4. Abrir detalhamentos e Fila CEO e fechar/cancelar; não aprovar, recusar ou distribuir dados reais. Para qualquer fluxo que precise cliente, usar apenas teste e cancelar.
5. Comparar números da apresentação mobile com o desktop para o mesmo período, incluindo VGV, visitas e totais de equipe; conferir abas compartilhadas na diretora e gerentes sem alterar seus dados.
6. Conferir carregamento, vazio e falha por testes locais controlados, executar os testes existentes pertinentes e verificar o resultado automático de compilação e erros do preview.
7. Apresentar o resultado ao Lucas e aguardar validação antes da próxima tela.