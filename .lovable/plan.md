# Agenda pessoal — somente Prioridades

## Entendimento aprovado no desenho

A Agenda pessoal fica somente com **Prioridades**. A aba Tarefas não será repetida nela, pois já existe a página **Tarefas**. O visual seguirá o desenho aprovado, retirando a barra de abas e o botão de criar tarefa do topo.

## O que será feito nesta etapa

1. **Agenda abre sempre nas Prioridades**, inclusive quando a fila estiver vazia. Retirar as abas Tarefas e Negócios do time desta página. As tarefas e anotações existentes continuam acessíveis na página Tarefas; os negócios da equipe continuam no Pipeline e nas páginas de gestão, com as permissões atuais.
2. **Topo mais limpo no celular:** data pequena, título Minha agenda e ajuda em botão redondo. Sem abas e sem uma segunda área para tarefas.
3. **Pendentes e Feitos hoje** em controles compactos. Os motivos da fila ficam em um único botão Filtro, abrindo uma lista de opções sem faixas de rolagem horizontal. Manter todos os filtros e suas contagens.
4. **Clientes com nome em destaque**, etapa e empreendimento logo abaixo, última atividade e último registro bem separados. Ligar e WhatsApp em botões redondos de pelo menos 44px; Registrar em destaque. Manter abrir cliente, copiar número, mover etapa e dispensar, sem alterar seus efeitos.
5. **Cadência Sem Contato continua agrupada**, com abertura dos clientes do bloco. Manter carregamento e fila vazia, sem redirecionar para Tarefas automaticamente.

## O que não muda

- Ordem, critérios, contagens e dados das prioridades; tarefas vencidas continuam podendo gerar a prioridade Retorno.
- Registrar atividade continua usando o fluxo atual; não haverá conclusão sem o registro exigido.
- Nenhuma alteração em distribuição, Roleta, visitas, VGV, permissões ou dados existentes.
- A separação Agenda/Tarefas vale no celular e no computador; **o acabamento visual novo é apenas no celular**, preservando o estilo atual do computador.
- Esta fase não inclui outras telas ou mudanças na barra inferior.

## Detalhes técnicos

- Simplificar `AgendaCorretor.tsx`: retirar estado das abas, seleção automática de Tarefas e a apresentação duplicada de lembretes/negócios. Reutilizar `useFilaDoDia`, sem mudar a régua compartilhada nem remover suas informações usadas em outras telas.
- Separar os cartões, contatos e filtros em pequenos arquivos da Agenda para cumprir os limites do projeto; usar Button e tokens existentes. Registrar a divisão em AGENTS.md.
- Preservar registro, invalidação da fila, Feito, destaque do próximo cliente e cadência. Confirmar os acessos existentes à página Tarefas, às anotações pessoais e aos negócios da equipe antes de retirar as abas.
- Sem migração, novas tabelas, novas funções ou mudanças de segurança.

## Validação antes de declarar pronto

- Revisar o diff; conferir a Agenda autenticada em celular pequeno e grande, claro/escuro e computador.
- Abrir filtros, Pendentes, Feitos hoje e o bloco Sem Contato; conferir nomes longos e ações sem sobreposição com a barra inferior.
- Com cliente de teste: abrir Registrar e detalhes do cliente, conferir o formulário e cancelar. Não ligar, enviar mensagens, mover etapas, dispensar ou salvar ações em clientes reais.
- Conferir que tarefas e anotações continuam acessíveis na página Tarefas e que o Pipeline continua abrindo normalmente. Executar os testes existentes relevantes e conferir os erros do preview.