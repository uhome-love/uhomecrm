# Auditoria de qualidade — Dashboard CEO (/ceo)

Varredura feita em `src/pages/CeoDashboard.tsx` (931 linhas), `src/hooks/useCeoDashboard.ts` e `src/components/ceo/KpiDetailDialog.tsx`, com conferência dos números direto no banco.

## O que está errado hoje (confirmado)

1. **Coluna "Prop." (Propostas) da tabela Performance por Equipe é sempre 0.**
   A consulta de negócios já filtra `fase = 'ganho'`, e depois o cálculo conta `fase = 'em_negociacao'` dentro desse mesmo conjunto — nunca sobra nada. Hoje existem 29 negócios em negociação ativos, e a tabela mostra zero para todas as equipes.

2. **Funil de Negócios ignora o filtro de período.**
   Ele lê todos os negócios com `status = 'ativo'` de todos os tempos (hoje: 29 em negociação, 4 contrato, 85 ganho), enquanto o card "VGV Assinado" logo acima é do período (9 vendas no mês). Dois números de venda lado a lado que não conversam.

3. **VGV do funil usa só `vgv_estimado`, ignorando `vgv_final`.**
   Contraria a regra de fonte única (VGV = `vgv_final` com fallback para o estimado). Vendas já assinadas aparecem com valor errado no funil.

4. **O drill-down do "VGV Assinado" filtra por `created_at`, não por `data_assinatura`.**
   O card mostra um número (regra correta) e o modal lista outro conjunto de negócios. Mesmo problema no drill-down de "Propostas".

5. **Drill-down de leads compara data sem converter para BRT** (`created_at >= '2026-07-01'` cru), o que desloca a janela em 3 horas — o modal não bate com o card.

6. **KPIs de visitas não são clicáveis.** O `KpiDetailDialog` já suporta `visitas_marcadas` e `visitas_realizadas`, mas os quatro cards da Agenda de Visitas (Total, Marcadas, Realizadas, No Show) não abrem nada. Mesma coisa para "Total de Negócios" e "VGV em Contrato Gerado".

7. **Funil do Pipeline tem um seletor de Equipe que não filtra nada.** O estado existe, mas nenhum cálculo o consome — o CEO acha que está filtrando e não está.

8. **Sem comparação com o período anterior.** O hook já busca `prevKpis`, mas nenhum card mostra variação. Não há nenhuma seta/delta na tela inteira.

## O que proponho fazer

### Fase A — Correções de dado (prioridade)
- Corrigir o cálculo de Propostas por equipe: buscar negócios em negociação do período separadamente dos ganhos.
- Trazer o Funil de Negócios para o período selecionado, com a fase "Ganho" ancorada em `data_assinatura` (mesma regra do card de VGV), e usar `vgv_final` com fallback para o estimado.
- Alinhar o drill-down com o card: VGV Assinado e Propostas passam a filtrar por `data_assinatura` / fase correta; leads passam a usar a conversão BRT já existente no projeto.

### Fase B — KPIs clicáveis
- Tornar clicáveis: Total Visitas, Marcadas, Realizadas, No Show, Total de Negócios, VGV em Contrato Gerado, Reaproveitados (OA), Enviados p/ Roleta.
- Adicionar os tipos que faltam no `KpiDetailDialog` (no-show, contratos, leads enviados à roleta) reaproveitando a estrutura existente.

### Fase C — Leitura executiva
- Delta vs. período anterior (seta + %) nos KPIs principais, usando o `prevKpis` que já é carregado hoje.
- Taxas de conversão explícitas no funil: Lead → Visita realizada → Negócio → Venda assinada.
- Fazer o seletor de Equipe do Funil do Pipeline realmente filtrar (ou removê-lo, se preferir a visão só global).

### Fase D — Vendas realizadas
- Bloco "Vendas assinadas no período": lista com cliente, empreendimento, corretor, VGV e data de assinatura, com atalho para o negócio, e evolução de VGV por dia.

## Ordem sugerida
Fase A primeiro (é onde o número está errado), validando no preview antes de seguir. B, C e D entram depois, uma por vez.

## Nota técnica
Nada disso exige migration: são ajustes de query no frontend (`useCeoDashboard.ts`, `CeoDashboard.tsx`, `KpiDetailDialog.tsx`). O `KpiDetailDialog` ganha novos tipos; nenhuma outra tela é afetada.

## Antes de começar
Se quiser, faço um mockup visual das Fases C e D (deltas, taxas de conversão e bloco de vendas realizadas) para você aprovar o layout antes de qualquer código — a Fase A pode ir direto por ser correção de número.
