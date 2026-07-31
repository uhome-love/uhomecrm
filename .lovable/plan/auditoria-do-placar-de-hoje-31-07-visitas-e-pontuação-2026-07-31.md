# Auditoria do placar de hoje (31/07) — visitas e pontuação

## O que os dados mostram (já verificado, só leitura)

Sessão ao vivo: `31/07`, 22 participantes.

**William Brizola — 3 visitas, 3 leads diferentes, 3 datas diferentes:**

| Criada às | Cliente | Empreendimento | Data da visita | Origem do ponto |
|---|---|---|---|---|
| 13:30 | Massoterapeuta \| Performance & Recuperação | Casa Tua - Junho 2026 | 01/08 | pipeline (fora do mutirão) |
| 16:56 | Samuel Gonçalves | Casa Tua | 06/08 | mutirão |
| 19:18 | Kaká Silveira | Casa Tua - Qualificado v2 | 04/08 | mutirão |

Não há linha duplicada na tabela de visitas, nem ponto duplicado no extrato (`oferta_ativa_ligacoes`): exatamente 3 eventos `visita_agendada` × 30 pts + 1 `aproveitado` × 5 = 95 pontos, que é o que o placar mostra. O placar mostrar "3 marcadas" está batendo com o banco.

Ponto de atenção real encontrado: o lead **Massoterapeuta** já teve uma visita em 27/06 que deu **no_show**; a de hoje é uma remarcação do mesmo cliente. Provavelmente é essa que ele sente como "a mesma visita contando duas vezes" — hoje ela contou 1 vez, mas o mesmo cliente já tinha pontuado em outra data.

**Inconsistência de fato (afeta 3 corretores):** o contador `aproveitamentos_count` está maior que o extrato — Brizola 2 vs 1, Eliézer Clós 2 vs 1, Luiza Clós 3 vs 2, William Ferreira 11 vs 10. Os pontos estão certos (95, 95, 70, 170), mas a legenda do placar calcula "3 vis ×30 + 2 aprov ×5" = 100 ≠ 95 exibido. É só o contador que desencaixa, não a pontuação.

## O que corrigir (decidido)

1. **Massoterapeuta não pontua.** É remarcação de uma visita que já existia (27/06, no_show). Remover o evento `visita_agendada` desse lead do extrato de hoje → **William Brizola fica com 2 visitas e 65 pontos**.
2. **Extrato vira fonte única do placar.** Recalcular `oferta_ativa_participantes` (visitas_count, aproveitamentos_count, pontos) a partir de `oferta_ativa_ligacoes` da sessão. Corrige também a divergência de aproveitamentos (Brizola 2→1, Eliézer 2→1, Luiza 3→2, William Ferreira 11→10) para a legenda do placar fechar com os pontos.
3. **Trava anti-recontagem por lead.** Passa a valer "1 ponto de visita por lead por sessão" e remarcação de lead que já teve visita anterior (qualquer data) não gera ponto novo — só visita de cliente inédito no funil pontua.
4. **Sem mudança nas regras de pontuação** (tentativa 0, aproveitado 5, visita 30) e sem alterar nenhuma visita do pipeline — as 3 visitas do Brizola continuam existindo na agenda; só o placar deixa de contar a remarcação.

## Detalhe técnico

- Ajuste em `public.trg_visita_conta_mutirao`: além da trava por data, bloquear quando já existe visita anterior do mesmo lead/telefone/cliente (qualquer data) e quando o lead já pontuou `visita_agendada` na sessão.
- Função de recomputo dos contadores da sessão a partir do ledger + aplicação na sessão de hoje (`31/07`), depois de remover o evento do lead Massoterapeuta.
- `PlacarTv.tsx` e a função `oferta-ativa-ranking` ficam intactos — leem os contadores já corrigidos.
- Validação ao vivo no placar depois de aplicar: Brizola 2 visitas / 65 pts e legenda batendo em todos os corretores.

