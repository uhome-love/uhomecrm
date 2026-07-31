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

## O que proponho corrigir

1. **Extrato vira fonte única do placar.** Recalcular `oferta_ativa_participantes` (visitas_count, aproveitamentos_count, pontos) a partir de `oferta_ativa_ligacoes` da sessão. Isso zera a divergência de contadores e faz a legenda fechar com o número de pontos.
2. **Trava anti-recontagem por lead na sessão.** Hoje a trava é "1 visita por cliente por **data de visita**". Passa a ser também "1 ponto de visita por lead por sessão": se o mesmo cliente for remarcado no mesmo dia de mutirão, pontua uma vez só.
3. **Sem mudança nas regras de pontuação** (tentativa 0, aproveitado 5, visita 30) e sem alterar as visitas do pipeline — a correção é só nos contadores do placar.

## Antes de executar, preciso confirmar com você

- Confirma que a visita que o Brizola considera duplicada é a do lead **Massoterapeuta** (remarcação de uma visita que deu no_show em 27/06)? Se sim, ela deve **deixar de pontuar hoje** (placar dele cai para 2 visitas / 65 pts) ou **continua valendo** por ser uma remarcação legítima?

## Detalhe técnico

- Migration única com: função de recomputo dos contadores da sessão a partir do ledger + `UPDATE` na sessão de hoje.
- Ajuste em `public.trg_visita_conta_mutirao`: bloqueio adicional por `pipeline_lead_id` já pontuado na sessão (hoje só bloqueia quando a origem é mutirão ou quando a data de visita coincide).
- `PlacarTv.tsx` fica intacto — ele lê `oferta-ativa-ranking`, que lê os contadores corrigidos.
