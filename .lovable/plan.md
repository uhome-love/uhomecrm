# Roleta — tirar o refresh repetitivo, manter a tela atualizada sem incomodar

## O que está hoje (depois do ajuste de agora há pouco)

- `useMinhaAlocacao`: `staleTime: 0` + `refetchOnMount: "always"` + `refetchOnWindowFocus: true` + **`refetchInterval` de 2 minutos**. Esse polling é o que pode virar o "refresh interminável" — a cada 2 min a query bate no servidor e o bloco de empreendimentos pode piscar/reordenar sozinho enquanto o corretor está usando a tela.
- `RoletaCorretorView`: `setInterval` de 30s só recalcula o horário em memória (não faz chamada de rede, não pisca) — esse fica.

## O que será ajustado

1. **Remover o polling de 2 minutos** da alocação. Nada de busca automática repetida em segundo plano.
2. **Manter só refresh por evento**, que é o que resolve o bug original:
   - ao abrir a tela da Roleta (1 busca);
   - quando o corretor volta para o app (window focus), com trava de no mínimo 30s entre buscas, para não repetir a cada troca de aba;
   - quando ele toca em "Atualizar";
   - depois de marcar presença.
3. **Sem piscar**: enquanto uma revalidação acontece em segundo plano, a lista continua exibida (usa o dado anterior); o spinner só aparece na primeira carga. O botão "Atualizar" mostra o giro só nele mesmo.
4. **Relógio de 30s permanece**, mas apenas atualiza o texto/estado da janela — sem chamada de rede e sem remontar a lista.

## Detalhes técnicos

- `src/hooks/useFocoCorretores.ts` (`useMinhaAlocacao`): remover `refetchInterval`; trocar `staleTime: 0` por `staleTime: 30_000` (janela de dedupe para o focus refetch); manter `refetchOnMount: "always"` e `refetchOnWindowFocus: true`; adicionar `placeholderData: keepPreviousData` (ou `notifyOnChangeProps` limitado) para não haver flicker.
- `src/components/roleta/corretor/RoletaCorretorView.tsx`: usar `isLoading` (primeira carga) para o estado "Carregando alocação..." e `isFetching` apenas dentro do botão "Atualizar" — já é assim, só confirmar após a mudança do hook.
- Sem mudança de regra de negócio, sem migração.
