# Polimento Visual/UX — Pipeline de Leads (Desktop)

Mesma filosofia aplicada no mobile, agora para a visão desktop (`lg+`). Apenas frontend/apresentação. Sem mudança de lógica, queries, RLS, edge functions ou dados. Identidade visual mantida (off-white / deep slate, indigo #4969FF, raio 12px).

## Diagnóstico (análise do código atual)

A visão desktop é funcional e densa, mas acumula **bandas horizontais empilhadas** antes do board e tem redundâncias visuais:

```
HEADER
  Linha 1: ícone + "Pipeline" + nº leads + scope badge ........ busca + filtros + sort + Modo Foco + Novo Lead
  Linha 2: abas (Kanban/Inteligência/...) + refresh + Selecionar + Fila CEO ............ pílulas (em dia/sem tarefa/atrasado/negócios)
  Linha 3: "Filtros ativos · Limpar" (condicional)
BANDA EXTRA (em PipelineKanban): toggle "Equipe / Minha carteira" (faixa própria só p/ 2 botões)
BANDA EXTRA: chips de filtros ativos (segunda lista, em PipelineKanban)
BOARD
  Mini-map: pílulas de etapa roláveis (emoji + nome + count) — repete o cabeçalho de cada coluna
  Colunas: cada uma com header-card (emoji + nome + count + barra progresso + VGV + tempo médio + semCorretor)
```

### Problemas pontuais
- **Toggle Equipe/Minha carteira** ocupa uma faixa inteira (linhas 604-624 de PipelineKanban) — desperdício vertical, fora do header.
- **Dupla lista de "filtros ativos"**: a Linha 3 do header já anuncia "Filtros ativos / Limpar", e logo abaixo PipelineKanban renderiza outra fileira de chips (linhas 627-685). Visualmente parecem dois blocos do mesmo assunto.
- **Mini-map de etapas x header das colunas**: nome + count aparecem duas vezes (na pílula de navegação e no header-card da coluna). Em telas largas onde várias colunas já são visíveis, a pílula vira ruído.
- **Header das colunas** poderia ter hierarquia mais limpa e ganhar destaque no drop (hoje muda só a borda/cor do count).
- **Cabeçalho das colunas não é sticky**: ao rolar a lista de cards de uma coluna alta, o título some.
- **Densidade**: largura de coluna fixa 268px e gap 12px aproveitam pouco telas wide; sem opção de compactar.
- **Affordances de drag**: o cursor "grab" e a faixa de drop são discretos; o feedback de coluna alvo pode ser mais claro.

## Mudanças propostas (frontend / apresentação)

### 1. Header desktop mais enxuto (`PipelineHeader.tsx`, bloco `hidden lg:block`)
- **Integrar o toggle Equipe / Minha carteira** na Linha 2 do header (à esquerda, junto às abas) para gestor/admin, eliminando a faixa própria.
- **Unificar a comunicação de filtros ativos**: manter apenas a fileira de chips clicáveis (com ×) e remover a Linha 3 redundante "Filtros ativos / Limpar", absorvendo o botão "Limpar todos" na própria fileira de chips.
- Revisar paddings verticais das linhas para recuperar ~1 faixa de altura útil.

### 2. Mover toggle para o header (`PipelineKanban.tsx`)
- Remover a faixa standalone do toggle Equipe/Minha carteira (linhas 604-624) no desktop, agora que ele vive no header.
- A fileira de chips de filtros ativos (627-685) permanece como única lista; ajustar espaçamento para casar com o novo header.

### 3. Header das colunas: hierarquia + sticky + drop (`PipelineBoard.tsx`)
- Tornar o **header-card de cada coluna sticky** no topo da própria coluna ao rolar os cards.
- Refinar o estado de **drop-target**: realce mais claro da coluna alvo (fundo + borda + leve elevação) mantendo tokens semânticos.
- Pequeno polimento de tipografia/espaçamento no header-card (nome, count, barra de progresso, linha de stats).

### 4. Mini-map de etapas mais discreto (`PipelineBoard.tsx`)
- Reduzir o peso visual da fileira de pílulas de navegação (altura/contraste), reforçando o realce da etapa ativa para virar de fato um índice de navegação, não um segundo cabeçalho.

### 5. Aproveitamento de telas largas + scrollbar (`PipelineBoard.tsx`)
- Pequeno ajuste de respiro/scrollbar e revisão do gap entre colunas para um look mais "cartão flutuante" consistente com o card refinado no mobile.
- (Os cards já usam `CardMinimal`, compartilhado com o mobile — herdam o polimento recente automaticamente.)

## Fora de escopo
- Nenhuma mudança de lógica de negócio, queries, filtros (comportamento), RLS ou edge functions.
- Tabelas e dados intocados.
- Sem novas dependências.

## Detalhe técnico
Arquivos tocados: `PipelineHeader.tsx` (bloco desktop), `PipelineKanban.tsx` (remoção da faixa do toggle + ajuste da fileira de chips), `PipelineBoard.tsx` (header de coluna sticky, drop-target, mini-map, espaçamento). Tudo via classes Tailwind / estrutura de markup e estilos inline já existentes. Validação visual em viewport desktop (1440px) comparando antes/depois e conferindo que nenhuma faixa quebra layout e que o drag-and-drop segue funcional.
