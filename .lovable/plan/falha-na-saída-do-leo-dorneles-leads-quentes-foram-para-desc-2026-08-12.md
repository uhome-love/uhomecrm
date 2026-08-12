# Falha na saída do Leo Dorneles — leads quentes foram para Descarte

## O que os dados mostram (verificado agora)

Inativação do Leo Dorneles hoje às 19:56 (BRT 16:56):

- **77 leads** receberam `motivo_descarte = "Descartado: Corretor desligado"` (55 ativos + 22 já arquivados), todos jogados na etapa **Descarte** como reengajáveis.
- **Só 8 leads foram para o Gabriel**: 7 em **Ganho** e 1 em **Em Negociação** (+1 arquivado).
- Por isso o pipeline do Gabriel parece vazio: Ganho não é coluna do board (é o filtro "🏆 Ganhos") e Em Negociação vive na aba Negócios. O header mostra "8 leads" e todas as colunas 0 — exatamente o print.
- Entre os 55 descartados ativos há leads claramente quentes: **13 com visita** (marcada, realizada, no-show ou pós-visita, várias de julho), mais vários em qualificação/aquecimento (`status_atendimento`, `status_busca`, `prazo`).

## Causa raiz (no código)

No diálogo de inativação (`InativarOuExcluirDialog.tsx`) e na edge function `create-broker-user`, "lead avançado" é definido só como:

```text
stage.tipo IN ('proposta','contrato_gerado','venda')  OU  lead.negocio_id preenchido
```

Todo o resto — Visita, Pós-Visita, Aquecimento, Qualificação, Sem Contato — cai no balde "frio" e vai para Descarte. Não foi erro de execução: o critério é estreito demais.

Agravante: o descarte em massa **não gravou histórico** (`pipeline_historico` sem registros desses leads), então a etapa anterior de cada lead não ficou salva.

## Plano

### Fase 1 — Recuperar os leads do Leo (dados)

1. Criar tabela de segurança `public._rollback_leo_2026_08_12` com o estado atual dos 77 leads.
2. Selecionar os leads a recuperar entre os 55 ativos descartados hoje: os que têm sinal de evolução em `flag_status` (`status_visita`, `status_atendimento`, `status_busca`, `prazo`, `interesse`) — cerca de 30 leads, sendo 13 com visita.
3. Reconstituir a etapa a partir do `flag_status`:
   - `status_visita` marcada/realizada/no_show → **Visita**; `pos_visita` → **Pós-Visita**
   - `prazo` (30/60/90) sem visita → **Aquecimento**
   - `status_atendimento`/`status_busca` → **Qualificação**
4. Passar esses leads para o **Gabriel Vieira** (gerente do Leo), limpando `motivo_descarte`/`tipo_descarte`, mantendo `arquivado = false` e registrando a movimentação em `pipeline_historico`.
5. Os demais (sem nenhum sinal de evolução) ficam em Descarte reengajável — voltam para o motor de reengajamento, como previsto.
6. Validar no preview com o filtro "Corretor: Gabriel Vieira": colunas Qualificação / Aquecimento / Visita / Pós-Visita passam a mostrar os leads.

### Fase 2 — Corrigir a regra de saída de corretor (código)

Na edge function `create-broker-user` (execução) e no diálogo (prévia), passa a ir para o gerente:

- etapas `proposta`, `contrato_gerado`, `venda`, `documentacao`, **`visita`**, **`pos_visita`**, **`aquecimento`**;
- qualquer lead com `negocio_id`;
- leads em `qualificacao` **com toque nos últimos 30 dias** (`ultimo_toque_at`).

O resto continua indo para Descarte reengajável. A prévia passa a mostrar a quebra por etapa ("3 em Visita, 8 em Qualificação"), e o descarte em massa passa a gravar `pipeline_historico` com a etapa anterior, permitindo rollback futuro.

### Fase 3 — Sinalizar Ganho/Negociação no board

Para o gerente não achar que "não veio nada": quando o filtro de corretor tiver leads em Ganho ou Em Negociação fora das colunas, mostrar um aviso no topo do board com atalho para "🏆 Ganhos" e para a aba Negócios.

## Detalhes técnicos

- Tabelas tocadas: `pipeline_leads` (corretor_id, stage_id, motivo_descarte, tipo_descarte), `pipeline_historico` (inserção), nova `_rollback_leo_2026_08_12`.
- Migration só cria a tabela de rollback; as movimentações vão como data change separada.
- Código: `src/components/team/InativarOuExcluirDialog.tsx` e `supabase/functions/create-broker-user/index.ts`.
- Nenhum lead arquivado do Leo será desarquivado nesta ação.
