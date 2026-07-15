## Problema

No drawer do lead (Pipeline de Leads) → aba **Tarefas** → botão **"Nova tarefa"**, abre o `NextActionModal` na aba "Agendar nova tarefa". O formulário atual tem apenas: **Tipo**, **Data** e **Hora** — sem campo de observação. Corretores não conseguem registrar o contexto da tarefa (ex.: "retornar sobre financiamento", "ligar após 17h").

Curiosamente, o mesmo modal já tem Textarea de observação na opção "Descartar lead", e o `CardQuickTaskPopover` (tarefa rápida do card) já usa observação obrigatória. A ausência aqui é um gap de UI.

## Solução

Adicionar campo **Observação** na opção "Agendar nova tarefa" do `NextActionModal.tsx`, salvando em `pipeline_tarefas.descricao` (coluna já existe — a aba de edição da tarefa já lê/edita esse campo).

### Alterações (arquivo único)

`src/components/pipeline/NextActionModal.tsx`:

1. Novo state `const [obsTarefa, setObsTarefa] = useState("")`.
2. Reset em `resetForm()`.
3. No JSX de `selected === "tarefa"`, após a linha de Data/Hora, adicionar:
   - Label **"Observação"** + `<Textarea rows={2}>` com placeholder tipo *"Ex.: Retornar sobre financiamento, ligar após 17h..."*.
   - Opcional (sem obrigatoriedade) — alinhado com o comportamento do `CardQuickTaskPopover` onde é obrigatório; aqui deixaremos opcional para não travar quem só quer agendar rápido. Se preferir obrigatório, basta trocar 1 linha.
4. No `insert` em `pipeline_tarefas`, incluir `descricao: obsTarefa.trim() || null`.
5. Registrar `pipeline_atividades` com o título incluindo a observação (padrão que o `CardQuickTaskPopover` já usa), para aparecer na timeline.

### Alinhamento de consistência (pequeno bônus)

Ao criar a tarefa, também atualizar `pipeline_leads.proxima_acao` já inclui o label — manter como está. Só adicionamos `descricao` no insert de `pipeline_tarefas` e o registro na `pipeline_atividades`.

## Validação

- Abrir drawer de um lead → aba Tarefas → **Nova tarefa** → escolher tipo/data/hora → digitar observação → Confirmar.
- Conferir que a tarefa aparece na aba com o texto da observação (o `TaskCard` no `DrawerTasksTab` já renderiza `t.descricao`, linha 288 e 394).
- Conferir que aparece na Timeline via `pipeline_atividades`.

## Observação importante

Não mexo em nenhuma lógica de negócio (SLA, roleta, régua de saúde, etc.) — só UI + persistência de um campo já existente na tabela.
