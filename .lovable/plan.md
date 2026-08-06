# Card novo ("Airy") no Kanban principal — CardMinimal

Objetivo: dar ao card do board de etapas (`src/components/pipeline/CardMinimal.tsx`) a mesma cara do card do subfunil, e acrescentar uma flag de SUBSTATUS visível sem abrir o subfunil. Visual + uma etiqueta. Sem migration. Sem mexer em mecânica.

---

## (a) Como o CardMinimal está montado hoje

Leitura do arquivo (619 linhas) — estado atual confirmado:

**Moldura e cores**
- Container `rounded-2xl`, borda, e uma **barra esquerda 4px via `before:`** cuja cor vem de `resolveStatus(proximaTarefa, stage.tipo)` → `SIDEBAR_BY_STATUS`: vermelho (atrasada), esmeralda (hoje/futura), âmbar (sem tarefa), sky (convertido), zinc (descarte). Em `novo_lead` a barra é fixa `#4F46E5`.
- Parceria muda o fundo/borda para roxo.
- Saúde por toque já existe, mas como camada **secundária**: `getSaudeToque(...)` → `SAUDE_UI[estado].ring` (anel âmbar/vermelho ao redor do card) + uma **pílula** "🟠 Desatualizado".

**Zoo de badges (linha superior, `flex-wrap`)**
1. `NOVO` (só em `novo_lead`);
2. cadência Sem Contato `📲 T3 · agora` (semáforo por `cadencia.tentativa` / `proxima_em`);
3. pílula de saúde (`🟢/🟠/🔴 + label`);
4. substatus (`getLeadSubstatusBadge`) — hoje só aparece **quando não há título específico de tarefa**.
Depois: nome + chip de parceria; empreendimento (`lead.empreendimento`, campo do formulário, passado por `deduplicateEmp`); selo de negócio `◆ sub-status · VGV · imóvel · Nd`.

**Telefone** já existe (`Phone` + `formatPhoneBR`).

**Linha de ação** (oculta em convertido/descarte): ícone da ação + rótulo (`ACTION_LABEL` ou título específico de tarefa `qualificacao_*` / `visita_auto`) + quando (`agora/hoje 14:30/amanhã…`) + `Nd` dias na etapa + o **✅ verde**.

**Rodapé**: avatar + nome COMPLETO do corretor.

**`CardOverflowMenu`** já é usado (topo direito), habilitado só quando `stages` e `onMoveLead` chegam por prop.

**O ✅ (conclusão 3-em-1) — lógica de negócio, não visual**
- Aparece quando existe `proximaTarefa.id` E status é `atrasada` ou `hoje`.
- Abre `TaskCompletionDialog` e, no confirm, chama `completeLeadTask()`, que numa tacada só:
  1. marca `pipeline_tarefas.status='concluida'`;
  2. grava substatus em `flag_status` (quando o dialog devolve `status_etapa`) + `ultima_acao_at`;
  3. chama `registrarToque(leadId)` → `ultimo_toque_at` (é o que alimenta a saúde do card);
  4. insere registro em `pipeline_atividades`;
  5. se `outcome='agendar'`: cria a próxima tarefa;
  6. se veio `novo_stage_id`: **move de etapa** + grava `pipeline_historico`;
  7. `outcome='descartar'` → move para Descarte com motivo; `outcome='inativar'` → arquiva.
- Guardrail Sem Contato: na etapa Sem Contato a próxima tarefa é criada **só pelo gatilho de banco** (`trg_cadencia_sem_contato`); `createNextTask` tem esse aviso e o early-return. O ✅ do card não deve virar um caminho paralelo de criação nessa etapa.

Conclusão: **tudo dentro do ✅ é lógica de negócio** (tarefas, atividades, toque, etapa, descarte). O visual pode mudar livremente; o comportamento não.

---

## (b) Plano faseado (builds pequenos, um de cada vez)

**Build 1 — Moldura e saúde (SUBSTITUI)**
- REMOVE a pílula de saúde e o `ring` de urgência.
- SUBSTITUI a barra `before:` por status-de-tarefa pela **barra lateral de saúde** `w-1` (`SAUDE_BARRA` por `saude.estado`), igual ao subfunil. Padroniza `rounded-xl`, `p-3 pl-3.5`, hover leve.
- MANTÉM o realce roxo de parceria (é sinal de propriedade compartilhada, não de saúde).
- Efeito colateral aceito e explícito: a cor da barra deixa de significar "tarefa atrasada" e passa a significar "sem toque". O atraso continua legível na linha de ação (texto vermelho + "agora").

