# Cartão do Pipeline: voltar a mostrar a última atividade

## O que muda
- Na linha de baixo do cartão volta a aparecer **"última atividade · há Xd"**, como era antes.
- Sai a linha "Tarefa atrasada / Para hoje / Próxima / Sem próxima ação" do cartão.

## O que fica como está
- Topo novo, filtros de tarefa (atalhos) e topo das colunas continuam funcionando.
- Bolinha de saúde continua medindo tempo sem atividade.
- Botão de registrar rápido (raio) permanece no cartão.
- Pop-up compacto de concluir tarefa e nome "Atendimento" seguem iguais.
- Mesmo comportamento no celular.

## Validação
- Conferir computador (1494px) e celular (390px), claro e escuro, sem abrir nem alterar leads reais.

## Detalhes técnicos
- `src/components/pipeline/CardMinimal.tsx`: restaurar a faixa base com o texto de última atividade (lógica já existente perto da linha 236) no lugar do bloco `proximaTarefaLinha` (linhas ~289–306 e render ~538). Nenhuma mudança no banco.
