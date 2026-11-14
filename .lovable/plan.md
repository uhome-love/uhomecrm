# Auditoria das visitas da semana (09 a 15/11) — Painel CEO

## O que foi conferido (direto no banco, mesma regra do painel)

| Contador | Semana | Hoje (14/11) |
|---|---|---|
| Total | 128 | 52 |
| A realizar | 9 | 3 |
| Realizadas | 60 | 22 |
| No show | 59 | 27 |
| Novos agendamentos (criados no período) | 117 | 16 |

- **Total bate**: 9 + 60 + 59 = 128 (e 3 + 22 + 27 = 52).
- **Duplicidade: nenhuma.** Nenhum cliente tem duas visitas no mesmo dia. Canceladas: 0 na semana (já ficam fora).
- **Nenhuma visita "realizada" no futuro** e nenhuma visita passada ficou sem resultado.
- **Realizadas 60 x Roleta 58**: 2 clientes visitaram duas vezes em dias diferentes. O painel conta 60 visitas; a Roleta conta 1 por cliente na semana (58). As duas estão certas, cada uma na sua regra.

## Pontos de atenção

1. **"Novos agendamentos" não é "visitas futuras".** Conta o que foi marcado no período, seja para quando for. Hoje: 16 marcadas, 12 delas para o próprio dia e 9 já realizadas. Por isso aparece "a maioria realizada".
2. **27 no show hoje** é alto (metade do dia). Todos foram marcados no sistema entre 10h e 20h, de origem manual e Oferta Ativa. Vale o gerente conferir se foram no show de verdade.
3. **Proteção futura**: o contador lê a tabela bruta de visitas, não a versão sem duplicados. Hoje não muda nada (0 duplicados), mas se surgir um, ele contaria duas vezes.

## Proposta (só depois de você aprovar)

- **A.** Trocar o rótulo e o detalhe de "Novos agendamentos" para deixar claro: "Marcadas no período", mostrando em pequeno quantas são para o futuro e quantas já foram realizadas. Mockup antes.
- **B.** Fazer o contador ler a versão sem duplicados (mesmo número de hoje, protege contra o futuro). Mudança de banco fora do horário comercial.
- **C.** Lista dos 27 no show de hoje por corretor, para você/gerentes conferirem.

## Técnico
- Fonte: RPC `get_visitas_kpis` (lê `visitas`, exclui cancelada/backfill/tipo≠lead). B = trocar para `visitas_unicas` mantendo a mesma assinatura e o escopo por papel.
- A = só apresentação em `DesktopVisitas.tsx`/`MobileVisitas.tsx` + campos extras (`agendadas_futuras`, `agendadas_realizadas`) no RPC.
