# Correção — leads de reengajamento falhando na Fila do CEO

## O que está acontecendo (confirmado nos dados)

O lead parado agora na Fila do CEO é **Josue (JNFJOSUE65)**, badge "Casa Tua", com motivo de falha `sem_alocado_produto` ("sem corretor alocado ativo neste produto").

Auditoria:
- O lead mostra **empreendimento = "Casa Tua"**, mas o empreendimento canônico gravado nele é **"Orygem"** (empreendimento inativo, com **0 corretores alocados**).
- A distribuição da roleta usa o **empreendimento canônico**, não o texto. Como ninguém está alocado a "Orygem", o pool fica vazio e o lead volta para a Fila do CEO — não existe fallback.
- Causa raiz: a rotina de reativação por reengajamento (`reativar_lead_para_fila_ceo`) atualiza apenas o **texto** do empreendimento pelo template do disparo (Casa Tua, Flow, Lake Baikal, Connect JW…), mas **não atualiza o `empreendimento_canonico_id`**. O lead fica com o produto antigo (muitas vezes inativo) preso.
- Escala do problema: **71 leads** reativados por nutrição estão com texto e canônico divergentes — todos são candidatos à mesma falha.

## O que será feito

1. **Corrigir a reativação na fonte**
   - Em `reativar_lead_para_fila_ceo`, ao definir o empreendimento pelo template, resolver também o **empreendimento canônico correspondente** e gravá-lo no lead (mesma tabela canônica usada pela roleta).
   - Se o canônico resolvido estiver inativo ou não existir, limpar o canônico (deixar nulo) em vez de manter um produto errado — assim o lead cai no fluxo por segmento e continua distribuível.

2. **Corrigir os leads já afetados (backfill)**
   - Re-resolver o canônico dos leads reativados por nutrição cujo texto não bate com o canônico gravado (71 registros), incluindo o Josue.
   - Não altera etapa, corretor nem histórico — só corrige o produto.

3. **Deixar o erro claro para o CEO na tela**
   - No modal da Fila CEO, quando um lead falhar por `sem_alocado_produto` / `empreendimento_inativo`, mostrar na linha do lead o motivo e o produto envolvido, com o atalho já existente de **Repassar manualmente** para o corretor escolhido.

4. **Validação ao vivo**
   - Rodar o disparo do Josue na Fila CEO e confirmar que ele é distribuído a um corretor alocado a Casa Tua.
   - Conferir que o contador de divergências (texto x canônico) volta a zero.

## Detalhes técnicos

- Migration única (DDL): `CREATE OR REPLACE FUNCTION public.reativar_lead_para_fila_ceo(...)` mapeando template → nome canônico → `empreendimentos_canonicos.id` (match exato por nome, com `ativo = true`), gravando `empreendimento_canonico_id` no mesmo `UPDATE` que já grava `empreendimento`/`segmento_id`.
- Backfill via update de dados (sem DDL) sobre `pipeline_leads` onde `reativado_por_nutricao = true` e `lower(empreendimento) <> lower(nome do canônico)`.
- Frontend: `src/components/pipeline/FilaCeoDispatchModal.tsx` — exibir `motivo_pendencia` traduzido por lead (já existe o dicionário `FAILURE_REASON_LABELS`); sem mudança de lógica de distribuição.
- Nenhuma alteração em `distribuir_lead_atomico` — a regra de "só corretor alocado ao produto" permanece intacta.
