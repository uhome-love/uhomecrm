# Placar do Dia — Top 5, metas e sons de comemoração

Ajustes na página da TV (`src/pages/PlacarDoDia.tsx`), mantendo toda a identidade visual atual (Bebas Neue, fundo escuro, cores das equipes, cards, animações e confete). **Só frontend — nenhuma migração ou mudança de backend.**

## 1. Metas
- **Meta por equipe por dia: 10** — cada card de equipe passa a medir progresso contra 10 (hoje mede contra 20). Nova constante `META_EQUIPE = 10` usada em barra, "FALTAM: X", "META BATIDA!" e glow por equipe.
- **Meta da empresa: 20 (mínimo)** — permanece como está (`DEFAULT_META = 20`), com faixa "🎉 META BATIDA!" e confete geral ao atingir 20+.

## 2. Ranking Top 5 (parte de baixo, largura total)
- O bloco "🏅 Top 3 corretores" vira **"🏅 Top 5 — Quem mais marcou hoje"**, em faixa horizontal (grid de 5 colunas).
- Mostra os **5 corretores** que mais marcaram visitas no dia (1º ao 5º) com medalha/posição (🥇🥈🥉 + 4º/5º), número de visitas e nome. 1º com destaque dourado.
- Cada corretor usa a cor da equipe dele, reforçando a disputa por equipe.

## 3. Sons de comemoração diferentes (marcada x realizada)
- Hoje toca **um único som** quando o total de visitas de uma equipe sobe. Passa a ter **dois sons distintos**, gerados via Web Audio (mesma técnica atual, sem arquivos externos):
  - **Visita MARCADA** → jingle atual, curto e alegre (acorde ascendente).
  - **Visita REALIZADA** → som mais forte/festivo (sequência mais longa e brilhante), para diferenciar a conquista maior.
- **Detecção:** a cada atualização (polling 15s), guardar um snapshot do `status` de cada visita por `id`. Quando surge uma visita nova com status de marcada → toca som de marcada. Quando uma visita existente muda para `realizada` (ou surge já como `realizada`) → toca som de realizada. Evita disparo no primeiro carregamento.

## Detalhes técnicos
- `contagemPorUser`: trocar `.slice(0, 3)` por `.slice(0, 5)` e adicionar a cor da equipe (via `equipeIds`).
- Introduzir `META_EQUIPE = 10`; nos cards de equipe usar `META_EQUIPE` no lugar de `meta`. Manter `meta` (20) só na faixa/confete da empresa.
- Grid do ranking para 5 colunas; `medalhas = ["🥇","🥈","🥉","4º","5º"]`.
- Generalizar `tocarSom()` em `tocarSom(tipo)` com dois conjuntos de notas ("marcada" / "realizada").
- Adicionar `prevStatusPorId` (useRef) para detectar transições de status entre polls; o RPC `rpc_placar_do_dia` já retorna `status` e `id` por visita.

Nenhum arquivo é alterado até a aprovação.
