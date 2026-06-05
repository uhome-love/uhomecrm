## Objetivo
Corrigir a ordenação dos segmentos para ficar sempre em sequência lógica `S1, S2, S3, S4, S5, S6` em toda a experiência da roleta, incluindo credenciamento, gestão, configurações e demais pontos da página da roleta onde segmentos aparecem.

## O que vou corrigir
1. Centralizar a ordenação dos segmentos usando a lógica já existente de comparação por prefixo `S1..S6`.
2. Aplicar essa ordenação em todos os carregamentos e renderizações da roleta que ainda dependem de ordem alfabética do banco.
3. Revisar listas, selects, badges, agrupamentos e cards relacionados a segmentos dentro da página da roleta.
4. Ajustar textos e mapeamentos legados que ainda assumem estrutura antiga de segmentos.
5. Validar que a ordem aparece igual em todos os pontos afetados.

## Pontos identificados para ajuste
- `src/hooks/useRoletaSegmentos.ts`
  - Já possui o comparador central `compareRoletaSegmentosByNome`, que deve virar a fonte única de ordenação.
- `src/hooks/useRoleta.ts`
  - Busca `roleta_segmentos` com `.order("nome")`; hoje corrige parcialmente com sort local, mas é um ponto central a revisar para garantir consistência completa.
- `src/pages/RoletaLeads.tsx`
  - Página principal da roleta já ordena parte da UI, mas precisa revisão completa para garantir que todos os blocos, selects e subseções usem a mesma ordem.
- `src/components/corretor/RoletaStatusBar.tsx`
  - Credenciamento ainda carrega segmentos em ordem alfabética e renderiza `segmentos.map(...)` no modal.
- `src/components/roleta/RoletaConfigTab.tsx`
  - Aba de configurações ainda carrega `roleta_segmentos` com `.order("nome")` e exibe nessa ordem.
- `src/components/settings/RoletaCampanhasPanel.tsx`
  - Painel de campanhas usa `.order("nome")` para os segmentos e precisa padronizar selects e badges.
- `src/components/pipeline/FilaCeoDispatchModal.tsx`
  - Usa segmentos ativos da roleta e tem texto legando a `S1–S4`; revisar ordenação e nomenclatura compatível com `S1–S6` quando aplicável.

## Resultado esperado
- Em qualquer lista/select/card da roleta, os segmentos aparecem sempre nesta ordem:
  - S1
  - S2
  - S3
  - S4
  - S5
  - S6
- Mesmo que o banco retorne por nome, a interface reordena corretamente.
- Componentes que ainda usam nomenclatura antiga continuam funcionando sem quebrar compatibilidade.

## Detalhes técnicos
- Reutilizar `compareRoletaSegmentosByNome` como regra única.
- Onde houver fetch de `roleta_segmentos`, ordenar no cliente após o fetch antes de salvar no estado.
- Onde houver `segmentos.map(...)` em UI crítica, garantir que a coleção usada já esteja ordenada.
- Revisar mapeamentos visuais e mensagens que ainda pressupõem a estrutura antiga dos segmentos.
- Evitar mudança de regra de negócio; foco apenas em consistência de exibição/seleção.

## Validação
- Conferir a ordem no topo da página da roleta.
- Conferir o modal de credenciamento.
- Conferir aba de configurações da roleta.
- Conferir telas/painéis de campanhas e gestão dentro da roleta.
- Conferir que nenhum ponto relevante da roleta permaneceu em ordem alfabética.