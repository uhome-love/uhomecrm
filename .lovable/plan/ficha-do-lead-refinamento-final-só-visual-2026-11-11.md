# Ficha do lead · refinamento final (só visual)

## Limites e aprovação
- Somente polimento: manter estrutura da ficha, topo aprovado no computador e no celular, larguras das colunas, emojis, destaques e ações existentes. Desenho aprovado por Lucas, com acréscimo de cores discretas em poucos pontos; preservar as cores da linha do tempo e as situações finais neutras de Descarte/Caiu.
- Sem migration, alterações de gravação, permissões, tarefas, visitas, distribuição, reativação ou cálculos comerciais.
- Primeiro apresentar e aprovar o mockup isolado. Depois apresentar este plano para aprovação; só alterar a ficha após as duas aprovações.
- Extras autorizados: somente o agrupamento da linha do tempo e o caminho do lead, necessários para os títulos dos dias, alinhamento da linha vertical e animação do popover. Nenhuma mudança em peças globais ou outras telas.

## 1. Cartões mais leves
- **Próximo passo:** remover apenas a caixa cinza interna da tarefa. Manter ícone, título, vencimento, explicação e ações Concluir/Trocar tarefa diretamente no cartão. Separar a tarefa do Homi por uma linha fina.
- **Situação:** remover a caixa cinza interna; Descarte e Caiu mantêm texto, datas e emojis dos motivos.
- **Sem próximo passo:** uma linha âmbar e, abaixo, botão de contorno de largura total, **+ Criar próximo passo**, abrindo o formulário atual.
- Cabeçalhos com rótulo à esquerda e selo/link à direita, espaçamento interno preservado; o selo passa inteiro para a linha de baixo se não couber, sem sobreposição.
- **Acentos de cor:** filete superior âmbar no Próximo passo sem tarefa, vermelho quando a tarefa já estiver vencida e azul quando estiver em dia; azul no Negócio; verde no destaque de Venda assinada e no seu título; Interesse no Resumo em azul discreto. Homi mantém o ciano existente. Usar somente tokens temáticos, sem colorir cartões inteiros ou alterar a régua de saúde/vencimento. Descarte e Caiu continuam neutros; cores e emojis da linha do tempo permanecem intactos.

## 2. Ordem e destaque conforme a etapa
- **Novo Lead até Pós-Visita:** Próximo passo → Resumo. Preservar os blocos auxiliares já existentes e suas condições de exibição.
- **Documentação, Proposta e Contrato:** Negócio → Próximo passo → Resumo. O cartão Negócio mostra etapa, situação atual e duração correta, valor curto sem quebra e a ação azul existente, como **Atualizar contrato**.
- Exemplo de composição: **Contrato · Em leitura há 12 dias** / **R$ 599 mil** / **Atualizar contrato**. Os dias são calculados a partir do registro correspondente à situação, não de uma atualização genérica. Sem data confiável, exibir a situação sem inventar duração.
- **Ganho:** Situação → Resumo. No cartão Situação: **🏆 Venda assinada**, valor em Montserrat de **24 px**, data oficial e autor do registro de assinatura, **Abrir negócio** e **🔄 Reativar lead** discreto ao final. Não duplicar o cartão Negócio.
- O exemplo **10 nov · Junior** só aparece se os registros confirmarem essa data e esse autor; o responsável atual não será apresentado como autor da assinatura por suposição.
- **Descarte e Caiu:** conservar a composição atual, retirando somente a caixa interna.
- Manter Ligar e WhatsApp; Agendar visita continua oculto nas etapas finais e de contorno nas etapas comerciais, conforme aprovado.

## 3. Linha do tempo
- Mudança de etapa **sem anotação visível:** título e chip **De X para Y** soltos, sem caixa. Com anotação, conservar a caixa e os destaques aprovados, inclusive o verde do Ganho.
- Cabeçalhos: **Hoje**, **Ontem**, dia da semana abreviado + data nos demais dias dos últimos sete dias; somente data nos mais antigos. Acrescentar ano apenas quando diferente do ano atual. Tudo no horário de Brasília.
- Posicionar a linha vertical no mesmo centro dos círculos, incluindo registros automáticos e avisos de intervalo; sem deslocamentos entre tipos de item.
- Fundo muito suave ao passar o mouse. Lixeira visível também ao navegar por teclado e acessível no celular; o clique mantém a confirmação atual, sem excluir nada automaticamente.
- Preservar Atendimento/Tudo, autores, ordem dos eventos, datas de visitas, cores, emojis e textos já aprovados.

## 4. Registro rápido
- Exemplo curto: **O que aconteceu com Leandro?**, usando o primeiro nome de cada cliente.
- Campo aumenta com o texto digitado, sem barra interna prematura e sem empurrar os controles para fora da ficha. Com foco, borda azul e anel suave.
- No celular: quatro chips em uma única faixa horizontal rolável e botão de envio fixo à direita dessa faixa, sem rolar junto e sem descer para outra linha.
- Preservar seleção do contato e o formulário de confirmação atual; o botão não passa a salvar diretamente.