**Build 2 — Corpo do card (REUSA + ADICIONA)**
- Empreendimento passa a ser o **canônico** (`empreendimento_canonico_id → empreendimentos_canonicos.nome`) com ícone `Building2`. Resolução por mapa carregado uma vez no board (mesmo padrão do subfunil), passado por prop ao card — sem query por card.
- Telefone com ícone `Phone` (já existe, só reposiciona/estiliza).
- Fileira meta: `TermometroBadge` + indicador de dias com dot ("hoje" / "há Xd" / "em estagnação").
- Rodapé: avatar + **primeiro nome** do corretor, e a **próxima ação à direita** (`formatNextAction`).

**Build 3 — Flag de substatus + limpeza do zoo (NOVO + REMOVE)**
- ADICIONA a etiqueta de substatus (`getLeadSubstatusBadge`) **sempre que existir**, tirando a condição `&& !hasSpecificTitle` — vale para Qualificação, Visita, Em Negociação e Contrato.
- REMOVE por redundância: pílula de saúde (já é a barra + o texto de dias) e o `Nd` de dias-na-etapa da linha de ação (o indicador de dias sem toque cobre a leitura).
- MANTÉM: `NOVO`, cadência `📲 Tn` (é informação de banco que não aparece em outro lugar), chip de parceria, selo `◆` de negócio.

**Build 4 — Ajuste fino**
- Densidade/espaçamentos, truncagem, `title` de acessibilidade, e validação ao vivo em todas as etapas (Novo Lead, Sem Contato, Qualificação, Visita, Pós-Visita, Em Negociação, Contrato, Ganhos, Descarte).

---

## (c) DECISÃO a confirmar — o ✅ fica ou sai?

O que ele faz hoje está descrito em (a): é um atalho que conclui a tarefa **e** pode registrar atividade, marcar toque, mudar substatus, mover de etapa, descartar ou inativar — tudo pelo `TaskCompletionDialog`.

Risco de remover agora: é hoje o caminho mais usado para gravar `ultimo_toque_at` e `pipeline_atividades` a partir do board. Tirar antes de existir o botão "Registrar atividade" equivalente **cega a própria saúde do card** (todo mundo vira vermelho) e derruba o registro de atividade do dia a dia.

Três opções:
1. **Manter como está** (recomendado para esta leva): visual novo, ✅ intacto no rodapé/linha de ação.
2. **Manter, mas renomear a intenção**: mesmo botão, rótulo/ícone de "Registrar" — prepara o discurso de atividade sem trocar o motor.
3. **Remover o ✅** — só depois que "Registrar atividade" existir no card e escrever toque + atividade. Isto é escopo de Onda 2.

Preciso da sua escolha antes do Build 3.

---

## (d) Riscos e o que NÃO tocar

Não serão alterados: drag/drop e `onDragStart`/`onDrop` do board, transições de etapa, `pipeline_tarefas`, `completeLeadTask`, `createNextTask`, o guardrail Sem Contato, escrita de `ultima_acao_at` / `ultimo_toque_at`, PDN, CAPI, roleta, filtros, toggles e o cabeçalho de coluna.

Riscos a vigiar:
- **Performance**: o card é renderizado às centenas. A resolução do empreendimento canônico deve ser um mapa do board, nunca uma query por card, e o `memo` do componente precisa continuar valendo.
- **Perda de sinal de atraso**: mitigada mantendo o texto vermelho + "agora" na ação.
- **Regressão de clique**: o ⋮ e o ✅ precisam manter `stopPropagation` para não abrir o drawer nem disparar drop.

---

## (e) Confirmação

Nada aqui liga remoção ou estagnação automática. `getSaudeToque` é função pura, só-cor; a régua real (`get_pipeline_estagnacao` / `decidir_lead_estagnado`) continua lendo `ultima_acao_at` e não é tocada. Esta leva é **visual + a etiqueta de substatus**. Automação é Onda 2.
