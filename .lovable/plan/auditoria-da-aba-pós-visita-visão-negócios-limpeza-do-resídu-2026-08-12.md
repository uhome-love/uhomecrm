# Auditoria da aba Pós-Visita (visão Negócios) — limpeza do resíduo legado

## Diagnóstico (dados reais, só leitura)

A coluna **Pós-Visita** tem hoje **81 leads ativos**. Cruzei cada um com visita realizada registrada, último toque, atividades, negócio vinculado e dono.

| Grupo | Qtd | Situação |
|---|---|---|
| Visita real + toque nos últimos 14 dias | 60 | Saudável — não mexer |
| Visita real, parados 14–30 dias | 5 | Real, só cobrança |
| Sem visita registrada, mas ativos (Luiza Clós) | 2 | Reais — não mexer |
| Bruno Schuler com visita real (Nathalia Paz, Cristina Biehl) | 2 | Reais — não mexer |
| **Bruno Schuler — resíduo de migração** | **14** | Alvo da limpeza |

Padrão idêntico nos 14: entraram na etapa no mesmo dia (**27/07/2026**), criados entre mar/2025 e dez/2025, **sem visita na agenda**, **último toque = data de criação**, **sem negócio vinculado**, e `flag_status` com apenas `{"status_visita":"realizada"}` **sem `visita_id`** — vieram de flag legado, não de visita real.

**Exceção:** `Vinícius (v. futura)` tem 12 atividades (última em mai/2026). Fica **fora** da limpeza, em lista de revisão manual.

Na tabela de **negócios ativos o Bruno não tem nenhum** — o que aparece com o nome dele são esses leads da coluna.

## Lista final para aprovação (13 leads)

Todos do Bruno Schuler, todos sem visita, sem negócio, sem atividade, sem toque desde 2025:

1. William Lyra — criado 26/03/2025
2. Susi — 28/03/2025
3. Vanessa Martins Marques (v. futura) — 05/04/2025
4. Sérgio Endler — 09/04/2025
5. Diego Peng Goulart — 22/04/2025
6. Daiane Kaczanoski — 29/04/2025
7. Alex Prado Ilha — 18/05/2025
8. Jorge Cunha — 01/09/2025
9. Marcelo da Roleta — 03/09/2025
10. MANOELA BARBOSA — 24/09/2025
11. Pedro Donato — 15/10/2025
12. Ronaldo Fernando — 12/11/2025
13. Ana Mariza Pozzobon — 11/12/2025

## O que será feito

1. **Backup antes de tudo:** snapshot de id, etapa atual, dono, `flag_status` e datas numa tabela de rollback aditiva, para desfazer em um comando.
2. **Mover os 13 para Descarte reengajável**, usando o fluxo de descarte já existente (motivo canônico "base legada sem visita"), para que entrem no funil de nutrição/reengajamento. **Nada é arquivado, excluído ou escondido** — o lead continua existindo e reversível.
3. **Limpar o flag falso** `status_visita: "realizada"` desses 13 (sem `visita_id`), para não voltarem à Pós-Visita.
4. **Vinícius (v. futura)** fica na Pós-Visita, marcado para revisão manual.
5. **Os 5 parados 14–30 dias** ganham apenas um chip "parado há X dias" na coluna — sem mover nada.
6. **Causa raiz:** a coluna aceita lead só pelo `flag_status.status_visita`. Passa a exigir visita registrada (ou `visita_id` no flag); casos legados restantes ganham selo "sem visita registrada".

## Detalhes técnicos

- Seleção por anti-join: `pipeline_leads` (stage `pos_visita`, `arquivado = false`) sem linha em `visitas` com status `realizada`, sem `pipeline_atividades`, `negocio_id is null`, `ultimo_toque_at < now() - 180 dias`. Aplicada sobre a lista fixa de 13 ids acima (dupla trava).
- Alteração de dados via ferramenta de dados (não migration destrutiva); tabela de rollback criada por migration aditiva.
- Frontend: chip de "parado há X dias" e selo "sem visita registrada" em `NegociosWorkspace.tsx` / `useNegociosBoard.ts` (apenas leitura/apresentação).

## Validação após executar

Conferir no preview que a Pós-Visita passa de 81 para 68 leads, que os 13 aparecem em Descarte com histórico intacto, e que Nathalia Paz, Cristina Biehl, Thiago Lorenzzoni, Lucas Drago e Vinícius continuam na coluna.
