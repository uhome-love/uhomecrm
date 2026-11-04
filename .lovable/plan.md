# Lia — Conhecimento, Laboratório e Configurações

## Aprovação antes da construção
Este plano acompanha os desenhos de Conhecimento, Laboratório, Configurações e celular. A construção começa somente após aprovação dos desenhos e deste entendimento. Nenhuma página, ficha, configuração ou função de envio foi alterada nesta preparação.

## O que a revisão encontrou
- Conhecimento mostra um catálogo fixo, não o conteúdo completo das fichas usadas nas conversas e nos follow-ups. Essence, Open Arvoredo, Skyglass e Boa Vista aparecem sem ficha, embora as fichas existam. Golden Lake aponta para uma ficha antiga desligada, embora a ficha correta esteja disponível.
- O Laboratório tem 40 cenários e 83 execuções registradas; a tela mostra 2 cenários aprovados pela direção. Conferência automática e aprovação humana são informações diferentes.
- O motor antigo de reengajamento está habilitado, mas não há lote ativo: um lote está pausado com 100/dia e outro concluído com 150/dia. Não é correto dizer que toda a Lia está desligada.
- Follow-ups e reengajamento usam hoje 09h–20h em Brasília definidos nas funções. A caixa de atendimento isolada tem uma configuração diferente, 08h–23h59, e envio desabilitado. Esses controles não são intercambiáveis.
- O limite atual de reengajamento é por lote, não um teto global comprovado de 100/dia. Seg–Sáb, espera de 24h e cadência Natal são parâmetros do piloto; não devem aparecer como já aplicados sem verificação.

## 1. Conhecimento: encontrar, revisar e atualizar
- Manter as seis áreas no topo e Conhecimento/Laboratório dentro de Cérebro.
- Lista pesquisável com os oito produtos da campanha; outros produtos e versões anteriores ficam separados, sem excluir nem ativar fichas.
- Seleção abre ficha real, nome oficial, fonte, última atualização em Brasília, materiais e restrições. No celular, lista e detalhe em vistas sucessivas, sem uma coluna estreita nem longos quadros abertos juntos.
- Corrigir o vínculo de apresentação dos produtos às fichas existentes. A ficha cadastrada passa a ser a fonte da tela; o catálogo da campanha serve apenas para delimitar produtos e mostrar divergências, sem sobrepor seus preços aos dados reais.
- Editor da ficha com rascunho, Cancelar, comparação antes/depois e confirmação de salvamento. Não analisar texto livre para inventar preços, renda ou entrega; preservar integralmente o conteúdo que não foi editado.
- Manter materiais vinculados ao produto inspecionáveis. Não enviar mídia de outro empreendimento como substituição quando faltar material; indicar ausência e encaminhar a pendência à revisão.
- Salvar altera apenas o conhecimento confirmado. Não altera ficha ativa/desligada, vínculos de anúncio, modelos Meta, lotes ou conversas; não publica mudanças no prompt versionado da caixa isolada.
- Mostrar que ficha disponível não significa campanha ligada. Carregamento, erro, ausência e dado desconhecido são estados diferentes.

## 2. Laboratório: revisar sem bagunça nem aprendizado fictício
- Indicadores reais: cenários, últimas execuções com alertas, pendentes de revisão e aprovados pela direção. Usar a última execução de cada cenário, com ordenação determinística, sem confundir testes automáticos com aprovação.
- Busca e filtros por resultado, tema e produto; lista compacta e conversa/conferências no detalhe. Preservar execuções anteriores e comentários.
- Manter Simular, Aprovar e Marcar ajuste, com estado de execução e salvamento claro, tratamento de falha e trava de duplo clique durante toda uma bateria, não só durante cada cenário.
- Atalho Conhecimento → Simular follow-up: selecionar produto, usar ficha salva ou rascunho claramente identificado e contexto fictício. A simulação usa o mesmo modo de follow-up de produção, mas não chama envio, não aprova mensagens reais nem grava em clientes.
- Registrar qual versão/conteúdo de ficha foi usado. Depois de uma alteração, mostrar que a aprovação antiga precisa de nova conferência, sem apagar histórico ou afirmar que todas as respostas estão garantidas.
- Comentário de ajuste é uma orientação de revisão, não treinamento automático nem edição automática do cérebro. Executar ou aprovar cenário nunca liga piloto.
- O diálogo do desenho é ilustrativo; na página haverá resultado da execução, não conversa fictícia apresentada como teste real.

## 3. Configurações: controles reais, separados de ativação
### Envio programado da Lia
- Limite diário, início/fim em Brasília e dias permitidos em controles próprios; mostrar valor atual e rascunho separados. Piloto proposto: **100 contatos/dia, Seg–Sáb, 09h–20h**, após **24h** do descarte.
- Não aplicar os valores do piloto só por abrir a página. Reutilizar valores existentes onde houver equivalência; o que ainda não estiver configurado é identificado como proposta, não estado real.
- Distinguir limite total do piloto, limite de cada lote e follow-ups por cliente; não somar ou renomear contagens diferentes como uma só regra.
- Conectar parâmetros salvos aos caminhos de envio que exibem esses controles. Nenhum campo decorativo sem efeito no servidor. Respostas à mensagem recebida e a caixa isolada permanecem fora deste formulário, com seu estado identificado separadamente.
- Regras protegidas em leitura: apenas descartes; opt-out impede contato; recuperado vai à Fila CEO com contexto; corretor que descartou não recebe; fora da janela de 24h do WhatsApp requer modelo efetivamente aprovado.
- A espera de 24h do descarte e a janela de 24h do WhatsApp são regras distintas. A cadência Natal planejada continua identificada como planejada, sem implantação silenciosa nesta fase.

