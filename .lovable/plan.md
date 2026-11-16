# Performance da Roleta v2 — evolução de cada corretor e o que falta

Desenho: Mockup_Performance_Roleta_v2.jpg. Só tela; nenhuma regra da Roleta muda.

## O que muda
1. **Duas sub-abas**: "Agora" (padrão) e "Fechamento semanal".
2. **Filtro de equipe vale para tudo**, inclusive o fechamento semanal (hoje ele mostra todo mundo — corrigir).
3. **Aba "Agora"**:
   - 4 números: Aptos · Fora (por motivo) · Perto de voltar · **Faltam para todos voltarem** (soma das visitas que faltam + quantos precisam atualizar CRM).
   - **Evolução da semana — cada corretor** (substitui as duas listas separadas): uma linha por corretor, quem está fora primeiro (quem está mais perto no topo), depois os aptos. Colunas: Situação (Fora / Apto / voltou hoje) · Visitas da semana em quadradinhos (cheio = realizada, tracejado = marcada, meta 2) · CRM % · **O que falta para participar** ("1 visita (marcada qua 18)", "2 visitas · marcar agenda", "CRM até 80% · atualizar 9 clientes"). Para aptos: "—" ou, se ainda não garantiu a próxima semana, "manter: falta 1 visita".
   - Embaixo, menores: gráfico "Aptos por dia" e "Últimas semanas" (já existentes, filtrados pela equipe).
4. **Aba "Fechamento semanal"**: o cartão atual, filtrado pela equipe escolhida.
5. Celular: tabela vira cartões (nome + selo na 1ª linha, quadradinhos e "falta" na 2ª), sem rolagem lateral.

## Detalhes técnicos
- `FechamentoSemanalCard` recebe `corretorIds` opcional e filtra as linhas.
- Data da próxima visita marcada: acrescentar `proxima_visita_marcada` (timestamptz) ao `rpc_performance_roleta` (1 migration).
- `performanceRoletaPresentation.ts`: novo seletor `linhasEvolucao` (situação, falta, "manter") + total de visitas faltantes; testes para cada regra.
- `Blocos.tsx`: novo `EvolucaoCorretores` substitui `ForaDaRoleta`/`AptosAgora`; sub-abas com o componente Tabs existente.
- Validar como CEO com equipe filtrada, desktop 1280 e celular 390.
