# HOMI Copiloto da Corretora — Assistente inteligente, direto e acionável

Objetivo: um HOMI que a Adriana (e os corretores) **gostem de usar** — resolve as tarefas do dia em poucos toques, com IA que entende linguagem natural E botões diretos. Validação ponta a ponta no acesso de corretor (sem visão CEO).

---

## 1. Criar tarefa e visita — botão abre form + digitar também funciona

**Botões rápidos abrem o cartão na hora** (sem round-trip com a IA), e **digitar em linguagem natural também funciona** ("cria uma ligação pro Felipe amanhã 10h").

Novo cartão-composer com **busca de lead embutida**:
- Campo de busca no topo com autocomplete em `pipeline_leads` do corretor (`corretor_id = user.id` + `ilike nome`, com debounce). Mostra nome + empreendimento/telefone; ao escolher, fixa o lead (botão "trocar").
- **Tipo de tarefa** = tipos reais do sistema (Ligar, WhatsApp, Email/material, Follow-up, Proposta, Marcar visita, Outro→personalizado).
- **Data** (Hoje/Amanhã/date picker) + **Hora** opcional.
- **Observações** (textarea).
- **Visita**: mesmo padrão + empreendimento, local, responsável (campos idênticos à agenda).
- Confirmar usa `useHomiActions.confirmarTarefa/confirmarVisita` (mesmos campos/validações da Central de Tarefas e da agenda + grava histórico em `pipeline_atividades`).

Quando a pessoa digita e a IA já sabe o lead, o cartão vem preenchido; se não achar, o corretor resolve na própria busca do cartão — sem nova pergunta.

## 2. Pendências / Atrasados acionáveis
Cada linha de tarefa/visita ganha ações rápidas:
- **✓ Concluir tarefa** — marca como concluída pelo mesmo caminho do sistema (`taskCompletion`/invalidação de queries), some da lista.
- **📋 Criar nova tarefa** — abre o composer já com o lead preenchido.
- **💬 Rascunhar WhatsApp** — a IA gera a mensagem pronta pra copiar (não envia).
- **👤 Abrir o lead** — navega para o lead no pipeline.
Cabeçalho com resumo curto e ordenação por urgência.

## 3. IA mais inteligente (todos os superpoderes escolhidos)
- **Briefing ao abrir**: ao abrir o HOMI (tela inicial), saudação com o resumo real do dia ("Bom dia, Adriana — 3 atrasadas, 18 tarefas hoje, 4 visitas. Começa por…") com botões diretos.
- **Resumo do lead sob demanda**: "me fala do Felipe Rigon" → nova ferramenta `resumo_lead` (etapa, última interação, próximas tarefas, imóveis de interesse) em cartão limpo + ação sugerida.
- **Sugestão de próxima ação por lead**: em cada lead parado/atrasado, o HOMI sugere o próximo passo ideal (com botão que abre a tarefa/rascunho correspondente).
- **Anotação rápida no lead**: "anota no Felipe que ele prefere sábado" → nova ferramenta `anotar_lead` grava em `pipeline_anotacoes`/`pipeline_atividades` (com confirmação).

## 4. Confirmação sempre obrigatória
Nenhuma tarefa, visita ou anotação é gravada sem o corretor revisar e clicar em **Confirmar** (cada cartão tem Confirmar/Cancelar).

## 5. Buscar imóvel + WhatsApp
- Buscar imóvel por linguagem natural retorna cartões (já existe) — melhorar com botão "💬 Enviar pro lead" que rascunha a mensagem com o imóvel.
- Rascunho de WhatsApp usa contexto do lead (etapa, empreendimento, histórico). Sempre só rascunho.

## 6. Habilitar Copiloto no acesso de corretor + teste ponta a ponta
O modo Copiloto (ferramentas) já roda em "Modo Corretor" — sem mexer no CEO. Vou testar tudo **logado como corretor**:
- Buscar/selecionar lead → criar tarefa → conferir em `pipeline_tarefas` + timeline do lead (`pipeline_atividades`).
- Criar visita → conferir em `visitas` + timeline + avanço de etapa.
- Pendências: concluir tarefa (some da lista), abrir lead, rascunhar WhatsApp, criar nova tarefa.
- Resumo de lead, sugestão de próxima ação, anotação rápida.
- Buscar imóvel.
- Validações: data obrigatória, "Outro" exige descrição, limite de data futura, lead inexistente, sessão expirada.
- Rodar em **viewport mobile** (caso da Adriana) conferindo layout dos cartões e da busca.

---

## Melhorias extras que recomendo (posso incluir — me diz se quer)
- **Atalho de conclusão com resultado**: ao concluir tarefa pelo HOMI, abrir o mini-fluxo de "resultado + próxima tarefa" (igual ao pós-conclusão do sistema) para não quebrar a cadência.
- **"Bom dia" proativo 1x/dia**: badge no launcher quando há atrasados, abrindo direto no briefing.
- **Follow-ups em lote**: "gera follow-up pra todos os leads sem contato há 3 dias" → lista de rascunhos.
- **Registro de ligação rápida**: "liguei pro Felipe, não atendeu" → grava tentativa + sugere reagendar.

## Seção técnica
- **Frontend**: `HomiActionCard.tsx` (composers com busca de lead + linhas acionáveis + cartões de resumo/imóvel), `HomiPanel.tsx` (botões abrem cartão local + briefing na tela inicial), `HomiContext.tsx` (helper para injetar cartão de ação sem chamar a IA; carregar briefing ao abrir), `useHomiActions.ts` (adicionar `concluirTarefa` e `anotarLead`).
- **Busca de lead no cartão**: consulta client-side a `pipeline_leads` (RLS do corretor), com debounce; sem migração.
- **Edge `homi-chat`**: novas tools `resumo_lead` e `anotar_lead`; ajustar prompt do copiloto para preencher o que já sabe e abrir o cartão em vez de perguntar campo a campo.
- **Conclusão de tarefa**: reutiliza `taskCompletion`/`invalidateTaskQueries` — sem duplicar lógica.
- **Sem mudanças de schema**; tudo em frontend + edge. Nada grava sem confirmação.

## Fora de escopo (fase seguinte)
- Envio automático de WhatsApp (mantém só rascunho).
- Criar lista personalizada na Oferta Ativa.