### Salvamento seguro
- Formulário → Revisar alterações → Confirmar, com cancelamento e histórico de alteração.
- Atualizar parâmetros não altera switches de envio, status dos lotes, aprovações de mensagens ou campanhas de anúncio. Não cria lote, não chama envio, não retoma lote pausado, não reenvia histórico e não dispara ao carregar/atualizar a tela.
- Não haverá botão de ativação nesta entrega. Estado do motor antigo será mostrado como realmente estiver, sem desligá-lo ou ligá-lo em nome da modernização.
- Leituras ausentes ou falhas mostram indisponibilidade. Quando uma configuração aplicável não puder ser validada pelo envio, o caminho controlado não envia naquela execução.
- Manter proteções de espaçamento e teto por execução; o teto diário aprovado precisa ser respeitado mesmo com lotes simultâneos e concorrência, não apenas somado no navegador.

## 4. Ordem de implantação e validação
1. Conhecimento: consulta real, vínculos corretos, lista/detalhe e edição com revisão. Validar antes de avançar.
2. Laboratório: organização, histórico e simulação de follow-up isolada. Validar antes de avançar.
3. Configurações: armazenamento protegido e controles conectados às regras de envio, sem ativação. Validar antes de avançar.
4. Conferir links antigos, seis áreas, desktop 1280px, celular 390/360px e modo escuro, com foco, teclado, botões e movimento reduzido.

### Testes obrigatórios
- Salvar ficha/configuração e avaliar simulação não chama envio nem muda estado de motor/lote/campanha.
- Cancelar e falha de gravação não alteram conteúdo; sucesso somente após salvar e ler de volta.
- Ficha e mídia pertencem ao empreendimento selecionado; versão usada no teste fica identificada; atualização não reaproveita aprovação antiga como se fosse atual.
- Limite de 100/dia, duas execuções concorrentes, virada do dia Brasília, segunda–sábado, domingo bloqueado, 08h59/09h00/19h59/20h00.
- Espera de 24h do descarte, opt-out, separação da janela WhatsApp, regras de destino e preservação da Roleta para leads novos.
- Permissão de leitura/escrita verificada no servidor, carregamento/erro/vazio sem zeros falsos e campos restritos não expostos.
- Rodar testes existentes de navegação, filtro, recuperação, Laboratório e prompt. Revisar diff e funcionamento autenticado, não somente compilação.
- Clientes reais apenas em leitura; formulários reais abertos e cancelados. Escritas e contagem de envio testadas com dados isolados/transação desfeita, sem mensagem externa. Diferenciar claramente teste isolado de salvamento real verificado; nenhum cenário de cliente real é usado para modificar dados.

## Detalhes técnicos
- Navegação continua centralizada em `liaAreas.ts`, preservando `?area=`/`?aba=`. Componentes focados com hooks compartilhados e tokens/componentes existentes.
- Consultar campos explícitos de `lia_produtos`; editor limitado a ficha/materiais confirmados, com concorrência por versão e auditoria antes/depois. Reutilizar permissões de admin/diretora para conhecimento e Laboratório.
- Reutilizar `ia_config` para parâmetros estruturados do envio programado quando possível, separados dos campos da caixa isolada; leitura/escrita por transações estreitas que não retornam campos privados como segredos de webhook. Administração de configurações mantém o papel administrativo existente, sem expandir acesso de gerente/corretor ou permitir escrita direta ampla.
- Fichas usadas por `lia-chat`/`lia-followup` não são o prompt embutido de `lia-brain`; não migrar uma caixa para a outra nem trocar modelo nesta entrega.
- O compartilhamento de parâmetros e reservas diárias exige ajustes restritos de servidor além da apresentação. Usar pontos comuns de guarda e reserva para os envios controlados; verificar a flag e elegibilidade antes do envio, sem chamar envio em salvamentos.
- Buscar e reutilizar estrutura de configuração/auditoria/reserva existente antes de adicionar qualquer objeto. Se necessário, migration DDL única com grants/RLS explícitos, sem atualização de dados operacionais; inicialização dos parâmetros somente por ação confirmada e autenticada.
- Mudanças de permissão, parâmetros e funções só após aprovação; registrar decisões estruturais em `AGENTS.md`. Não editar cliente, tipos ou configurações gerenciadas pelo Cloud.

## Fora desta entrega
Ativar piloto ou leads novos, disparar WhatsApp, aprovar/enviar modelos à Meta, substituir o cardápio histórico, implantar toda a cadência automática Natal, importar arquivos adicionais, redesign de outras páginas ou alterar distribuição/métricas do CRM.