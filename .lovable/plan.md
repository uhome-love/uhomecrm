# Lia — menu no topo e Fase 4: Recuperação

## Desenho para aprovação
- As seis áreas ficam em uma faixa acima do conteúdo, tanto no computador quanto no celular. Não haverá uma segunda barra lateral dentro da Lia.
- Preservar a Visão geral, Conversas, filtros de imóvel e demais telas já aprovadas.
- A próxima fase organiza apenas Recuperação: Descartes, Reengajamento e Mensagens, sem ligar disparos.
- Desenhos: `lia_menu_superior_recuperacao_desktop.png` e `lia_menu_superior_recuperacao_celular.png`, disponíveis nos anexos.

## 1. Menu superior
- Identidade da Lia e aviso “Atende só descartes” acima da faixa de seis áreas.
- Área selecionada marcada com ícone, texto e linha de destaque; seções internas continuam abaixo do título, sem misturar as duas hierarquias.
- No celular, faixa horizontal deslizável, alvos de toque confortáveis e área selecionada sempre visível, inclusive ao abrir um link antigo.
- Preservar os endereços `?area=` e `?aba=`, contadores, telas e ações existentes.

## 2. Descartes: leitura clara e números honestos
- Substituir a sequência de grandes quadros por três indicadores, motivos de descarte e uma coluna de parâmetros/cadência.
- Manter as mesmas consultas e somas existentes. Na conferência somente leitura de 04/11/2026 apareceram: base recuperável **7.991**, descartados nas últimas 24h **162**, espera de 90 dias **159**.
- Renomear “Prontos para receber” para **Base recuperável**: o agregado atual não comprova que cada contato já cumpriu as 24h e todos os critérios finais de envio.
- Não somar nem subtrair o cartão das últimas 24h dos demais: ele vem de uma consulta separada e não representa grupos mutuamente exclusivos.
- Remover o funil com zeros fixos. Exibir resultados apenas se houver fonte existente específica de recuperação; na ausência dela, mostrar indisponibilidade, sem aproveitar totais antigos do atendimento da Lia.
- Mostrar carregamento, ausência de dados e erro de leitura separadamente. Falha nunca vira zero nem “desligado”.
- Corrigir as referências visuais antigas de Roleta para **Fila CEO**, de acordo com a regra já aprovada; não alterar a distribuição.

## 3. Reengajamento e Mensagens
- Reengajamento: ordenar status atual, filtros/preparação de lote e histórico de lotes; manter as ações existentes com nomes claros e sem mudanças no comportamento de envio.
- Reduzir a informação técnica exposta e alinhar cores, botões e espaçamento ao padrão do CRM.
- Mostrar parâmetros planejados de 100/dia separados dos valores efetivamente configurados nos lotes; não mudar limites ou configurações salvas nesta fase.
- Mensagens: separar propostas de recuperação dos modelos já cadastrados, com prévia legível e conteúdo detalhado expansível.
- Não declarar um modelo “aprovado pela Meta” ou enviado à Meta com base apenas em seu cadastro/estado ativo. Não cadastrar, enviar ou editar modelos nesta entrega.

## 4. Celular e validação
- Conferir larguras de 390px e 360px e computador de 1280px.
- Menu superior deslizável sem transbordamento da página; indicadores legíveis; parâmetros empilhados e textos sem cortes.
- Clicar nas seis áreas, nas seções de Conversas e Recuperação e abrir links antigos diretamente.
- Conferir filtros e totais das conversas por imóvel, incluindo “Sem imóvel definido”, e abrir/fechar uma conversa somente em leitura.
- Comparar respostas das consultas e totais exibidos antes/depois. Mudanças de dados ocorridas entre leituras devem ser explicitadas, não atribuídas à apresentação.
- Validar carregamento, vazio e falha com isolamento local, sem gravar dados de clientes.
- Revisar o diff, executar testes existentes de navegação/filtros/recuperação e conferir o preview autenticado. Nada será declarado pronto apenas por compilar.

## Regras preservadas
- Lia atende somente descartados; campanhas de leads novos não são vinculadas a ela.
- Nenhuma ativação de piloto, envio de WhatsApp, criação de lote real ou alteração em cliente.
- Recuperados continuam destinados à Fila CEO, com contexto para repasse manual; o corretor que descartou não recebe de volta.
- Nenhuma mudança em elegibilidade, cadência, temperatura, cálculo, permissões ou distribuição.
- Relatórios/organograma e Cérebro/Configurações permanecem nas fases seguintes.

## Detalhes técnicos
- Alterar a apresentação de `LiaHub.tsx`, preservando `liaAreas.ts` como único mapa de navegação.
- Reaproveitar `LiaRecuperaTab`, `LiaReengajarTab` e `LiaMensagensTab`; separar apresentação e leituras existentes em arquivos focados quando necessário, sem duplicar consultas.
- Usar os componentes do design system, tokens semânticos e tempos de movimento existentes, com preferência de movimento reduzido respeitada.
- Não criar migrações, funções de envio, novas regras de acesso ou novas fontes de agregados nesta fase.

## Ordem de entrega
1. Aprovar estes desenhos e o plano antes de alterar a página.
2. Aplicar e validar primeiro o menu superior.
3. Organizar Descartes, depois Reengajamento e Mensagens, conferindo cada tela antes da próxima.
4. Validar todas as áreas no celular e apresentar o resultado e quaisquer limitações verificadas.