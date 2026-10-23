# Fase 3 — Jornada do negócio

## Escopo e desenho aprovado
Aplicar o desenho aprovado de **proposta, documentação e contrato dentro dos detalhes do cliente**, com o mesmo funcionamento no cartão do Pipeline e no celular.

Esta etapa não reconstrói Vendas nem Financeiro: essas páginas continuam nas fases 4 e 5 do plano completo.

## O que será entregue
1. **Proposta:** registrar empreendimento, unidade pretendida, valor, situação e condições. Ao abrir a confirmação da venda, unidade e valor da proposta aparecem como sugestões editáveis; nunca substituem dados oficiais de uma venda já ganha.
2. **Documentação:** três marcações — RG/CPF, comprovante de renda e comprovante de residência — salvas e recuperadas ao reabrir o cliente. A conferência é informativa: não bloqueia mudança de etapa nem acrescenta exigências à confirmação da venda.
3. **Contrato:** situação do contrato e os dados já registrados da proposta, sem redigitação desnecessária. Mostrar **Gerar intermediação** para gerente, CEO e diretora, reutilizando a seleção do cliente e negócio atual. Nada é gerado automaticamente e nenhuma forma de pagamento vem escolhida. Eventual previsão de assinatura não será gravada como assinatura oficial.
4. **Aviso ao gerente:** contrato **gerado ou em leitura há mais de 7 dias**, com nome do cliente, situação e acesso direto ao cliente. Usar a entrada na situação atual como referência, não uma edição qualquer do cliente. Sem repetição para a mesma situação; novo avanço reinicia a contagem. O aviso não move o cliente, não bloqueia trabalho e não altera VGV.

## Conferência feita e correções necessárias
- As transições atuais de proposta e contrato abrem uma observação rápida. Os formulários antigos presentes no código não são usados e não serão simplesmente religados.
- Hoje, cartão e detalhes tratam dados adicionais de maneiras diferentes. A gravação desta jornada será compartilhada para não coletar informações que depois desaparecem.
- O campo de valor da proposta já existe, mas ainda não é considerado no preenchimento da confirmação da venda.
- Existe um aviso semanal genérico de negócios parados há 15 dias. O aviso específico de contrato será independente dessa regra e não reaproveitará os indicadores de saúde do corretor.

## Preservações obrigatórias
- Ganho continua exclusivamente pela confirmação compartilhada, com dados oficiais, intermediação e comprovante do ato, validada também no servidor.
- Não modificar vendas reais, comissões, recebimentos ou o Skyline. Não preencher documentos antigos por inferência.
- Não reutilizar uma venda ganha anterior quando o mesmo comprador inicia outro negócio.
- Intermediação continua a fonte única da comissão; NF/PIX/Zemo continuam uma escolha explícita de quem cria o documento.
- Distrato permanece restrito a CEO/admin e diretora, somente no Financeiro.
- Qualificação, Aquecimento, visitas, Roleta, distribuição e demais telas permanecem com as regras atuais.

## Organização técnica
- Criar apresentações pequenas em `src/components/pipeline/negocio/` para proposta, checklist e contrato; reaproveitar componentes e cores existentes.
- Compartilhar leitura e gravação da jornada entre `PipelineStageTransitionPopup`, `PipelineBoard` e `PipelineLeadDetail`, incluindo erros visíveis antes de anunciar sucesso. Reutilizar a mesma apresentação e dados em `DrawerNegocioTab`, sem manter dois checklists divergentes.
- Usar as colunas atuais de `negocios` para proposta e unidade. Conferência e referência da situação do contrato poderão usar o JSON existente do negócio/lead, com vínculo ao negócio atual e atualização segura, sem criar tabela paralela.
- Conferir políticas e funções existentes antes da escrita. Se necessária para garantir gravação conjunta e referência confiável em todos os caminhos, fazer **uma mudança aditiva** com função de gravação/validação no servidor; nunca alterar permissões para ampliar acesso. Respeitar o limite de mudanças e horário após 19h BRT.
- Incluir `proposta_valor` na leitura de `useConfirmarVenda`; preencher com VGV final existente, depois proposta, depois estimativa. Manter a unidade vinculada ao negócio atual.
- Reutilizar a rotina autenticada `stalled-deals-notify` para o aviso específico, com seleção paginada, exclusão de encerrados/arquivados, destinatário resolvido corretamente e deduplicação por cliente, gerente e entrada na situação. Ajustar a verificação para diária, sem multiplicar o aviso genérico existente; respeitar preferências de notificação.
- Contratos antigos sem referência confiável não recebem uma data inventada nem uma avalanche de avisos. O novo acompanhamento começa com mudanças registradas nesta etapa.
- Documentar as decisões estruturais em `AGENTS.md` e atualizar a etapa no roadmap após a validação.

## Validação antes de declarar pronta
- Testes concretos: valor/unidade conservados; conferência incompleta não bloqueia; exatamente 7 dias não avisa e mais de 7 dias avisa; somente gerado/em leitura; ausência de repetição; mudança de situação reinicia; ganhos anteriores não são alterados.
- Usar somente um **cliente de teste identificado**, nunca gravar em clientes reais.
- No computador e celular: abrir proposta, cancelar e confirmar que nada mudou; salvar valor/unidade; reabrir e conferir; marcar documentos e reabrir; avançar para contrato; abrir intermediação com o cliente selecionado e cancelar sem criar documento.
- Abrir Confirmar venda e conferir sugestões e obrigatoriedade dos anexos, cancelando sem marcar Ganho; manter os testes de confirmação da fase anterior.
- Conferir o aviso com registro de teste, seu destinatário e acesso ao cliente, sem emitir notificações sobre clientes reais durante a validação.
- Remover os registros e anexos de teste ao final, verificar que o total/VGV das vendas reais permanece igual e revisar as alterações e erros do preview.

## Depois desta etapa
Após sua validação, seguir para **Fase 4: Vendas**, depois **Fase 5: Financeiro**, mantendo as pendências históricas e Skyline separados.