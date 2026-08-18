# Andreza Marques — "registrei atividade e o lead não atualizou"

## O que realmente aconteceu (verificado no banco)

Lead: **Andreza Marques**, telefone 51986662311, corretor Matheus Pasin, etapa **Qualificação** (desde 06/08).

Hoje às **17:36 BRT** o registro do Matheus **foi salvo com sucesso**:
- `pipeline_atividades`: 1 registro, **tipo = `nota`**, texto "Vai se desfazer de um imóvel que está comprometendo a renda dela... renda de 6k... quer moradia pois está se separando".
- `pipeline_tarefas`: lembrete "Próximo contato" criado para **25/08 09:00**.

Ou seja: não houve erro de gravação nem cache. O que não aconteceu foi **tudo que só acontece quando o tipo é um contato real**:

1. `ultimo_toque_at` continua **04/08** → o card segue vermelho/desatualizado no pipeline.
2. O lembrete vencido **"Alinhar perfil" (venceu 10/08)** continua pendente → o lead segue como atrasado na Agenda.
3. Nenhuma mudança de etapa (ele não escolheu etapa no modal) e nenhum avanço de cadência.

## A causa

No modal "Registrar atividade", quando o corretor **escreve a observação e não clica em nenhum tipo** (Ligou / WhatsApp / Presencial…), o sistema salva silenciosamente como **Nota**. Nota, por regra, não conta como toque humano — então o lead não "atualiza" em lugar nenhum.

O corretor não tem como perceber isso: o modal aceita, mostra sucesso, fecha, e o card continua igual. Foi exatamente esse o caso da Andreza Marques.

## O que proponho

### 1. Corrigir este lead agora (dado)
- Converter o registro de hoje em um contato real (o texto descreve claramente uma conversa com a cliente): virar tipo `contato`, carimbar `ultimo_toque_at` = 18/08 17:36 e concluir o lembrete vencido "Alinhar perfil".
- Confirmar com o Matheus se ele **falou** com ela (se foi só anotação de contexto, mantemos como nota e o card segue vermelho, corretamente).

### 2. Fechar o buraco no modal (UI)
- **Deixar de transformar observação sem tipo em Nota silenciosa.** Se o corretor escreveu texto e não escolheu tipo, o modal pede: "Como foi esse contato?" com os tipos em destaque e um botão discreto "Só anotar (não conta como contato)".
- **Rótulo honesto na Nota**: quando "Nota" estiver selecionada, mostrar abaixo o aviso "Anotação — não conta como contato, o lead continua marcado como desatualizado".
- **Confirmação diferente no sucesso**: hoje contato e nota mostram mensagens quase iguais. Nota passa a mostrar "Anotação salva — lead segue pendente de contato".

### 3. Levantar o tamanho do problema
Consulta única: quantos leads têm como última atividade uma `nota` criada por corretor nos últimos 30 dias enquanto seguem com toque vencido. Serve para saber se isso está acontecendo em escala (e se vale um mutirão de correção) — sem alterar nada.

## Detalhes técnicos

- `src/components/pipeline/RegistrarAtividadeModal.tsx`: remover o fallback `ativSel ?? nota` (linha ~166); no lugar, bloquear o "Concluir" com o pedido de tipo + atalho explícito "Só anotar". Ajustar os toasts de sucesso. Nenhuma mudança no fluxo de gravação nem nas queries.
- Correção do lead: `UPDATE pipeline_atividades` (tipo), `UPDATE pipeline_leads.ultimo_toque_at`, `UPDATE pipeline_tarefas` do lembrete vencido — em SQL pontual, sem migration de schema.
- Sem mudança em triggers, RLS ou edge functions.

## Fora de escopo
- Mudar a regra de quais tipos contam como toque.
- Mexer na cadência Sem Contato ou na Central de Leads Estagnados.
