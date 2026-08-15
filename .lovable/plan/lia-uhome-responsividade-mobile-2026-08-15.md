# LIA · Uhome — responsividade mobile

Deixar a página `/admin/lia-hub` confortável no celular (440px), sem mudar dados, regras ou backend. Só apresentação.

## O que muda em cada parte

**Cabeçalho da página**
- Título/subtítulo com tamanho reduzido no mobile e botão "Atualizar" ocupando a linha inteira abaixo do título (hoje ele espreme o título).
- Padding lateral menor no celular.

**Barra de abas**
- Vira uma faixa rolável na horizontal (sem quebrar em várias linhas), com abas de toque confortável e a aba ativa visível.

**Painel**
- KPIs continuam 2 por linha no celular (já ok), com fonte do número levemente menor.
- Cartão "Funil" e "Precisa da sua atenção" empilhados (já ok) — só ajuste de espaçamento.

**Leads e conversas**
- Filtros: busca em cima, pílulas de status em faixa rolável, seletor de origem em linha própria.
- A tabela some no celular e vira uma lista de cartões (nome, telefone, status, última mensagem, quando), cada cartão abre a conversa. Em telas médias/grandes segue a tabela atual.

**Kanban**
- Colunas com largura relativa à tela no mobile (~82% da largura) com rolagem horizontal por "encaixe", em vez de 264px fixos.
- Altura das colunas ajustada para caber na tela do celular.

**Follow-ups**
- Cartões: mensagem, botões e metadados empilhados; botões (Aprovar / Editar texto / Cancelar) em largura total no celular.
- Textarea de edição com altura adequada e fonte 16px para evitar zoom automático do iOS.

**Qualificados**
- KPIs 2 por linha (já ok).
- Tabela "Leads da LIA no pipeline" vira lista de cartões no celular (lead, corretor, etapa, aceite, criado), mantendo o clique que leva ao lead.

**Drawer da conversa**
- Ocupa a tela toda no celular, com respiro do topo (safe area) e botão de fechar com área de toque maior, seguindo o padrão já usado no detalhe do lead.
- Balões de mensagem com largura máxima maior no mobile e quebra de palavras longas.

## Técnico

- Arquivos tocados: `src/pages/admin/LiaHub.tsx`, `src/components/lia-hub/LiaPainelTab.tsx`, `LiaLeadsTab.tsx`, `LiaKanbanTab.tsx`, `LiaFollowupsTab.tsx`, `LiaQualificadosTab.tsx`, `LiaConversaDrawer.tsx`.
- Só classes Tailwind responsivas (`sm:`/`lg:`), tokens semânticos existentes; nenhum hardcode de cor.
- Listas mobile x tabela desktop via `hidden lg:table` / `lg:hidden`, sem duplicar lógica de dados (mesmo array já calculado).
- Nada de mudança em hooks, queries, RLS ou edge functions.

## Validação

Conferir no preview em 440px: header, rolagem das abas, cartões de leads, kanban com encaixe, follow-ups com botões cheios, drawer em tela cheia — e confirmar que em desktop nada mudou visualmente.
