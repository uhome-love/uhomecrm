# Placar do Mutirão: contar toda visita marcada no dia (1 por cliente por sessão)

## Auditoria das visitas de hoje (14/08) — confirmada no banco

Sessão ao vivo: 14/08, 09:30 → 21:30 BRT. Foram criadas **8 visitas**; só **3 pontuaram**.

| Hora | Corretor | Cliente | Contou? | Motivo |
|---|---|---|---|---|
| 09:40 | Wendel Flores | Paulinha Paim | Não | já teve visita em 09/07 |
| 11:43 | Eliézer Clós | Alexandre Etchegaray | Sim | — |
| 11:49 | Junior Padilha | Daniele Russi Jardim | **Não** | já teve visita em 26/06 |
| 13:30 | Gustavo Niz | Priscila Kologeski | Sim | — |
| 14:02 | Paula Medeiros | patricia | Não | várias visitas jun/jul |
| 14:10 | Adriana Kaiser | Alexandre Tadashi | Não | visita em 31/07 (no_show) |
| 14:14 | Junior Padilha | Anna Paula Medeiros | Sim | — |
| 14:16 | **William Brizola** | Carlos Temes Quadros | **Não** | visita em 04/08 |

Placar atual: Junior 1 visita / 35 pts, William Brizola 0 visita / 0 pts.

**Causa:** visitas do pipeline já entram no placar (gatilho `trg_visita_conta_mutirao`), mas existe uma trava criada em 31/07 — "só pontua cliente inédito no funil". Toda remarcação de cliente que já visitou antes é descartada. Foi exatamente isso que barrou Junior e William.

## Nova regra (aprovada)

**1 visita pontuada por cliente por sessão.** Toda visita criada durante o mutirão pontua 30 — inclusive remarcação de cliente que já visitou em outra data — desde que aquele cliente ainda não tenha pontuado na sessão do dia.

Mantém-se: 30 pts visita / 5 aproveitado / 0 tentativa; visita marcada dentro do mutirão continua contando uma única vez; vale para qualquer corretor (entra no placar automaticamente); conta pelo dia em que a visita foi **marcada** (BRT).

## O que muda tecnicamente

1. Migration substituindo `public.trg_visita_conta_mutirao`:
   - remover o bloqueio "existe visita anterior do mesmo cliente em qualquer data";
   - manter o dedup por sessão pela chave SSOT (`pipeline_lead_id` > telefone só dígitos > nome normalizado), comparando com as visitas já pontuadas na sessão — inclusive quando não há lead vinculado;
   - continua `SECURITY DEFINER` com `EXCEPTION WHEN OTHERS`, para nunca bloquear o agendamento da visita.
2. Frontend: nenhuma mudança — Placar TV, Painel Ao Vivo e `oferta-ativa-ranking` já leem contadores e extrato.
3. Backfill da sessão de hoje: lançar as 5 visitas barradas (Wendel, Junior/Daniele, Paula, Adriana, William/Carlos) → Junior fica com 2 visitas / 65 pts e William com 1 visita / 30 pts, e os demais entram no placar.

## Validação após o build

- Conferir na TV: Junior 2 visitas · William Brizola 1 visita, e os 3 corretores novos no placar.
- Marcar visita de teste fora do mutirão → +1 visita, +30 pts e pop-up de celebração.
- Marcar segunda visita do mesmo cliente de teste na mesma sessão → **não** pontua de novo.
- Excluir a visita de teste ao final.

## Memória

`mem://features/oferta-ativa/visita-pontua-so-cliente-inedito` será reescrita para "1 visita por cliente por sessão".
