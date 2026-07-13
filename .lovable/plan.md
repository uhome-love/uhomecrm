# Reorganização da Central de Reengajamento

## Estado atual (verificado no banco)
- **Nenhum disparo em andamento**: 0 pendentes na fila, última execução `cancelled`, nenhuma run `running`.
- Motor de disparo **ligado** (`campaign_dispatch_enabled=true`).
- 20.009 falhas acumuladas em `reengajamento_meta_disparos` que alimentam o card de reenvio.
- Hoje a aba **Ao vivo** empilha: Respostas recebidas hoje + Fila de reenvio + Auditoria de webhooks.

## O que muda

### 1. Nova aba "Histórico"
- Passa a existir uma 5ª aba (`Disparo manual`, `Nutrição`, `Ao vivo`, **`Histórico`**, `Configurações`).
- A "Fila de reenvio" é movida para essa aba e renomeada para **"Histórico de envios"**.
- Comportamento de reenvio (por base ou por lead) é mantido exatamente como está — é ali que o usuário tenta reenviar.
- Só esse card fica na aba (conforme escolhido).

### 2. Aba "Ao vivo" enxuta + filtros de período
- Sai a Fila de reenvio.
- Fica focada em: **disparo em execução** e **resultados**.
- **Sem disparo rodando** (caso atual): estado limpo com mensagem "Nenhum disparo em andamento" no lugar do banner.
- **Com disparo rodando**: o `LiveDispatchBanner` aparece normalmente com progresso.
- **Barra de filtros de período** no topo da aba: `Hoje` · `Semana` · `Data personalizada` (datepicker shadcn com `pointer-events-auto`).
- Os resultados (Respostas recebidas + Auditoria de webhooks) passam a respeitar o período escolhido, em vez de fixos em "hoje".

### 3. Bugs / melhorias / preparo para o próximo disparo
- `RespostasRecebidasHoje`: hoje a janela de tempo é fixa em 00:00 BRT do dia. Vira uma janela parametrizada pelo período selecionado (Hoje/Semana/Data). Título deixa de ser fixo "hoje".
- `AuditoriaWebhookTab`: recebe o mesmo intervalo de período para manter a aba coerente.
- Estado vazio consistente quando não há atividade (nada de cards vazios confusos).
- Conferir que o card "Histórico de envios" continua lendo `get_reengajamento_fila_bases()` e os botões respeitam o gate global — sem alterar a lógica de reenvio.

## Detalhes técnicos
- `src/pages/CentralNutricao.tsx`: adicionar a aba `historico`; mover `<FilaReenvioCard/>` para ela; reestruturar a `TabsContent` de `aovivo` com a barra de filtros e estado vazio; ajustar o grid da `TabsList` para 5 colunas.
- Novo componente leve de filtro de período (`Hoje | Semana | Data personalizada`) reutilizado na aba Ao vivo, retornando `{ from, to }` em ISO (BRT via `@/lib/brtTime`).
- `RespostasRecebidasHoje.tsx`: aceitar props `from`/`to`; usar no `.gte/.lte`; ajustar `queryKey` para incluir o período; renomear internamente para refletir "resultados".
- `AuditoriaWebhookTab.tsx`: aceitar/propagar o mesmo intervalo (se hoje for fixo, parametrizar).
- `FilaReenvioCard.tsx`: apenas o título/labels para "Histórico de envios"; nenhuma mudança de regra de negócio ou de backend.
- Sem migrações de banco. Nenhuma mudança na RPC nem na edge function de reenvio.
- Validação: `tsgo` + suíte de testes; conferência visual via preview de que Ao vivo fica limpo (sem run ativa) e o Histórico mostra as bases.
