# Página "Tarefas" do corretor — fluxo completo (Lembrete vira Tarefa)

## Resposta: "Abrir lead" abre onde?
Hoje, na Minha Agenda, "Abrir lead" **leva para o Pipeline** (sai da página). Na nova página Tarefas, o lead vai **abrir ali mesmo, por cima da lista** (a mesma ficha completa do Pipeline). O corretor fecha e continua na lista de tarefas, sem perder o lugar. Isso segue a regra "tudo dentro do lead".

## Mapa ponta a ponta (todos os pontos onde hoje existe "Lembrete")

```text
CRIAR TAREFA                         VER TAREFAS                 CONCLUIR TAREFA
- Card do pipeline (menu ⋯)          - Página Tarefas (nova)     - Página Tarefas: "Concluir"
- Ficha do lead: "Próxima ação"      - Minha Agenda: resumo +    - Card do pipeline: ⚡ quando
- Ficha do lead: aba Tarefas           atalho "Ver todas"          há tarefa pendente
- Registrar atividade: "agendar      - Início do corretor        - Ficha do lead: aba Tarefas
  próximo passo"                       (resumo do dia)           -> sempre pede resultado +
- Negócios (menu ⋯)                  - Card do pipeline (selo)      observação e grava no
- Janela "Próxima ação"              - Fila do dia ("vencida")      histórico do lead
- HOMI (já fala "tarefa")            - Raio-X do corretor        -> oferece "criar próxima"
```

| Onde | Hoje | Passa a ser |
|---|---|---|
| Menu do card no Pipeline e em Negócios | "📌 Criar lembrete" | "📌 Criar tarefa" |
| Janela de criar | "Novo lembrete / Lembrete de cliente / Lembrete criado" | "Nova tarefa / Tarefa de cliente / Tarefa criada" |
| Ficha do lead (Próxima ação e aba) | "Criar lembrete", "X lembretes", aba "📌 Lembretes" | "Criar tarefa", "X tarefas", aba "📌 Tarefas" |
| Registrar atividade | "agendar lembrete", "Lembrete concluído", "Só concluir" | "agendar tarefa", "Tarefa concluída"; "Só concluir" **sai** (concluir sempre pede observação) |
| Janela "Próxima ação" | "Agendar lembrete", "Tipo de lembrete" | "Agendar tarefa", "Tipo de tarefa" |
| Card do pipeline | título do lembrete, cor âmbar se vencido | igual, chamado tarefa |
| Ordenar pipeline "Compromisso" | "Lembrete vencido → hoje → futuro" | "Tarefa vencida → hoje → futuro" |
| Minha Agenda + resumo no início | bloco de lembretes, "X lembretes hoje" | "X tarefas hoje" + botão "Ver todas as tarefas" (abre a página nova) |
| Fila do dia | "você marcou um lembrete que venceu" | "...uma tarefa que venceu" |
| Histórico do lead | texto "Tarefa" é trocado para "Lembrete" | mostra "Tarefa" |
| Raio-X (gestor) | "Lembretes criados/cumpridos/atrasados" | "Tarefas criadas/cumpridas/atrasadas" |
| Menu lateral | "Minha Agenda" | "Minha Agenda" + item novo **"Tarefas"** logo abaixo |

Não muda (não é tarefa do corretor): mensagens de WhatsApp para o cliente "Lembrete da visita", aviso de visita pendente e lembrete de credenciamento da roleta.

## Regra nova ao concluir
- Concluir sempre exige resultado + observação (mín. 10 letras).
- Vira atividade no histórico do lead e conta como contato do corretor (atualiza a "última ação" e a cor/saúde do lead).
- Pergunta "Criar próxima tarefa?" já com o cliente preenchido.
- Vale igual em todos os lugares onde se conclui (página Tarefas, card ⚡, ficha do lead).

## Ordem de trabalho
1. Página Tarefas + ficha do lead abrindo por cima + conclusão nova.
2. Troca de nome em todos os pontos da tabela.
3. Teste ao vivo com lead de teste: criar no card, ver na página, concluir com observação, conferir histórico e a próxima tarefa; desfazer no final.

## Detalhes técnicos
- Sem migration: `pipeline_tarefas`, tipo `lembrete` mantido no banco (só rótulo muda); `anotacao` intacta.
- Remover exceção `ehLembrete` em `completeLeadTask.ts` e `taskCompletion.ts`; `RegistrarAtividadeModal` em modo conclusão remove "Só concluir".
- Nova rota `/tarefas` + item no `Sidebar.tsx` (todas as variantes de papel); `/minhas-tarefas` (Agenda) continua.
- Página usa `PipelineLeadDetail` em drawer local; hook `useMinhasTarefas` com `.range()` e BRT; componentes < 300 linhas.
- `CriarLembreteModal` -> `CriarTarefaModal`; arquivos tocados: CardOverflowMenu, NegociosBoardInline, DrawerProximaAcao, DrawerTasksTab, PipelineLeadDetail, NextActionModal, CardMinimal, PipelineSortDropdown, AgendaCorretor, AgendaResumoWidget, useFilaDoDia, registroLimpo, RaioXCorretorPage.

## Sugestões extras (opcionais — você escolhe quais entram)
1. **Atalhos de data na criação**: "Hoje 18h", "Amanhã 10h", "Em 3 dias", "Próxima semana" — cria tarefa em 2 cliques.
2. **Aviso no celular e no sino na hora da tarefa** (aproveita o push que já existe). Sem custo extra se rodar junto com uma conferência já existente.
3. **Adiar rápido** (+1h, amanhã) com motivo curto — fica registrado e o Raio-X mostra quem adia demais.
4. **Lead sem tarefa futura = alerta**: na página Tarefas, um bloco "Clientes sem próximo passo" (leads ativos do corretor sem nenhuma tarefa marcada), com botão "Criar tarefa".
5. **Concluir em sequência**: depois de concluir, a próxima tarefa do dia já fica destacada — o corretor "limpa" a lista em ritmo.
6. **Gestor vê as tarefas do time** (só leitura) na mesma página, com filtro por corretor.