## 5. Movimento, foco e carregamento
- Homi: abertura e fechamento por altura e opacidade em **200 ms**, mantendo a chamada atual somente quando aberto. Não acrescentar chamadas nem geração automática.
- Caminho do lead: apenas fade de **150 ms**, sem zoom/deslocamento nesse popover.
- Sublinhado das abas desliza entre as posições reais, inclusive após rolar as abas no celular; conteúdo e navegação permanecem iguais.
- Com **reduzir movimento** ligado: nenhuma dessas animações, nem pulsação dos esqueletos.
- Esqueletos temáticos nos cartões e na linha do tempo: reservar a composição própria de cada etapa, larguras e alturas mínimas compatíveis; manter conteúdo já carregado durante atualizações. Não exibir falsos estados de ausência de tarefa, valor zero ou nenhuma visita enquanto a leitura estiver pendente.
- Foco azul visível em botões, chips e links; estados de mouse, desabilitado e carregamento nas ações aplicáveis, sem mudar quando uma ação é permitida.

## Detalhes técnicos
- Arquivos principais: `DrawerAgora.tsx`, `HomiSugestaoRecolhida.tsx`, `ResumoLeadLateral.tsx`, `LeadHistoricoTab.tsx`, `RegistroRapido.tsx`, `PipelineLeadDetail.tsx`, `DrawerLeadInfo.tsx` e o cartão Negócio hoje declarado dentro de `PipelineLeadDetail.tsx`.
- Dois extras aprovados: `DrawerTimelineGroup.tsx` e `CaminhoDoLead.tsx`. Formatação dos cabeçalhos e alinhamento ficam restritos à ficha; não alterar `leadHelpers.ts`, `ui/popover.tsx` ou `ui/tabs.tsx` globalmente.
- No código atual, Situação e o pequeno cartão Negócio usam `lead.valor_estimado`. Para o destaque solicitado, fazer leitura autorizada somente do negócio ativo vinculado ao lead e usar seus campos oficiais de valor/assinatura; reaproveitar seletores existentes de valores e o cache, sem alterar os escritores ou escolher outra venda histórica.
- Conferir a referência de entrada da situação do contrato e o autor no histórico já autorizado. Se não houver registro inequívoco, omitir o dado ausente em vez de deduzi-lo de visita, proprietário atual ou `updated_at`.
- Aplicar tokens de cores, tipografia, foco e movimento existentes; os tempos específicos de 200/150 ms ficam limitados à apresentação da ficha, sem mudar durações de todo o CRM.
- Reutilizar as peças de botão e esqueleto existentes e os mesmos manipuladores de ação. Estado pendente local cobre também as leituras independentes de orçamento e visitas.

## Fases de execução, depois das aprovações
1. Cartões e ordem por etapa; validar antes de avançar.
2. Linha do tempo e registro; validar antes de avançar.
3. Movimento, acessibilidade e carregamento; revisar as três fases juntas.

## Validação e evidências
- **Leonardo Prado:** tarefa vencida sem caixa interna; Concluir/Trocar tarefa preservados; vencimento e saúde continuam com a mesma régua, sem alterar dados.
- **Leandro da Nóbrega Silva:** Negócio primeiro, situação/duração sem invenção, valor inteiro, Atualizar contrato azul e ausência de próximo passo bem organizada. Interesse continua apenas com a primeira letra maiúscula; não usar imóvel da última visita.
- **Eraldo Rodrigues:** destaque 🏆, R$ 1,1 mi, data oficial, autor comprovado quando disponível, Abrir negócio e reativação discreta. Visitas e tarefas existentes não serão corrigidas ou canceladas nesta rodada.
- **Danielle Knorst:** descarte sem caixa interna, com motivo e emojis preservados; sem Agendar visita.
- Abrir os quatro leads em **1280 px, 1440 px e celular 390 px**, todos no claro e no escuro: 24 combinações. Capturar evidências dos cartões e da linha do tempo.
- Simular leituras lentas com cache frio e conferir também reabertura com cache: nenhuma mensagem vazia falsa e nenhum salto abrupto entre esqueleto e conteúdo. Medir posições antes/depois, considerando que anotações de tamanho desconhecido podem expandir naturalmente o conteúdo.
- Conferir teclado, foco, rolagem dos chips, envio que abre o formulário, caminho e abas com movimento normal/reduzido. Testar a abertura/fechamento do Homi com resposta controlada no navegador, sem disparar mensagens ou chamadas pagas desnecessárias.
- Nos leads reais, somente leitura e abertura de formulários seguida de **Cancelar**: não concluir tarefa, salvar atividade, atualizar contrato, agendar visita, reativar nem excluir registros.
- Revisar o diff, rodar testes existentes pertinentes e conferir erros do preview; encerrar com o que foi validado e prints, sem declarar pronto somente pela leitura do código.
