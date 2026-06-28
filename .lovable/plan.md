# Polimento Visual — Pipeline Mobile

## Diagnóstico (análise criteriosa do screenshot)

O Pipeline mobile já é funcional, mas o **header consome espaço vertical demais** antes do primeiro card aparecer. Hoje são empilhadas, cada uma com sua própria borda inferior:

```
1. Título "Pipeline 2214" + filtros + Novo
2. Pílulas de aba (Equipes / Kanban / Inteligência)
3. Barra de busca
4. 4 badges (em dia / sem tarefa / atrasado / negócios) → QUEBRAM EM 2 LINHAS + refresh
5. Toggle Equipe / Minha carteira
6. Abas de etapa (Novo Lead / Sem Contato / Contato Iniciado...)
```

Resultado: ~6 faixas com bordas separando, visual "caixa sobre caixa", e os badges quebrando em 2 linhas (no print: "em dia / sem tarefa" em cima, "atrasado / negócios" embaixo) desperdiçam altura e parecem desalinhados. Só sobra espaço para ~1,5 card visível.

### Problemas pontuais
- **Badges quebram linha** — deveriam rolar horizontalmente em linha única.
- **Excesso de divisórias** — cada faixa tem `border-b`, criando ruído visual.
- **Toggle Equipe/Minha carteira** ocupa uma faixa inteira só para 2 botões.
- **Cards** estão corretos mas "secos": a linha "Tarefa definir" e o rodapé do corretor poderiam ter hierarquia/respiro melhores; cards sem tarefa (âmbar) não destacam o CTA "definir".
- **Robô HOMI** flutua sobre o último card (já há tratamento no drawer, mas na lista ele cobre conteúdo).

## Mudanças propostas (apenas frontend / apresentação)

### 1. Header mobile mais enxuto (`PipelineHeader.tsx`)
- **Pílulas em linha única com scroll horizontal**: envolver `PipelineFiltroBadges` num container `overflow-x-auto scrollbar-none` com `flex-nowrap`, impedindo a quebra em 2 linhas. Botão refresh fica fixo (sticky) à direita ou recolhido junto.
- **Reduzir divisórias**: remover `border-b` redundantes entre faixas consecutivas, deixando no máximo uma divisória sutil antes das abas de etapa. Usar leve diferença de fundo em vez de múltiplas bordas.
- **Compactar alturas**: revisar paddings verticais (`py-1.5`) das faixas para ganhar ~1 card de altura.

### 2. Integrar toggle Equipe / Minha carteira (`PipelineKanban.tsx`)
- No mobile, mover o toggle Equipe/Minha carteira para a **mesma linha das pílulas de filtro** (alinhado à esquerda, pílulas roláveis à direita) em vez de uma faixa própria, eliminando uma faixa inteira. Em desktop permanece como está.

### 3. Refino dos cards (`CardMinimal.tsx`)
- Melhorar respiro e hierarquia: nome um pouco maior, telefone e linha de ação com espaçamento mais consistente.
- **Card sem tarefa (âmbar)**: destacar o "definir" com leve realce (cor âmbar no texto + chip discreto) para virar um CTA claro de "precisa de ação".
- Microinterações já existentes (scale/active) mantidas; apenas refinar sombras e raio para um look mais moderno/cartão flutuante.
- Manter todos os tokens semânticos (nada de cores hardcoded novas fora do padrão já usado).

### 4. Respiro inferior da lista (`PipelineMobileView.tsx`)
- Confirmar/ajustar o padding inferior com `safe-area-inset-bottom` para que o último card não fique sob o robô HOMI nem sob a navegação do sistema.

## Fora de escopo
- Nenhuma mudança de lógica de negócio, queries, filtros ou dados.
- Tabelas, RLS e edge functions intocadas.
- Identidade visual mantida (off-white / deep slate, indigo #4969FF, raio 12px) conforme memória do projeto.

## Detalhe técnico
Arquivos tocados: `PipelineHeader.tsx`, `PipelineKanban.tsx` (apenas bloco do toggle mobile), `CardMinimal.tsx`, `PipelineMobileView.tsx`. Todas as mudanças são de classes Tailwind / estrutura de markup de apresentação. Validação via Playwright em viewport mobile (440px) comparando antes/depois e conferindo que nenhuma faixa quebra layout.
